# Per-Endpoint Client Methods Plan

## Problem

The generated `Client` class has a single generic `provide()` method that routes all requests through
`defaultImplementation`. Response parsing is done by MIME sniffing at runtime, which can disagree
with the generated response type:

| Schema output | Generated type | MIME guess      | Parser used | Match? |
| ------------- | -------------- | --------------- | ----------- | ------ |
| `ez.buffer()` | `Blob`         | `text/plain`    | `.text()`   | ❌     |
| `z.string()`  | `string`       | `image/svg+xml` | `.blob()`   | ❌     |

The generator already knows each endpoint's response type at code-gen time but can't use it because
`defaultImplementation` is a single shared function that only receives `(method, path, params)` —
the original request key is lost.

## Goal

Generate per-endpoint methods on the `Client` class that use the correct response parser for each
endpoint, eliminating the guesswork. The generic `provide()` is kept for backward compatibility.

## Approach

Generate individual methods on `Client`, one per endpoint. Each method:

1. Knows its response type at code-gen time
2. Parses the response using the exact parser matching the expected type
3. Falls back to the shared `defaultImplementation` for transport (fetch, headers, body)

The generated class would look like this:

```typescript
export class Client<T> {
  public constructor(
    protected readonly implementation: Implementation<T> = defaultImplementation,
  ) {}

  "get /v1/user/retrieve"(
    params: GetV1UserRetrieveInput,
    ctx?: T,
  ): Promise<GetV1UserRetrievePositiveVariant1> {
    const [method, path] = parseRequest("get /v1/user/retrieve");
    return this.implementation(method, ...substitute(path, params), ctx);
  }

  "get /v1/avatar/stream"(
    params: GetV1AvatarStreamInput,
    ctx?: T,
  ): Promise<GetV1AvatarStreamPositiveVariant1> {
    const [method, path] = parseRequest("get /v1/avatar/stream");
    const raw = await this.implementation(
      method,
      ...substitute(path, params),
      ctx,
    );
    return raw instanceof Blob ? raw : new Blob([raw]);
  }
}
```

## Design Decisions

### 1. Implementation return type stays `Promise<any>`

`defaultImplementation` continues to return the parsed value using content-type heuristics. Each
per-endpoint method may post-process if the heuristic result doesn't match the expected type. Users
who provide a custom `implementation` still return the final parsed value — their code is unchanged.

### 2. Post-processing per endpoint

If the generated type is `Blob` but the implementation returned a `string` (MIME mismatch), the
method wraps it: `new Blob([raw])`. If the generated type is `string` but the implementation
returned a `Blob`, the method calls `raw.text()`.

For JSON endpoints, no post-processing is needed since the heuristic is correct.

### 3. The generic `provide()` stays

For users who prefer the generic API or use dynamic request strings, `provide()` remains available
with heuristic parsing.

## Implementation Steps

### Step 1: Add `responseHandling` info to the endpoint's `store`

In `integration.ts`, during the `onEndpoint` callback, determine the expected parser category for
each endpoint's response type. The `zodToTs` output can be inspected to decide:

- `Blob` type → `"blob"` (when `onBuffer` was called)
- `undefined` type → `"skip"` (no-body responses)
- `object` / `array` type → `"json"`
- `string` type → `"text"`

Store this alongside the request key in a new `parsers` map on `IntegrationBase`.

### Step 2: Generate per-endpoint methods in `makeClientClass`

Instead of generating just `provide()`, generate one method per entry in `parsers`. The method body
calls `parseRequest`, `substitute`, then `this.implementation`, and optionally post-processes the
result.

### Step 3: Remove heuristic parsing from `defaultImplementation` (optional)

If all endpoints have explicit methods, the heuristic in `defaultImplementation` is only a fallback
for `provide()` and custom usage. It can stay simplified.

### Step 4: Update snapshots

The integration test snapshots will need updating since the client class will have new methods.

## Open Questions

1. **Naming convention**: Use the full request string as method name (e.g.
   `"get /v1/user/retrieve"`), or generate a camelCase name (e.g. `getV1UserRetrieve`)? The former
   matches the existing `provide()` pattern and avoids name conflicts.

2. **Response type inference**: Can we detect the response type purely from the generated TS type
   node, or do we need additional metadata from the `zodToTs` call?

3. **Post-processing scope**: Should every non-matching type get a runtime conversion, or only the
   common mismatches (Blob↔string)?
