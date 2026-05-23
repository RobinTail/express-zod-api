# Simplify `defaultResultHandler` response format

Remove the `{ status: "success"/"error", data/error }` envelope, sending the output (or error object) directly.
HTTP status codes already discriminate success vs error.

## Before / After

|              | Success                                 | Error                                     |
| ------------ | --------------------------------------- | ----------------------------------------- |
| **Current**  | `{ status: "success", data: <output> }` | `{ status: "error", error: { message } }` |
| **Proposed** | `<output>` (bare)                       | `{ message }` (bare)                      |

## Rationale

- **Example propagation eliminated** — the complex `getExamples()` + `globalRegistry.add()` dance in
  `result-handler.ts:114–122` goes away since the output schema is returned directly.
- **HTTP semantics** — `200` vs `4xx`/`5xx` already conveys success/error.
- **Smaller payloads** — less nesting per response.
- The `arrayResultHandler` is unaffected — it already returns bare arrays / plain-text errors.

## File-by-file plan

### Phase 1 — Core (`express-zod-api/src/result-handler.ts`)

- Change `defaultNegativeSchema`:
  `z.object({ status: z.literal("error"), error: z.object({ message: z.string() }) })`
  → `z.object({ message: z.string() })`
- Update its example: `{ status: "error", error: { message: … } }` → `{ message: … }`
- `defaultResultHandler.positive`: return `output` directly (identity) instead of wrapping in `z.object({ status: …, data: output })`
- Remove the `getExamples(output)` / `globalRegistry.add(responseSchema, …)` block (lines 114–122)
- `defaultResultHandler.handler`:
  - Success: `.json(output)` instead of `.json({ status: "success", data: output })`
  - Error: `.json({ message: … })` instead of `.json({ status: "error", error: { message: … } })`
- Remove unused `getExamples` import from `result-handler.ts`
- `arrayResultHandler`: no changes

### Phase 2 — Unit tests (`express-zod-api/tests/`)

| File                                        | Change                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `result-handler.spec.ts`                    | All `toEqual`, `toMatchSnapshot`, `expectTypeOf` assertions for `defaultResultHandler` expect unwrapped shapes                                          |
| `__snapshots__/result-handler.spec.ts.snap` | Regenerate — all `{status:"success",data:…}` → `…`, all `{status:"error",error:{message:…}}` → `{message:…}`                                            |
| `__snapshots__/integration.spec.ts.snap`    | Variant types stay as bare body `T`; \*Variants interface values change to `[200, T]` / `[400, {message:string}]` tuples. `Response` interface removed. |
| `server.spec.ts`                            | Check for hardcoded response-body assertions referencing `status`/`data`/`error` wrapper, update if found                                               |
| `routing.spec.ts`                           | Same                                                                                                                                                    |
| `endpoint.spec.ts`                          | Same                                                                                                                                                    |
| `system.spec.ts`                            | Same                                                                                                                                                    |

### Phase 3 — Example workspace

| File                                       | Change                                                                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `example/index.spec.ts`                    | Update `toMatchObject`, `toEqual`, `toMatchSnapshot` calls that assert `{status, data}`, `{status, error}`                                                              |
| `example/__snapshots__/index.spec.ts.snap` | Regenerate                                                                                                                                                              |
| `example/example.client.ts`                | Regenerate via `Integration` — \*Variants interface values become `[status, body]` tuples; `Response` interface removed; `EncodedResponse` is the primary consumer type |
| `example/example.documentation.yaml`       | Regenerate via `Documentation` — OpenAPI schemas drop the envelope                                                                                                      |

**Not affected:** `statusDependingFactory` / `fileSendingEndpointsFactory` / `fileStreamingEndpointsFactory` — these use custom `ResultHandler` instances, not `defaultResultHandler`.

### Phase 4 — Documentation

