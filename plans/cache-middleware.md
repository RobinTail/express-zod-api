# Cache Middleware Plan

Implements a first-class `createCacheMiddleware` following the `createCookieMiddleware` pattern, providing helpers to solve the most frequent HTTP caching problems described in the [MDN HTTP Caching guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching).

## Files Touched

| File                                             | Action                                             |
| ------------------------------------------------ | -------------------------------------------------- |
| `express-zod-api/src/cache-middleware.ts`        | **Create** — middleware factory + types            |
| `express-zod-api/src/endpoint.ts`                | **Edit** — add `writableEnded` guard after handler |
| `express-zod-api/src/index.ts`                   | **Edit** — add export                              |
| `express-zod-api/tests/cache-middleware.spec.ts` | **Create** — full test suite                       |

## Phase 1: Types (`src/cache-middleware.ts`)

### `CachePolicy`

Maps to `Cache-Control` directives from the MDN article:

| Property          | Directive            | When to use (MDN)                                       |
| ----------------- | -------------------- | ------------------------------------------------------- |
| `maxAge`          | `max-age=<seconds>`  | Freshness lifetime                                      |
| `scope`           | `public` / `private` | Private (browser) vs shared (CDN/proxy) caching         |
| `noCache`         | `no-cache`           | Force revalidation on every request                     |
| `noStore`         | `no-store`           | Do not store at any cache                               |
| `mustRevalidate`  | `must-revalidate`    | Stale responses must not be reused without revalidation |
| `proxyRevalidate` | `proxy-revalidate`   | Same as must-revalidate but for shared caches only      |
| `immutable`       | `immutable`          | Never needs revalidation (cache-busted resources)       |

Additionally, `scope` accepts `"public"` or `"private"` — parsed from standalone `public` / `private` directives in the header.

```ts
interface CachePolicy {
  maxAge?: number;
  scope?: "public" | "private";
  noCache?: boolean;
  noStore?: boolean;
  mustRevalidate?: boolean;
  proxyRevalidate?: boolean;
  immutable?: boolean;
}
```

Removed — `createCacheMiddleware` accepts `CachePolicy` directly instead of wrapping it in an options object, since there is only one setting.

## Phase 2: Private helpers

### `formatCacheControl(policy: CachePolicy): string`

Composes a `Cache-Control` header string from a `CachePolicy`:

| Input                                                                           | Output                                                  |
| ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `{ maxAge: 3600, scope: "public" }`                                             | `public, max-age=3600`                                  |
| `{ maxAge: 31536000, scope: "public", immutable: true }`                        | `public, max-age=31536000, immutable`                   |
| `{ noCache: true }`                                                             | `no-cache`                                              |
| `{ noCache: true, scope: "private" }`                                           | `no-cache, private`                                     |
| `{ noStore: true }`                                                             | `no-store`                                              |
| `{ noStore: true, noCache: true, mustRevalidate: true, proxyRevalidate: true }` | `no-store, no-cache, must-revalidate, proxy-revalidate` |

Order of directives in output: `scope` first if present, then `noStore`, `noCache`, `max-age`, then booleans `mustRevalidate`, `proxyRevalidate`, `immutable`.

### `parseCacheControl(header: string | undefined): CachePolicy | undefined`

Parses a `Cache-Control` header string into a `CachePolicy` object. Returns `undefined` when the header is missing or empty. Handles case-insensitive directives, comma separation, and `key=value` pairs.

| Input                                   | Output                                                   |
| --------------------------------------- | -------------------------------------------------------- |
| `"public, max-age=3600"`                | `{ maxAge: 3600, scope: "public" }`                      |
| `"no-cache, private"`                   | `{ noCache: true, scope: "private" }`                    |
| `"max-age=0"`                           | `{ maxAge: 0 }`                                          |
| `"no-store, no-cache, must-revalidate"` | `{ noStore: true, noCache: true, mustRevalidate: true }` |
| `undefined`                             | `undefined`                                              |
| `""`                                    | `undefined`                                              |

Unrecognized directives (e.g. `no-transform`, `only-if-cached`, `min-fresh`, `max-stale`) are silently ignored.

