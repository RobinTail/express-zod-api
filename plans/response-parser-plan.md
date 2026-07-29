# Response Parser Selection Plan for `defaultImplementation`

## Current State

In `integration-base.ts:236-265`, `makeDefaultImplementation` generates code like:

```typescript
const contentType = response.headers.get("content-type");
if (!contentType) return;
const isJSON = contentType.startsWith("application/json");
return response[isJSON ? "json" : "text"]();
```

Every non-JSON response gets `.text()`, returning a `string`. This is misaligned when the expected type is `Buffer` or a binary Blob.

## Problem

`Response[K]` can be:

- `object` / `array` — from `application/json` endpoints
- `string` — from `text/plain`, `image/svg+xml`, or JSON-serialized string schemas
- `Buffer` — from `ez.buffer()` with binary MIME types like `image/*`, `application/octet-stream`
- `undefined` — from no-body responses (204, HEAD)

`.text()` is wrong for `Buffer` (returns `string` at runtime), and `Buffer` is Node.js-specific anyway.

## Content Type Classification

| Category           | Content-Type examples                          | Parser    | Returns      |
| ------------------ | ---------------------------------------------- | --------- | ------------ |
| JSON               | `application/json`, `application/*+json`       | `.json()` | parsed value |
| text               | `text/plain`, `text/html`, `text/csv`          | `.text()` | `string`     |
| text (XML-based)   | `image/svg+xml`, `application/xml`, `text/xml` | `.text()` | `string`     |
| binary (images)    | `image/*` (except svg+xml)                     | `.blob()` | `Blob`       |
| binary (media)     | `audio/*`, `video/*`                           | `.blob()` | `Blob`       |
| binary (generic)   | `application/octet-stream`                     | `.blob()` | `Blob`       |
| binary (documents) | `application/pdf`, `application/zip`, etc.     | `.blob()` | `Blob`       |
| multipart          | `multipart/*`                                  | `.blob()` | `Blob`       |
| none               | no `content-type` header or empty body         | `return;` | `undefined`  |

## Parser Selection Logic

```
if (!contentType) return undefined;

if (isJsonContentType(contentType)) -> response.json()

if (isTextContentType(contentType))   -> response.text()

if (isBinaryContentType(contentType)) -> response.blob()

else -> response.text()  // fallback
```

### Helper predicates

```typescript
const isJsonContentType = (ct: string) =>
  ct.startsWith("application/json") || /^application\/.*\+json$/.test(ct);

const isTextContentType = (ct: string) =>
  ct.startsWith("text/") ||
  ct === "image/svg+xml" ||
  ct.startsWith("application/xml");

const isBinaryContentType = (ct: string) =>
  ct.startsWith("image/") ||
  ct.startsWith("audio/") ||
  ct.startsWith("video/") ||
  ct.startsWith("multipart/") ||
  ct.startsWith("application/octet-stream");
```

### `blob()` vs `arrayBuffer()` vs `Buffer`

| Concern               | `.blob()`                           | `.arrayBuffer()`      | `Buffer.from(await r.arrayBuffer())` |
| --------------------- | ----------------------------------- | --------------------- | ------------------------------------ |
| Platform              | browser + Node.js                   | browser + Node.js     | Node.js only                         |
| Return type           | `Blob`                              | `ArrayBuffer`         | `Buffer`                             |
| Use case              | opaque resource (display, download) | raw byte manipulation | Node.js `Buffer` consumers           |
| Matches `Buffer` type | no                                  | no                    | yes                                  |

**Decision**: Use `.blob()` as the default binary parser. It is portable and sufficient for the common case (downloading images, files). The generated `Response[K]` types would need to be `Blob` instead of `Buffer` for portable clients, or remain `Buffer` with Node.js-specific conversion.

## Mapping to Response Types