| File           | Change                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| `README.md`    | Update `DefaultResponse<OUT>`, the `curl` example, the testing section, and the custom `ResultHandler` template |
| `CHANGELOG.md` | Add breaking-change entry with `diff` code block (major release convention)                                     |

### Phase 5 — Client-side discrimination: `EncodedResponse` with tuple unions

The wire format sheds the `status:"success"/"error"` string. The generated `Client.provide()` returns a
`[statusCode, body]` tuple by producing `EncodedResponse[K]` as a direct discriminated union of tuples.
No `SomeOf` helper, no `*Variants` intermediate interfaces, no status-code duplication.

### Rationale

The previous plan wrapped tuples inside `*Variants` interface property values (`{200: [200, Body]}`),
requiring `SomeOf<T[keyof T]>` to unwrap. That duplicated the status code (once as property key, once
inside the tuple). The improved approach:

- Eliminates `*Variants` interfaces entirely
- `*Variant#` types stay bare body (unchanged — re-used by both `PositiveResponse`/`NegativeResponse` and the tuples)
- `store.positive` / `store.negative` become direct unions of bare variant type refs
- `store.encoded` becomes a direct union of `[statusCode, body]` tuples
- `SomeOf<T>` is no longer needed at all — the union is already flat
- Status code appears exactly once: only as the first tuple element
- `PositiveResponse[K]` stays as bare body types for `Subscription` class compatibility

### How it works

`*Variant#` types stay as bare body types:

```typescript
type GetV1UserRetrievePositiveVariant1 = { id: number; name: string };
```

`EncodedResponse` property values are direct unions of `[statusCode, body]` tuples:

```typescript
export interface EncodedResponse {
  "get /v1/user/retrieve":
    | [200, { id: number; name: string }]
    | [400, { message: string }];
}
```

No `*Variants` interface, no `SomeOf`, no duplication. `Client.provide()` returns `Promise<EncodedResponse[K]>` directly.

### Consumer usage

```typescript
const [status, body] = await client.provide("get /v1/user/retrieve", {
  id: "10",
});
//    ^ 200 | 400          ^ narrowed by status check

if (status === 200) {
  body; // { id: number; name: string }
} else {
  body; // { message: string }
}
```

### Generated type changes

```typescript
// Implementation returns Promise<[number, any]> instead of Promise<any>
type Implementation<T = unknown> = (
  method: Method,
  path: string,
  params: Record<string, any>,
  ctx?: T,
) => Promise<[number, any]>;

// Variant types stay as bare body (no change):
type GetV1UserRetrievePositiveVariant1 = { id: number; name: string };

// No *Variants interfaces; PositiveResponse is a direct union of bare bodies:
export interface PositiveResponse {
  "get /v1/user/retrieve":
    | GetV1UserRetrievePositiveVariant1
    | GetV1UserRetrieveNegativeVariant1;
}

// EncodedResponse is a direct union of [status, body] tuples:
export interface EncodedResponse {
  "get /v1/user/retrieve":
    | [200, GetV1UserRetrievePositiveVariant1]
    | [400, GetV1UserRetrieveNegativeVariant1];
}

// Client.provide() returns EncodedResponse[K] directly (no SomeOf)
```

### defaultImplementation changes (generated)

```typescript
const defaultImplementation: Implementation = async (method, path, params) => {
  const response = await fetch(/* … */);
  const contentType = response.headers.get("content-type");
  if (!contentType) return [response.status, undefined];
  const isJSON = contentType.startsWith("application/json");
  const body = await response[isJSON ? "json" : "text"]();
  return [response.status, body];
};
```

### Code-generation changes needed