## Phase 3: `createCacheMiddleware` factory

Accepts `CachePolicy` directly (no wrapper object) — opinionated toward best practices.
When no argument is passed, no default `Cache-Control` is applied.

```ts
export const createCacheMiddleware = (defaultPolicy?: CachePolicy) =>
  new Middleware({
    handler: async ({ request, response }) => {
      if (defaultPolicy) {
        response.setHeader("Cache-Control", formatCacheControl(defaultPolicy));
      }
      return {
        // --- Phase 3a: Request getters ---

        /**
         * @desc Reads the If-None-Match request header containing the ETag of the client's cached copy. When the ETag matches the current resource, the server can respond with 304 Not Modified to save bandwidth.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-None-Match
         */
        getIfNoneMatch: (): string | undefined =>
          request.headers["if-none-match"] as string | undefined,

        /**
         * @desc Reads and parses the If-Modified-Since request header containing the timestamp of the client's cached copy into a Date object (invalid or missing dates return undefined). Compare this to the current Last-Modified to decide whether to return 304 Not Modified.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-Modified-Since
         */
        getIfModifiedSince: (): Date | undefined => {
          const value = request.headers["if-modified-since"];
          if (!value) return undefined;
          const date = new Date(value);
          return isNaN(date.getTime()) ? undefined : date;
        },

        /**
         * @desc Reads and parses the request's Cache-Control header into a CachePolicy object. This reveals the client's caching intent — for example max-age=0 during a normal browser reload, or no-cache during a force reload.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control
         */
        getRequestCacheControl: (): CachePolicy | undefined =>
          parseCacheControl(
            request.headers["cache-control"] as string | undefined,
          ),

        // --- Phase 3b: Response setters ---

        /**
         * @desc Sets the Cache-Control response header to control how (and for how long) browsers, proxies and CDNs may cache this response. Use the CachePolicy to configure max-age (freshness lifetime), scope (public vs private), and revalidation behavior.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
         */
        setCachePolicy: (policy: CachePolicy): void => {
          response.setHeader("Cache-Control", formatCacheControl(policy));
        },

        /**
         * @desc Sets the ETag response header with a unique identifier for this version of the resource. On subsequent requests the browser sends this value back in If-None-Match; if it matches, the server can return 304 Not Modified instead of re-sending the payload. Bare values are automatically wrapped in double quotes per the HTTP spec.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag
         */
        setETag: (value: string): void => {
          response.setHeader(
            "ETag",
            value.startsWith('"') ? value : `"${value}"`,
          );
        },

        /**
         * @desc Sets the Last-Modified response header to the timestamp when the resource was last changed. On subsequent requests the browser sends this back in If-Modified-Since; if the resource hasn't changed, the server can return 304 Not Modified. Accepts a Date object, converted to HTTP-date format internally.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Last-Modified
         */
        setLastModified: (date: Date): void => {
          response.setHeader("Last-Modified", date.toUTCString());
        },

        /**
         * @desc Sets the Vary response header to list which request headers influence the response representation. This prevents caches from serving a response intended for one language (Accept-Language) or encoding (Accept-Encoding) to a client expecting another. Accepts one or more header names, joined by commas.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary
         */
        setVary: (...headers: string[]): void => {
          response.setHeader("Vary", headers.join(", "));
        },

        /**
         * @desc Sets the Expires response header with an explicit expiration date (legacy HTTP/1.0 header). When both Expires and Cache-Control max-age are present, max-age takes precedence. Prefer setCachePolicy for modern applications. Accepts a Date object.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Expires
         */
        setExpires: (date: Date): void => {
          response.setHeader("Expires", date.toUTCString());
        },

        /**
         * @desc Sets the Clear-Site-Data response header with the "cache" directive, instructing the browser to remove all cached responses for the origin. Useful after logout, settings changes, or when the user's data is updated.
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Clear-Site-Data
         */
        clearSiteData: (): void => {
          response.setHeader("Clear-Site-Data", '"cache"');
        },

        // --- Phase 3c: 304 short-circuit ---

        /**
         * @desc Sends an HTTP 304 Not Modified response with no body and ends the response stream. Use this when the client's cached copy (identified via If-None-Match or If-Modified-Since) is still valid. The handler must return after calling this, which stops further processing (output validation and response serialization are skipped).
         * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/304
         */
        notModified: (): void => {
          response.status(304).end();
        },
      };
    },
  });
```

