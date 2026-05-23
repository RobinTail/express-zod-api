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

### Phase 5 — Client-side discrimination: `EncodedResponse` with tuple variants

The wire format sheds the `status:"success"/"error"` string. Instead of adding a separate `Response` interface,
the generated `Client` returns a `[statusCode, body]` tuple by using `SomeOf<EncodedResponse[K]>` directly.
The `EncodedResponse` interface's property values are tuples where the first element is the status code literal.

### How it works

The `*Variant#` types stay as bare body types — they describe only the response body:

```typescript
// Variant type is just the body — no change:
type GetV1UserRetrievePositiveVariant1 = { id: number; name: string };
```

The \*Variants interface values wrap them in a `[statusCode, body]` tuple at the property level:

```typescript
// Before (bare body in interface):
interface GetV1UserRetrievePositiveResponseVariants {
  200: GetV1UserRetrievePositiveVariant1; // { id, name }
}

// After (tuple in interface):
interface GetV1UserRetrievePositiveResponseVariants {
  200: [200, GetV1UserRetrievePositiveVariant1]; // [200, { id, name }]
}
```

The `EncodedResponse` intersection carries these tuples:

```typescript
export interface EncodedResponse {
  "get /v1/user/retrieve": { 200: [200, { id: number; name: string }] } & {
    400: [400, { message: string }];
  };
}

// SomeOf unwraps to a discriminated tuple union:
//   SomeOf<EncodedResponse["get /v1/user/retrieve"]>
//   = [200, { id, name }] | [400, { message }]
```

Since the tuples are already in the variant interface values, `SomeOf<EncodedResponse[K]>` produces the
discriminated union directly — no `ToTuple` helper needed.

### Consumer usage

```typescript
const [status, body] = await client.provide("get /v1/user/retrieve", {
  id: "10",
});
//    ^ 200 | 400          ^ PosVariant | NegVariant
if (status === 200) {
  body; // narrowed to PosVariant
} else {
  body; // narrowed to NegVariant
}
```

The first tuple element is the HTTP status code literal — checking it narrows the second element.

### Generated type changes

```typescript
// Implementation returns Promise<[number, any]> instead of Promise<any>
type Implementation<T = unknown> = (
  method: Method,
  path: string,
  params: Record<string, any>,
  ctx?: T,
) => Promise<[status: number, body: any]>;

// Variant types stay as bare body (no change):
type GetV1UserRetrievePositiveVariant1 = { id: number; name: string };

// Variant interfaces wrap in [status, body] tuples:
interface GetV1UserRetrievePositiveResponseVariants {
  200: [200, GetV1UserRetrievePositiveVariant1];
}

// No separate Response interface — EncodedResponse is the primary type:
export interface EncodedResponse {
  "get /v1/user/retrieve": GetV1UserRetrievePositiveResponseVariants &
    GetV1UserRetrieveNegativeResponseVariants;
}

// Client.provide() returns SomeOf<EncodedResponse[K]> directly
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

| File                                                        | Change                                                                                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `integration-base.ts:IOKind`                                | Remove `"response"` from the union type (no more `Response` interface)                                                       |
| `integration-base.ts:interfaces`                            | Remove `response: "Response"` entry                                                                                          |
| `integration-base.ts:162-178` (`makeImplementationType`)    | Return type: `Promise<any>` → `Promise<[number, any]>`                                                                       |
| `integration-base.ts:354-400` (`#makeProvider`)             | Return type: `Promise<SomeOf<EncodedResponse[K]>>` instead of `Promise<Response[K]>`                                         |
| `integration-base.ts:446-585` (`makeDefaultImplementation`) | Return `[response.status, body]` tuple instead of bare `body`; handle no-body early return as `[response.status, undefined]` |
| `integration-base.ts:makePublicInterfaces`                  | Remove `"response"` from the `IOKind` iteration                                                                              |
| `integration.ts:109-148` (`onEndpoint`)                     | Generate tuple variant types and use `SomeOf<EncodedResponse[K]>` for `store.response` (or remove `store.response` entirely) |

The key change in `integration.ts` — the variant type generation stays the same (bare body), only the
interface property value changes to a tuple:

```typescript
// Before (bare body in interface):
const variantType = this.api.makeType(
  entitle(responseVariant, "variant", `${idx + 1}`),
  zodToTs(hasBody ? schema : noBodySchema, ctxOut),
  { comment: request },
);
this.#program.push(variantType);
return statusCodes.map((code) =>
  this.api.makeInterfaceProp(code, variantType.name),
);

// After (tuple in interface):
const variantType = this.api.makeType(
  entitle(responseVariant, "variant", `${idx + 1}`),
  zodToTs(hasBody ? schema : noBodySchema, ctxOut),
  { comment: request },
);
this.#program.push(variantType);
return statusCodes.map((code) =>
  this.api.makeInterfaceProp(
    code,
    this.api.f.createTupleTypeNode([
      this.api.f.createNumericLiteral(code),
      this.api.ensureTypeNode(variantType.name),
    ]),
  ),
);
```

The `*Variant#` type alias stays as the bare body type. Only the interface property value wraps it in
`[statusCode, body]`. When multiple status codes share the same variant (e.g., `400` and `500`), the
variant type is created once and each interface property independently wraps it with its specific code.

### Phase 6 — Migration rule (`migration/`)

Add a new rule in `migration/index.ts` that:

- Detects usage of `defaultResultHandler` / `defaultEndpointsFactory` and warns about the new response shape
- Flags client-side patterns like `response.status === "success"`, `response.data`, `response.error` that must be updated
- Provides instruction (or auto-fix) to create a compat `ResultHandler` for users who want to keep the old envelope

The `store` object no longer needs `response` — `Client.provide()` computes the return type inline:

```typescript
// Current #makeProvider return type:
returns: this.api.makePromise(
  this.api.makeIndexed(this.interfaces.response, "K"),
),

// Proposed:
returns: this.api.makePromise(
  this.api.makeIndexed(this.#ids.someOfType,
    this.api.makeIndexed(this.interfaces.encoded, "K"),
  ),
),
```
