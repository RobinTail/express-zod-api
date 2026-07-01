# Global Parsers Plan

Replace selective per-endpoint parser application (PR 1741) with global parser attachment.
Parsers already handle Content-Type detection internally — applying them globally costs
microseconds per non-matching request and eliminates a design limitation exposed by the
QUERY method (which needs both JSON and URL-encoded body parsing).

## Motivation

- **QUERY method needs flexible body parsing** — it can receive JSON or form-encoded bodies
  depending on the client. Selective parsers limit each endpoint to one Content-Type.
- **Parsers self-select by Content-Type** — `express.json()`, `express.urlencoded()`,
  `express.raw()`, and `express-fileupload` all check `Content-Type` and call `next()`
  when it doesn't match. Running them unconditionally adds negligible overhead.
- **Simpler mental model** — endpoints declare their input *schema*, not their wire format.

## Key invariant

`requestType` stays on `AbstractEndpoint`. It continues to drive the documented `mimeType`
in OAS `requestBody.content` (`src/documentation.ts:253`) and the JSON-compatibility
diagnostic (`src/diagnostics.ts:39`). It just stops dictating which parsers run.

## Phases

### Phase 0 — Audit touch points

Complete audit performed via code search across `src/` and `tests/`.

#### Runtime parser pipeline (to be removed/refactored):

```
server.ts:85-90        — Constructs Parsers object { json, raw, form, upload }
     |
     v
routing.ts:68,74       — Accepts parsers, selects matchingParsers via endpoint.requestType
     |
     v
routing.ts:75           — R.pair(matchingParsers, endpoint) — pairs parsers with endpoint
     |
     v
routing.ts:105          — Spreads matchingParsers into route handler chain

endpoint.ts:161-170     — requestType getter determines content type from schema
deep-checks.ts:53-59    — findRequestTypeDefiningSchema() — helper for requestType
```

#### Supporting runtime pieces:

| File | Lines | Role |
|---|---|---|
| `routing.ts` | 26, 33, 68, 74, 75, 91, 105 | `Parsers` type, `InitProps.parsers`, `matchingParsers` selection/destructure/spread, `R.pair` pairing |
| `server.ts` | 15, 85-91 | Imports `Parsers` type, assembles parsers object, passes to `initRouting()` |
| `server-helpers.ts` | 92-117 | `createUploadParsers()` builder (local `parsers` var is `RequestHandler[]`, not `Parsers` type) |
| `endpoint.ts` | 78, 161-170 | `requestType` abstract getter + concrete logic (brand detection) |
| `deep-checks.ts` | 53-59 | `findRequestTypeDefiningSchema()` — helper for `requestType` |
| `content-type.ts` | 1-9 | `ContentType` type and `contentTypes` mapping |

#### `initRouting()` call sites:

| File | Line | Passes parsers? |
|---|---|---|
| `src/server.ts:57` (`attachRouting`) | **No** — users bring their own app/parsers |
| `src/server.ts:91` (`createServer`) | **Yes** — the runtime path we're modifying |
| `tests/routing.spec.ts` (18 calls) | **No** — tests are independent of parser dispatch |

#### Test files that assert parser ordering:

| File | Lines | What it asserts |
|---|---|---|
| `tests/server.spec.ts` | 69-74 | Default `expressJsonMock` in GET handler chain at index 2 |
| `tests/server.spec.ts` | 82-88 | Default `expressJsonMock` in OPTIONS handler chain |
| `tests/server.spec.ts` | 159-165 | Custom `jsonParser` in GET route at index 2 |
| `tests/server.spec.ts` | 166-172 | Custom `jsonParser` in POST route at index 2 |
| `tests/server.spec.ts` | 173-178 | Custom `formParser` in POST /form route at index 2 |
| `tests/server.spec.ts` | 179-186 | Custom `rawParser` + `moveRaw` in PATCH /raw at indices 2-3 |
| `tests/server.spec.ts` | 187-206 | Custom parsers in OPTIONS routes |
| `tests/server.spec.ts` | 308-341 | Upload parsers (uploader + failure handler) before endpoint |
| `tests/server.spec.ts` | 343-369 | Raw parser (`expressRawMock` + `moveRaw`) before endpoint |
| `tests/server.spec.ts` | 371-394 | Form parser (`expressUrlencodedMock`) before endpoint |
| `tests/server.spec.ts` | 397-438 | `attachRouting()` test — NO parsers (confirms it doesn't inject) |
| `tests/server-helpers.spec.ts` | 205-259 | `createUploadParsers()` returns 2-element `RequestHandler[]` |
| `tests/endpoint.spec.ts` | 370-389 | `.requestType` returns correct value per brand — **keep** |
| `tests/express-mock.ts` | 1-3, 24-26 | `expressJsonMock`, `expressRawMock`, `expressUrlencodedMock` definitions and wiring |

#### Non-runtime references (keep as-is):

| File | Lines | Usage |
|---|---|---|
| `diagnostics.ts` | 39 | `requestType` read **only** for JSON-incompatibility warnings |
| `documentation.ts` | 253 | `requestType` read **only** for OpenAPI `mimeType` |
| `integration-base.ts` | 67, 104, 395, 702 | `requestType` is just a code-gen string `"Request"` — unrelated |
| `documentation-helpers.ts` | — | Uses `contentTypes` but not `requestType` directly |
| `endpoint.spec.ts` | 370-389 | Tests `.requestType` getter correctness — must be **preserved** |

#### Key observations:

- `routing.spec.ts` never passes parsers to `initRouting` — tests are already independent of parser dispatch.
- `server.spec.ts` is the primary test file that will need updating: 11 assertion blocks reference parser ordering in route handlers.
- Two `initRouting` call sites: `attachRouting()` (no parsers) and `createServer()` (with parsers). Only the latter changes.
- `R.pair` in `routing.ts:75` is the only parser-relevant `R.pair` in the codebase. All other `R.pair` calls are in unrelated JSON schema helpers and code-gen. After the change it can be simplified to `[[], endpoint] as const`.

### Phase 1 — Simplify routing.ts

1. **Remove `Parsers` type** (line 26) — no longer needed.
2. **Remove `parsers` from `InitProps`** (line 33).
3. **Remove `parsers` parameter from `collectSiblings`** (line 68) and `onEndpoint` (line 74).
4. **Simplify `onEndpoint`**: instead of
   ```typescript
   const matchingParsers = parsers?.[endpoint.requestType] || [];
   const value = R.pair(matchingParsers, endpoint);
   ```
   use
   ```typescript
   const value = [[], endpoint] as const;
   ```
   (the handlers array still gets a slot — just empty).
5. **Simplify handler assembly** (lines 91-108): the `matchingParsers` spread becomes a no-op.
   The handler chain reduces to `[corsHandler?, endpointHandler]`.
6. **Remove `import type { ContentType } from "./content-type"`** if no longer used.

**Ripple**: `server.ts` no longer imports `Parsers` type from `routing.ts`. It still imports `moveRaw` from `server-helpers.ts`.

### Phase 1b — Split CORS: change config type, split into global + route-level

The CORS config changes from `boolean | HeadersProvider` to `boolean | RequestHandler`.
This removes the custom `HeadersProvider` approach — users wanting custom CORS can pass
the well-known `cors` package middleware directly.

The CORS implementation splits into two layers:

1. **Global layer** (in `server.ts`, before parsers):
   - When `cors === true`: sets `Access-Control-Allow-Origin: *` and
     `Access-Control-Allow-Headers: content-type` via a lightweight inline middleware.
   - When `cors` is a `RequestHandler`: mounts that handler (e.g., `cors()` from the
     `cors` package) globally. This replaces the default header behavior.

2. **Route-level layer** (in `initRouting`, stays in `routing.ts`):
   - Sets only `Access-Control-Allow-Methods` with the per-path allowed methods.
   - Still handles the OPTIONS route registration.
   - The `createWrongMethodHandler` still sets `Allow` header for 405 responses.
   - No longer supports `HeadersProvider` overrides — the `config.cors` function
     path is removed from the route handler.

**Changes to `config-type.ts`**:
- Remove `Headers` and `HeadersProvider` types.
- Change `cors` from `boolean | HeadersProvider` to `boolean | RequestHandler`.
- Update JSDoc: remove `@desc You can override the default CORS headers by setting up a provider function here.`
  and add `@example import cors from "cors";` / `config.cors = cors({ origin: "https://example.com" })`.

**Changes to `routing.ts`**:
- Remove `makeCorsHeaders` — no longer needed (global sets Origin/Headers, route sets Methods only).
- Simplify the route-level CORS handler to just `res.set("Access-Control-Allow-Methods", lineUp(accessMethods))`.
- Remove the `typeof config.cors === "function"` branch (the `cors: RequestHandler` case
  is handled globally, and the config function path is removed).
- Remove `AbstractEndpoint` import? No — still used in `Siblings` type and `Diagnostics`.
- Update `Siblings` type if needed (already done in Phase 1).

**Changes to `server.ts`**:
- In `createServer()`, add the global CORS middleware before parsers:
  ```typescript
  if (config.cors === true) {
    app.use((req, res, next) => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Headers", "content-type");
      next();
    });
  } else if (typeof config.cors === "function") {
    app.use(config.cors);
  }
  ```
  This goes after `config.beforeRouting?.({ app, getLogger })` and before parsers.

**Risks**:
- The `HeadersProvider` approach allowed the function to access `endpoint` and `logger`
  for dynamic header customization. Users relying on this must migrate to a `RequestHandler`
  that accesses `req` and `res` directly (same info is available from Express req/res).
- The `Access-Control-Allow-Origin: *` default for `cors: true` is unchanged.

**Test impact**:
- `tests/server.spec.ts`: assertions that check custom CORS headers via `config.cors`
  function behavior need updating. Tests using `cors: true` should verify `app.use` is
  called with the global CORS inline middleware once, and route handlers set
  `Access-Control-Allow-Methods` only.
- `tests/routing.spec.ts`: tests that mock `config.cors` as a function need updating.

### Phase 2 — Move parser attachment to server.ts

In `createServer()`, move parsers from `initRouting()` parameter to global `app.use()`
calls *before* `initRouting()`:

```typescript
// Before (lines 85-91):
const parsers: Parsers = {
  json: [config.jsonParser || express.json()],
  raw: [config.rawParser || express.raw(), moveRaw],
  form: [config.formParser || express.urlencoded()],
  upload: config.upload ? createUploadParsers({ config, getLogger }) : [],
};
initRouting({ app, routing, getLogger, config, parsers });

// After:
app
  .use(config.jsonParser || express.json())
  .use(config.formParser || express.urlencoded())
  .use(config.rawParser || express.raw(), moveRaw);
if (config.upload) {
  app.use(...createUploadParsers({ config, getLogger }));
}
initRouting({ app, routing, getLogger, config });
```

**Note on `moveRaw`**: this middleware transforms `req.body` from Buffer to
`{ raw: Buffer }`. It runs on every request (since it's in the `app.use` chain),
but `Buffer.isBuffer(req.body)` returns false for non-octet-stream bodies, making
it a no-op. We can't guard it by Content-Type because a custom `rawParser` might
match a different type (e.g., `express.raw({ type: 'custom/custom' })`). The
`Buffer.isBuffer` check is a native C++ function — the overhead is immeasurable.

**Important**: ordering must place parsers *after* `beforeRouting` hooks so that
`beforeRouting`-registered routes (e.g., Swagger UI) don't run through body parsers
unnecessarily. The current code does `beforeRouting` then `initRouting` — this ordering
is preserved.

**Note about `attachRouting()`** (line 54-64): this function doesn't set up parsers.
It is used by users integrating with an existing Express app. Those users are
responsible for their own body parsing. No change needed.

### Phase 3 — Config-type JSDoc updates

Update the `formParser` and `rawParser` descriptions to reflect they're now global:

- `jsonParser` (line 185): change `@desc` from "Custom JSON parser" to
  "Custom JSON parser applied to all requests" (remove the implication it's per-endpoint).
- `formParser` (line 223): same treatment — "Custom parser for URL Encoded requests
  applied to all incoming requests".
- `rawParser` (line 217): same — "Custom parser for Buffer payloads applied to all
  incoming requests".

### Phase 4 — Server-helpers polish

In `createUploadParsers()` (`server-helpers.ts:92-117`):

1. **Remove `debug: true` default** (line 108). Without `debug`, express-fileupload
   only processes matching `multipart/form-data` requests silently. Users can still
   pass `debug: true` via `config.upload`.

   ```typescript
   // Before:
   return uploader({
     debug: true,
     ...options,
     abortOnLimit: false,
     parseNested: true,
     logger: createUploadLogger(logger),
   })(request, response, next);

   // After:
   return uploader({
     debug: false,
     ...options,
     abortOnLimit: false,
     parseNested: true,
     logger: createUploadLogger(logger),
   })(request, response, next);
   ```

2. **Consider guarding `beforeUpload`**: currently runs for every request, even
   non-multipart ones. Could be moved inside a `Content-Type` check:

   ```typescript
   parsers.push(async (request, response, next) => {
     if (!request.headers["content-type"]?.startsWith("multipart/form-data")) {
       return next(); // skip entirely for non-upload requests
     }
     const logger = getLogger(request);
     await beforeUpload?.({ request, logger });
     return uploader({ ... })(request, response, next);
   });
   ```

   But this is a design choice: `beforeUpload` exists for side effects like auth checks
   before file processing, which should arguably run for all methods. **Defer decision
   — leave as-is for now.**

### Phase 5 — Test updates

#### `tests/server.spec.ts`

The "Should create server with custom parsers" test (line 93) currently asserts that
custom parsers appear *inside* route handler chains:

```typescript
expect(appMock.get).toHaveBeenCalledWith(
  "/v1/test",
  expect.any(Function), // cors
  configMock.jsonParser,
  expect.any(Function), // endpoint
);
```

After global parsers, parsers are no longer in the route-specific handler chain.
Instead, `app.use()` must be called with them. Update assertions to verify
`app.use` was called with the custom parsers:

```typescript
expect(appMock.use).toHaveBeenCalledWith(configMock.jsonParser);
expect(appMock.use).toHaveBeenCalledWith(configMock.formParser);
expect(appMock.use).toHaveBeenCalledWith(configMock.rawParser, moveRaw);
// Route calls should NOT include parser mocks:
expect(appMock.get).toHaveBeenCalledWith(
  "/v1/test",
  expect.any(Function), // cors only
  expect.any(Function), // endpoint
);
```

Also update the `express.json()` default test (line 56-88 in that file) — currently
verifies `expressJsonMock` appears in route handler. After change, it should verify
`expressJsonMock` is passed to `app.use`.

#### `tests/routing.spec.ts`

Routing tests don't pass parsers — they should continue passing without changes.
Verify the test expectations are correct for the simplified handler chain (no parsers
in the middle).

#### Other tests

Search for any test that asserts parser ordering in route handlers (e.g., line
diffs between with/without `ez.form()` endpoints) and simplify them to not expect
parsers in route-specific calls.

### Phase 6 — Example verification

Once the refactor is complete, the QUERY method test in `example/index.spec.ts`
should work with **both** JSON and URL-encoded bodies.

Update the `listUsersEndpoint` test to demonstrate this — send URL-encoded body
and verify it parses correctly:

```typescript
test("Should respond with URL-encoded body (legacy API ResultHandler)", async ({
  signal,
}) => {
  const response = await fetch(`http://localhost:${port}/v1/user/list`, {
    method: "QUERY",
    signal,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams([
      ["roles", "manager"],
      ["roles", "operator"],
    ]).toString(),
  });
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(json).toMatchSnapshot();
});
```

### Phase 7 — CHANGELOG

Add a changelog entry describing the behavioral change:

```
### vNext