## Phase 4: Framework support for `notModified()` (`src/endpoint.ts`)

**Current flow** in `execute()` (lines 303-327):

```
runMiddlewares
if writableEnded return
parseAndRunHandler  ← handler runs here
parseOutput         ← validates handler return
handleResult        ← sends response
```

**Problem**: When the handler calls `notModified()`, the response ends (304), but the framework continues to `#parseOutput` and `#handleResult`, attempting a second write.

**Fix**: Add a `writableEnded` guard after `#parseAndRunHandler` — a one-line addition.

```ts
// After line ~317 (parseAndRunHandler), insert:
if (response.writableEnded) return;
```

This is safe because the middleware loop already uses the same pattern at line 312. After the handler ends the response (via `notModified()`), the guard skips output validation and result handling entirely. No double-write, no error.

**Only in the positive path** — errors thrown from the handler still go to catch and `#handleResult` with error state, which is correct (you wouldn't throw and call `notModified()` simultaneously).

## Phase 5: Export (`src/index.ts`)

Add to the list of named exports:

```ts
export { createCacheMiddleware } from "./cache-middleware";
```

## Phase 6: Tests (`tests/cache-middleware.spec.ts`)

### 6a: Factory

- `createCacheMiddleware()` creates a `Middleware` instance, no default `Cache-Control`
- `createCacheMiddleware({ noCache: true, scope: "private" })` applies the policy as the default `Cache-Control` header

### 6b: Request getters

| Test                                                  | Setup                                                                         | Assertion                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| `getIfNoneMatch` returns value                        | `requestProps.headers["if-none-match"] = '"abc"'`                             | Returns `"abc"`                               |
| `getIfNoneMatch` returns undefined                    | No header                                                                     | Returns `undefined`                           |
| `getIfModifiedSince` returns parsed Date              | `requestProps.headers["if-modified-since"] = "Tue, 22 Feb 2022 22:00:00 GMT"` | Returns `Date` object with correct time       |
| `getIfModifiedSince` returns undefined (no header)    | No header                                                                     | Returns `undefined`                           |
| `getIfModifiedSince` returns undefined (invalid date) | `requestProps.headers["if-modified-since"] = "garbage"`                       | Returns `undefined`                           |
| `getRequestCacheControl` parses max-age               | `requestProps.headers["cache-control"] = "public, max-age=3600"`              | Returns `{ maxAge: 3600, scope: "public" }`   |
| `getRequestCacheControl` parses no-cache              | `requestProps.headers["cache-control"] = "no-cache, private"`                 | Returns `{ noCache: true, scope: "private" }` |
| `getRequestCacheControl` returns undefined            | No header                                                                     | Returns `undefined`                           |
| `getRequestCacheControl` returns undefined (empty)    | `requestProps.headers["cache-control"] = ""`                                  | Returns `undefined`                           |

### 6c: Response setters

| Test                                          | Helper call                                                                                     | Assertion via `responseMock._getHeaders()`                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `setCachePolicy` with maxAge                  | `setCachePolicy({ maxAge: 3600, scope: "public" })`                                             | `cache-control` header is `"public, max-age=3600"`         |
| `setCachePolicy` with no-cache                | `setCachePolicy({ noCache: true })`                                                             | `cache-control` is `"no-cache"`                            |
| `setCachePolicy` with no-store + kitchen-sink | `setCachePolicy({ noStore: true, noCache: true, mustRevalidate: true, proxyRevalidate: true })` | `cache-control` includes all four directives               |
| `setCachePolicy` with immutable               | `setCachePolicy({ maxAge: 31536000, scope: "public", immutable: true })`                        | `cache-control` is `"public, max-age=31536000, immutable"` |
| `setETag` bare                                | `setETag("abc")`                                                                                | `etag` is `"\"abc\""`                                      |
| `setETag` already quoted                      | `setETag('"abc"')`                                                                              | `etag` is `"\"abc\""` (no double wrapping)                 |
| `setLastModified`                             | `setLastModified(new Date("2022-02-22T22:00:00Z"))`                                             | `last-modified` is `"Tue, 22 Feb 2022 22:00:00 GMT"`       |
| `setVary` single                              | `setVary("Accept-Language")`                                                                    | `vary` is `"Accept-Language"`                              |
| `setVary` multiple                            | `setVary("Accept-Language", "Accept-Encoding")`                                                 | `vary` is `"Accept-Language, Accept-Encoding"`             |
| `setExpires`                                  | `setExpires(new Date("2022-02-28T22:22:22Z"))`                                                  | `expires` is `"Mon, 28 Feb 2022 22:22:22 GMT"`             |
| `clearSiteData`                               | `clearSiteData()`                                                                               | `clear-site-data` is `'"cache"'`                           |

### 6d: `notModified()` and `writableEnded` guard

- `notModified()` sets status to 304
- `notModified()` ends the response (verify via `responseMock._isEndCalled()`)
- When `notModified()` is called in the handler, the endpoint execution completes without error
- The response body is empty (304 has no body)

### 6e: Default policy fallback

- `createCacheMiddleware({ noCache: true, scope: "private" })` sets `Cache-Control` header automatically when no `setCachePolicy` is called
- Calling `setCachePolicy` in the handler overrides the default header

### 6f: All helpers present

- Verify all 10 returned properties are functions with `typeof`

## Phase 7: Documentation

Add JSDoc to all exported interfaces and entities per project conventions:

- `@desc` on each property — explain what it does and how to use it
- `@default` for optional properties
- `@example` for literal types (one per variant)
- `@see` with MDN URL for the relevant HTTP spec

```ts
interface CachePolicy {
  /**
   * @desc The freshness lifetime in seconds (max-age). After this time the cached response is considered stale and must be revalidated or re-fetched.
   * @default undefined — no max-age is set, cache lifetime is determined by other directives or heuristic caching
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#max-age
   */
  maxAge?: number;
  /**
   * @desc Restricts which caches may store the response. "public" allows any cache (browser, proxy, CDN). "private" restricts to the browser only — use for responses containing personalized or user-specific content.
   * @default undefined — scope is omitted, cacheability depends on other directives
   * @example "public" — suitable for static assets, API responses without user-specific data
   * @example "private" — suitable for user profiles, dashboards, authenticated content
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#response_directives
   */
  scope?: "public" | "private";
  /**
   * @desc Forces the client to revalidate with the server on every request, even if the cached response is still fresh. The server returns 304 Not Modified if the content hasn't changed, saving bandwidth while ensuring the client always gets the latest version.
   * @default undefined — revalidation is not forced
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#no-cache
   */
  noCache?: boolean;
  /**
   * @desc Prevents caches from storing the response at all. Use sparingly — prefer noCache instead when possible, because it preserves back/forward navigation cache and reduces server load through conditional requests.
   * @default undefined — storage is not prevented
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#no-store
   */
  noStore?: boolean;
  /**
   * @desc Forces caches to revalidate stale responses with the origin server before reusing them. Without this, caches may serve stale data in certain circumstances.
   * @default undefined — caches may serve stale responses under their own heuristics
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#must-revalidate
   */
  mustRevalidate?: boolean;
  /**
   * @desc Same as mustRevalidate, but applies only to shared caches (proxies and CDNs), not to browser caches.
   * @default undefined — shared caches are not forced to revalidate
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#proxy-revalidate
   */
  proxyRevalidate?: boolean;
  /**
   * @desc Indicates that the response body will never change. Used together with a long max-age on cache-busted static assets (e.g. bundle.a1b2c3.js). This tells the browser it never needs to revalidate, even on reload.
   * @default undefined — the resource is not considered immutable
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#immutable
   */
  immutable?: boolean;
}
```
