# Plan: Represent `ez.buffer()` as `Blob` in Generated Client Types

## Observation

`zodToTs` in `zts.ts` is only called from `integration.ts` (client generation) — never from documentation or server-side code. Documentation has its own `depictBuffer` handler in `documentation-helpers.ts`. So `onBuffer` exclusively generates types for the client code.

This means there is no tension between server-side `Buffer` and client-side `Blob`: the producer is already client-only.

## Current State

`zts.ts:222`:

```typescript
const onBuffer: Producer = () => ensureTypeNode("Buffer");
```

Emits `Buffer` for both input and output client types. But `Buffer` doesn't exist in browsers, and the generated `Client` class already targets Web APIs (`fetch`, `URL`, `EventSource`).

## Problem

| Context                                                                                    | Generated type | Runtime value                               | Mismatch? |
| ------------------------------------------------------------------------------------------ | -------------- | ------------------------------------------- | --------- |
| **Output** — `ez.buffer()` in factory output schema (e.g. `fileStreamingEndpointsFactory`) | `Buffer`       | `Blob` (per parser plan: `response.blob()`) | Yes       |
| **Input** — `ez.raw()` wrapping `ez.buffer()` for raw body endpoints                       | `Buffer`       | `Blob` / `File` / `FormData` (browser send) | Yes       |

Both should be `Blob` for the generated client.

## Change

### `zts.ts` — `onBuffer` producer

From:

```typescript
const onBuffer: Producer = () => ensureTypeNode("Buffer");
```

To:

```typescript
const onBuffer: Producer = () => ensureTypeNode("Blob");
```

The `isResponse` flag is not needed here — both input and output client types should use `Blob`.

### Downstream: `example.client.ts`

`PostV1AvatarRawInput = Buffer` → `PostV1AvatarRawInput = Blob`
`GetV1AvatarStreamPositiveVariant1 = Buffer` → `GetV1AvatarStreamPositiveVariant1 = Blob`

### Other usages of `ez.buffer()`

Any `ez.buffer()` in the generated `Input` or response variant types will change from `Buffer` to `Blob`.

## Browser Sending Binary Data

For input (sending), a browser would use:

```typescript
// Blob (from canvas, fetch, etc.)
const binaryData: Blob = /* ... */;
client.provide("post /v1/avatar/raw", binaryData);

// Or File (subclass of Blob, from <input type="file">)
const file: File = fileInput.files[0];
client.provide("post /v1/avatar/raw", file);
```

The `defaultImplementation` currently sends `JSON.stringify(params)` for the body. Raw binary endpoints need a different approach — the implementation should detect a `Blob` body and send it directly:

```typescript
body: params instanceof Blob ? params : hasBody ? JSON.stringify(params) : undefined,
```

This is a separate concern from the type generation, but should be addressed alongside it for consistency.

## Compatibility

`Blob` is available in:

- All modern browsers
- Node.js 20+ (globally, `node:buffer` polyfill not needed)
- Bun, Deno

Breaking change for existing users relying on `Buffer` methods on the result. CHANGELOG should document migration:

```typescript
// Before (Buffer):
buffer.toString("utf-8");
buffer.length;

// After (Blob):
await blob.text(); // string
blob.size; // bytes count
new Uint8Array(await blob.arrayBuffer()); // raw bytes
```

## Steps

1. Edit `onBuffer` in `zts.ts` line 222: `"Buffer"` → `"Blob"`
2. Regenerate `example.client.ts`
3. Update integration snapshots
4. Update CHANGELOG with breaking change note
5. Adjust `defaultImplementation` to handle `Blob` request bodies for raw endpoints
