# Improve ResultHandler Intake Contract

## Problem

There is a type gap between what output schema a `ResultHandler` expects (its "intake contract") and what `EndpointsFactory.build()` accepts:

1. `ResultHandler` accepts `LazyResult<POS, [IOSchema]>` — the `positive` callback's `output` parameter is typed as the broad `IOSchema`, losing any constraints about what shape the handler actually needs.
2. `EndpointsFactory` stores `resultHandler: AbstractResultHandler` — all generic type info from the specific `ResultHandler<POS, NEG>` is erased.
3. `build()` accepts `output: BOUT extends IOSchema` — no link to what the result handler expects.

As a result, at compile time you can pass any `IOSchema` to `arrayEndpointsFactory.build({ output: ... })`, even though `arrayResultHandler` will throw at runtime if the output lacks `items: ZodArray`. Same issue applies to custom handlers like `fileSendingEndpointsFactory` (expects `data`) and `fileStreamingEndpointsFactory` (expects `filename`).

---

## Guiding constraints

- **`AbstractResultHandler` stays unchanged** — it remains abstract with the broadest definition (`getPositiveResponse(output: IOSchema)`), no type parameters added.
- The `OUT` type parameter lives only on `ResultHandler` and propagates through `EndpointsFactory`.
- **Non-breaking** for all existing code: default type parameter values preserve current behavior.

---

## Proposed Changes

### Step 1: Add `OUT` type parameter to `ResultHandler`

**File:** `express-zod-api/src/result-handler.ts`

```typescript
export class ResultHandler<
  POS extends Result,
  NEG extends Result,
  OUT extends IOSchema = IOSchema,   // NEW — at the end to preserve type param order
> extends AbstractResultHandler {
  readonly #positive: POS | LazyResult<POS, [OUT]>;   // narrowed from [IOSchema]
  readonly #negative: NEG | LazyResult<NEG>;

  constructor(params: {
    positive: POS | LazyResult<POS, [OUT]>;  // narrowed
    negative: NEG | LazyResult<NEG>;
    handler: Handler<z.output<ResultSchema<POS> | ResultSchema<NEG>>>;
  }) {
    super(params.handler);
    this.#positive = params.positive;
    this.#negative = params.negative;
  }

  public override getPositiveResponse(output: OUT) {  // narrowed from IOSchema
    return normalize(this.#positive, {
      variant: "positive",
      args: [output],
      statusCodes: [defaultStatusCodes.positive],
      mimeTypes: [contentTypes.json],
    });
  }

  public override getNegativeResponse() {
    return normalize(this.#negative, { ... });
  }
}
```

**Key insight:** The `positive` callback's parameter is now `OUT`. When a user annotates it (e.g., `(output: z.ZodObject<{ items: z.ZodArray<...> }>) => ...`), TypeScript infers `OUT` automatically from the constructor call.

`OUT` sits at the end so existing explicit type annotations like `ResultHandler<SomePos, SomeNeg>` continue to work (defaults to `IOSchema`).

`AbstractResultHandler` is not touched — it stays parameterless. The override `getPositiveResponse(output: OUT)` is valid because `OUT extends IOSchema` satisfies the base method signature.

---

### Step 2: Change `EndpointsFactory` constructor to accept `ResultHandler` and add `OUT` type param

**File:** `express-zod-api/src/endpoints-factory.ts`

```typescript
export class EndpointsFactory<
  IN extends IOSchema | undefined = undefined,
  CTX extends FlatObject = EmptyObject,
  SCO extends string = string,
  OUT extends IOSchema = IOSchema,   // NEW — at the end, defaults to IOSchema
> {
  protected schema = undefined as IN;
  protected middlewares: AbstractMiddleware[] = [];
  // Accept the more specific ResultHandler instead of AbstractResultHandler
  constructor(protected resultHandler: ResultHandler<Result, Result, OUT>) {}

  #extend<
    AIN extends IOSchema | undefined,
    RET extends FlatObject,
    ASCO extends string,
  >(middleware: Middleware<CTX, RET, ASCO, AIN>) {
    const factory = new EndpointsFactory<
      Extension<IN, AIN>,
      (CTX extends EmptyObject ? RET : CTX) & RET,
      SCO & ASCO,
      OUT       // propagate the constraint through the chain
    >(this.resultHandler);
    factory.middlewares = this.middlewares.concat(middleware);
    factory.schema = ensureExtension(this.schema, middleware.schema);
    return factory;
  }

  // addMiddleware, addExpressMiddleware, addContext, use — same propagation pattern

  public build<BOUT extends OUT, BIN extends IOSchema = EmptySchema>({
    input = emptySchema as unknown as BIN,
    output: outputSchema,
    ...
  }: BuildProps<BIN, BOUT, IN, CTX, SCO>) {
    // BOUT now constrained by OUT from the ResultHandler
  }
}
```

**This is the core payoff:** `BOUT extends OUT` in `build()` means the output schema must satisfy the constraint the result handler expects. For the default handler (`OUT = IOSchema`), no extra narrowing. For `arrayResultHandler` with a narrowed `OUT`, `build()` rejects output schemas missing `items`.