| Response type       | Expected parser               | Notes                                |
| ------------------- | ----------------------------- | ------------------------------------ |
| `object`, `array`   | `.json()`                     | Standard                             |
| `string`            | `.text()`                     | Also handles non-JSON text endpoints |
| `undefined`         | return undefined              | No content-type, 204, HEAD           |
| `Buffer` / `Blob`   | `.blob()` or `.arrayBuffer()` | Needs decision on which type to use  |
| `number`, `boolean` | `.json()`                     | Though unusual as top-level response |

## Implementation Approaches

### A. Single generic fallback (current, flawed)

All non-JSON → `.text()` — fails for binary types.

### B. Content-type based dispatch (recommended)

Inspect content-type at runtime and pick parser. Portable, works for all current example endpoints. The `defaultImplementation` becomes:

```typescript
const defaultImplementation: Implementation = async (method, path, params) => {
  const hasBody = !["get", "head", "delete"].includes(method);
  const searchParams = hasBody ? "" : `?${new URLSearchParams(params)}`;
  const response = await fetch(
    new URL(`${path}${searchParams}`, "http://localhost:8090"),
    {
      method: method.toUpperCase(),
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(params) : undefined,
    },
  );
  const contentType = response.headers.get("content-type");
  if (!contentType) return;
  if (contentType.startsWith("application/json")) return response.json();
  if (
    contentType.startsWith("text/") ||
    contentType.startsWith("application/xml")
  )
    return response.text();
  // Everything else (images, binary, etc.)
  return response.blob();
};
```

### C. Static-content-type dispatch (requires schema awareness)

Determine parser at code-generation time based on the endpoint's known response content types. Requires plumbing `mimeTypes` through `Integration` into `makeDefaultImplementation` and generating per-endpoint branching — more complex but eliminates runtime guessing.

**Recommendation**: Start with **B**. It is simple, correct for existing cases, and keeps the implementation as a single generic function.

## Edge Cases

### 1. Unknown content-type

If content-type is something unexpected, fall back to `.text()` as the safest default. The caller gets a `string` which is wrong for binary types, but throwing would be worse.

### 2. `content-type` with charset or parameters

`content-type` may include `charset=utf-8`, `boundary=---`, etc. `.startsWith()` handles these naturally as long as the base type is matched first:

- `application/json; charset=utf-8` → matches `application/json` ✓
- `text/plain; charset=utf-8` → matches `text/` ✓
- `image/svg+xml; charset=utf-8` → does NOT match `text/` nor `application/json` → falls to `.blob()` ✗

This means `image/svg+xml` needs an explicit check before the generic `image/*` rule:

```typescript
if (contentType.startsWith("application/json")) return response.json();
if (contentType.startsWith("text/") || contentType === "image/svg+xml")
  return response.text();
return response.blob();
```

### 3. No body (204 No Content, HEAD)

Already handled: no `content-type` header → returns `undefined`.

### 4. `application/xml`

XML is text-based, so `.text()` makes sense. The `text/` prefix check already covers `text/xml`. Add `application/xml` explicitly if needed.

### 5. SSE endpoints (`text/event-stream`)

SSE uses `EventSource` in the `Subscription` class, not `fetch`. Not affected.

### 6. Response type `Buffer` / `ez.buffer()`

The generated type says `Buffer` but `.blob()` returns `Blob`. Options:

- Change the generated type to `Blob` (breaking, but more portable)
- Keep `Buffer` and add `Buffer.from(await response.arrayBuffer())` in the implementation (Node.js only)
- Accept the type mismatch as a known limitation (current behavior)

**Recommendation**: This is a separate concern from the parser selection. The parser selection should produce the most appropriate platform-native type (`Blob` for binary). The `Buffer` vs `Blob` type decision should be addressed separately.

## Next Steps

1. Decide on the binary response type (`Buffer` vs `Blob`) for the generated client
2. Implement content-type based dispatch in `makeDefaultImplementation` in `integration-base.ts`
3. Update the generated client types if `Buffer` → `Blob`
4. Update snapshots in `integration.spec.ts`
5. Regenerate `example.client.ts`
6. Verify with example tests