- Parsers (`express.json()`, `express.urlencoded()`, `express.raw()`) are now
  applied globally rather than per-endpoint. This enables any endpoint to accept
  requests in multiple content types (e.g., both JSON and URL-encoded form data).
  The `requestType` property continues to determine the documented MIME type in
  the generated OpenAPI specification. Configured via `jsonParser`, `formParser`,
  and `rawParser` config options as before.
```

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| **express-fileupload `debug: true` logs on every request** | Remove `debug: true` default in Phase 4. Users opt in via `config.upload`. |
| **`beforeUpload` runs for every request** | Acceptable — it's a user-defined hook. If it's expensive, users should guard it themselves. |
| **`moveRaw` runs on every request** | `Buffer.isBuffer()` is a native C++ call — false for most requests, effectively free. Can't guard by Content-Type because custom `rawParser` may use a different `type` option. |
| **Behavior change for existing users** | Non-breaking in practice. Endpoints previously limited to one Content-Type now accept others. Schema validation rejects mismatched shapes regardless. |
| **Custom parsers in `attachRouting()` users** | `attachRouting()` doesn't set up parsers; users of that API are responsible for their own body parsing — unchanged. |

## Future considerations

- If log noise from express-fileupload remains a concern, the `createUploadParsers`
  wrapper could suppress non-multipart debug output by intercepting the logger.
- The `beforeUpload` guard (Phase 4, option 2) could be implemented in a follow-up if
  users report performance concerns with expensive `beforeUpload` hooks running on
  non-upload requests.