The constructor accepts `ResultHandler<Result, Result, OUT>` and infers `OUT`. `POS` and `NEG` are not exposed as factory type params — only `OUT` matters for the build constraint.

**Implementation detail:** Where `Endpoint` is constructed inside `build()`, `resultHandler` is passed as `ResultHandler<Result, Result, OUT>` which satisfies `Endpoint`'s constructor parameter type `AbstractResultHandler` (by inheritance).

All `add*` and `#extend` methods propagate `OUT` unchanged. `buildVoid` delegates to `build`, inheriting the constraint automatically.

---

### Step 3: Update `arrayResultHandler` with narrowed type

**File:** `express-zod-api/src/result-handler.ts`

```typescript
export const arrayResultHandler = new ResultHandler({
  positive: (output: z.ZodObject<{ items: z.ZodArray<z.ZodTypeAny> }>) => {
    const responseSchema = output.shape.items;
    const examples = getExamples(responseSchema);
    if (examples.length) return responseSchema;
    const parentExamples = getExamples(output)
      .filter(
        (example): example is { items: unknown[] } =>
          isObject(example) &&
          "items" in example &&
          Array.isArray(example.items),
      )
      .map((example) => example.items);
    if (parentExamples?.length) {
      const current = responseSchema.meta();
      globalRegistry
        .remove(responseSchema)
        .add(responseSchema, { ...current, examples: parentExamples });
    }
    return responseSchema;
  },
  negative: { schema: arrayNegativeSchema, mimeType: "text/plain" },
  handler: ({ response, output, error, logger, request, input }) => {
    // runtime checks remain as defense-in-depth
    if (error) { ... }
    if ("items" in output && Array.isArray(output.items)) {
      return void response.status(defaultStatusCodes.positive).json(output.items);
    }
    throw new Error("Property 'items' is missing in the endpoint output");
  },
});
```

The `positive` callback now has an explicit parameter type, so TypeScript infers `OUT = z.ZodObject<{ items: z.ZodArray<z.ZodTypeAny> }>`. The fallback `z.array(z.any())` is removed because the type now guarantees the schema shape.

**Backwards compatibility:** Code using `arrayEndpointsFactory.build()` with an output schema lacking `items` will now get a compile-time error instead of a runtime crash. This is a positive breakage — it surfaces latent bugs.

---

### Step 4: Add `createResultHandler` helper (optional)

**File:** `express-zod-api/src/result-handler.ts`

```typescript
export function createResultHandler<
  POS extends Result,
  NEG extends Result,
  OUT extends IOSchema,
>(params: {
  positive: POS | LazyResult<POS, [OUT]>;
  negative: NEG | LazyResult<NEG>;
  handler: Handler<z.output<ResultSchema<POS> | ResultSchema<NEG>>>;
}): ResultHandler<POS, NEG, OUT> {
  return new ResultHandler(params);
}
```

**Purpose:** Factory-function style. TypeScript infers `OUT` from the callback parameter annotation identically to the constructor approach. Not strictly required.

---

## What does NOT change

| Module | Reason |
|--------|--------|
| `AbstractResultHandler` | Stays as-is: no type params, `getPositiveResponse(output: IOSchema)` |
| `ResultSchema<R>`, `DiscriminatedResult`, `normalize()` | Pure runtime or unrelated |
| `Endpoint` class | Constructor still accepts `AbstractResultHandler` |
| `Endpoint.execute()` runtime logic | Unchanged |
| Public API exports (`index.ts`) | No symbol removal |
| Generators (`Integration`, `Documentation`) | Consume `NormalizedResponse[]` |
| `example/` directory factories | Won't narrow unless/until annotated |

---

## Migration considerations

### External code creating `ResultHandler` instances

All existing `new ResultHandler({...})` calls continue to compile because `OUT` defaults to `IOSchema`. Users opt in by annotating the `positive` callback parameter.

### External code passing custom `AbstractResultHandler` to `EndpointsFactory`

This is the only real breaking change: `EndpointsFactory` constructor now requires `ResultHandler` instead of `AbstractResultHandler`. In practice, all usage passes `ResultHandler` instances (confirmed in codebase: zero direct `AbstractResultHandler` subclasses exist). Migration for hypothetical code:

```typescript
// Before (only if someone subclassed AbstractResultHandler directly):
class MyHandler extends AbstractResultHandler { ... }
new EndpointsFactory(new MyHandler());

// After: wrap in ResultHandler or extend ResultHandler instead
class MyHandler extends ResultHandler<...> { ... }
```

### External code referencing `EndpointsFactory` type params

`EndpointsFactory<IN, CTX, SCO>` (3 params) continues to work. The 4th parameter `OUT` is optional and defaults to `IOSchema`.

---

## Verification

1. All existing tests pass without modification (`OUT = IOSchema` preserves behavior).
2. New compile-time test: `arrayEndpointsFactory.build({ output: z.object({ foo: z.string() }), handler: ... })` produces a type error.
3. New compile-time test: `arrayEndpointsFactory.build({ output: z.object({ items: z.array(z.string()) }), handler: ... })` compiles.
4. Runtime tests for `arrayResultHandler` continue to pass.