| File                                            | Change                                                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `integration-base.ts:IOKind`                    | Remove `"response"` from the union type                                                                                                                                   |
| `integration-base.ts:interfaces`                | Remove `response: "Response"` entry                                                                                                                                       |
| `integration-base.ts:#ids`                      | Remove `someOfType: "SomeOf"` entry                                                                                                                                       |
| `integration-base.ts:makeSomeOfType`            | Remove method entirely                                                                                                                                                    |
| `integration-base.ts:someOf` (helper)           | Remove method entirely                                                                                                                                                    |
| `integration-base.ts:makeImplementationType`    | Return type: `Promise<any>` → `Promise<[number, any]>`                                                                                                                    |
| `integration-base.ts:#makeProvider`             | Return type: `Promise<EncodedResponse[K]>` instead of `Promise<Response[K]>` (no `SomeOf`)                                                                                |
| `integration-base.ts:makeDefaultImplementation` | Return `[response.status, body]` tuple; no-body early return as `[response.status, undefined]`                                                                            |
| `integration-base.ts:makePublicInterfaces`      | `IOKind` iteration drops `"response"` automatically                                                                                                                       |
| `integration.ts:#program` init                  | `[this.makeSomeOfType()]` → `[]`                                                                                                                                          |
| `integration.ts:onEndpoint`                     | Drop `*Variants` interface generation; collect bare refs per variant; build `store.positive`/`negative` as direct unions; build `store.encoded` as direct union of tuples |

### The new `onEndpoint` logic (integration.ts)

Instead of the current `responseVariants.reduce` that builds `*Variants` interfaces:

```typescript
// Collect variant info for both positive and negative
const positiveBare: ts.TypeNode[] = [];
const negativeBare: ts.TypeNode[] = [];
const encodedTuples: ts.TypeNode[] = [];

for (const responseVariant of responseVariants) {
  const responses = endpoint.getResponses(responseVariant);
  const target = responseVariant === "positive" ? positiveBare : negativeBare;

  for (const [idx, { schema, mimeTypes, statusCodes }] of Array.from(
    responses.entries(),
  )) {
    const hasBody = shouldHaveContent(method, mimeTypes);
    const variantType = this.api.makeType(
      entitle(responseVariant, "variant", `${idx + 1}`),
      zodToTs(hasBody ? schema : noBodySchema, ctxOut),
      { comment: request },
    );
    this.#program.push(variantType);
    const ref = this.api.ensureTypeNode(variantType.name);

    for (const code of statusCodes) {
      target.push(ref);
      encodedTuples.push(
        this.api.f.createTupleTypeNode([this.api.makeLiteralType(code), ref]),
      );
    }
  }
}

const buildUnionOrSingle = (nodes: ts.TypeNode[]) =>
  nodes.length === 1 ? nodes[0] : this.api.makeUnion(nodes);

const store = {
  input: this.api.ensureTypeNode(input.name),
  positive: buildUnionOrSingle(positiveBare),
  negative: buildUnionOrSingle(negativeBare),
  encoded: buildUnionOrSingle(encodedTuples),
};
```

Key differences from old code:

- No `*Variants` interface created or pushed to `#program`
- `store.positive` / `store.negative` = direct union of variant type refs (not `SomeOf<Dict>`)
- `store.encoded` = direct union of tuple type nodes (not intersection of dicts)
- `store.response` is removed entirely
- Status codes appear only inside the tuple — not repeated as property keys

### Phase 6 — Migration rule (`migration/`)

Add a new rule in `migration/index.ts` that:

- Detects usage of `defaultResultHandler` / `defaultEndpointsFactory` and warns about the new response shape
- Flags client-side patterns like `response.status === "success"`, `response.data`, `response.error` that must be updated
- Flags references to the generated `Response` interface (now removed)
- Provides instruction (or auto-fix) to create a compat `ResultHandler` for users who want to keep the old envelope

The `store` object no longer needs `response` — `Client.provide()` returns the type inline:

```typescript
// Current #makeProvider return type:
returns: this.api.makePromise(
  this.api.makeIndexed(this.interfaces.response, "K"),
),

// Proposed:
returns: this.api.makePromise(
  this.api.makeIndexed(this.interfaces.encoded, "K"),
),
```
