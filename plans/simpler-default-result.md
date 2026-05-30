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

### Phase 6 — Migration ESLint rule (`migration/`)

Do NOT host legacy entities in the library — they would never be removable. Instead, the migration ESLint rule
detects usage of `defaultResultHandler` / `defaultEndpointsFactory` and auto-generates a compat replacement
in the user's codebase on `--fix`. The generated code is a simplified version of the old envelope (no example
propagation, only the shape):

```typescript
// Generated by @express-zod-api/migration — compatibility shim for defaultResultHandler
import {
  ResultHandler,
  defaultStatusCodes,
  ensureHttpError,
  getPublicErrorMessage,
  logServerError,
} from "express-zod-api";

export const legacyResultHandler = new ResultHandler({
  positive: (output) =>
    z.object({ status: z.literal("success"), data: output }),
  negative: z.object({
    status: z.literal("error"),
    error: z.object({ message: z.string() }),
  }),
  handler: ({ error, input, output, request, response, logger }) => {
    if (error) {
      const httpError = ensureHttpError(error);
      logServerError(httpError, logger, request, input);
      return void response
        .status(httpError.statusCode)
        .set(httpError.headers)
        .json({
          status: "error",
          error: { message: getPublicErrorMessage(httpError) },
        });
    }
    response
      .status(defaultStatusCodes.positive)
      .json({ status: "success", data: output });
  },
});
```

| File                                      | Change                                                                                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `migration/index.ts`                      | Add esquery selectors for `defaultResultHandler` / `defaultEndpointsFactory`; `create()` generates the compat handler (table above)                 |
| `migration/index.ts`                      | Add consumer-side transformations for `client.provide()` call sites (see below)                                                                     |
| `express-zod-api/src/integration-base.ts` | Generate a deprecated `Response` alias: `/** @deprecated Use EncodedResponse instead. */ type Response = { [K in Request]: EncodedResponse[K][1] }` |

#### deprecated `Response` alias

The generated `Response` type maps each request key to the body (second tuple element), preserving the old
interface name. The `@deprecated` JSDoc nudges consumers toward `EncodedResponse`.

#### Consumer-side `client.provide()` migration

Since `client.provide()` now returns `Promise<[statusCode, body]>` instead of `Promise<body>`, call sites must be updated:

| Pattern     | Before                                     | After                                                 |
| ----------- | ------------------------------------------ | ----------------------------------------------------- |
| **Await**   | `const response = await client.provide(…)` | `const [status, response] = await client.provide(…)`  |
| **.then()** | `client.provide(…).then(response => {…})`  | `client.provide(…).then(([status, response]) => {…})` |

The migration rule should:

1. Detect variable declarations whose initializer is `await client.provide(…)` and add destructuring:
   - `const response = await client.provide(url, params);`
   - → `const [status, response] = await client.provide(url, params);`
   - Preserve the original variable name as the body position (second element).
2. Detect `.then(response => …)` / `.then((response) => …)` callbacks on `client.provide(…)` and add tuple destructuring to the parameter.
3. Insert a `@todo` JSDoc comment on the declaration or callback indicating that success/error discrimination should now use status code checks (e.g., `status === 200`) instead of `response.status === "success"`.

#### Custom implementation in `new Client()` argument

If the user passes a custom implementation to `new Client(myImpl)` (i.e., not the default), the `return` statement
must wrap the existing value as the second element of a tuple:

```typescript
// Before:
return response.json();

// After:
/** @todo Response.status must be the status-code in the first place of this tuple */
return [response.status, await response.json()];
```

The migration rule should:

1. Detect `new Client(…)` calls with a non-trivial argument (an identifier or function expression).
2. Find `return` statements inside that implementation's body.
3. Wrap the existing expression as the second element: `return [response.status, <existing>]`.
4. If the existing expression is an `await` call, preserve it: `return [response.status, await <expr>]`.
5. Insert a `@todo` JSDoc comment directly above the `return` to flag manual adjustment.
