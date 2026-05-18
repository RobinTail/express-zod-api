# Cookie Support — Implementation Plan

Integrate cookie parsing (`cookie-parser`), cookie input sources, a public cookie-setting middleware, and OpenAPI cookie parameter depiction into express-zod-api.

---

## Phase 1: Configuration & Types

### 1.1 Expand `InputSource` Union

`@types/express-serve-static-core` already declares `cookies: any` and `signedCookies: any` on `Request`, so they're available for `keyof Pick` without any augmentation.

```typescript
export type InputSource = keyof Pick<
  Request,
  | "query"
  | "body"
  | "files"
  | "params"
  | "headers"
  | "cookies"
  | "signedCookies"
>;
```

### 1.3 Add Cookie Parser Config Type

`CookieOptions` already exists in `@types/express-serve-static-core` (for `res.cookie()`). For cookie-parser config, use a distinct name:

```typescript
interface CookieParserOptions {
  /** @desc The secret string or array used by cookie-parser for signed cookies */
  /** @default undefined (no signed cookies) */
  secret?: string | string[];
  /** @desc Custom decode function for cookie values */
  /** @default decodeURIComponent */
  decode?: (val: string) => string;
}
```

### 1.4 Add `cookies` to `ServerConfig`

```typescript
export interface ServerConfig extends CommonConfig {
  // ... existing properties ...

  /**
   * @desc Enable cookie parsing via cookie-parser
   * @requires cookie-parser
   * @example true
   * @example { secret: "my-secret" }
   */
  cookies?: boolean | CookieParserOptions;
}
```

### 1.5 Tests

- **`config-type.spec.ts`**: Verify `CookieOptions` shape, `ServerConfig.cookies` accepts `boolean | CookieOptions`, and `InputSource` includes `"cookies"` and `"signedCookies"`.
- **`common-helpers.spec.ts`**: Verify `getInputSources` recognizes the new sources and `getInput` merges `req.cookies`/`req.signedCookies` when present.

---

## Phase 2: Cookie Parser Integration

### 2.1 Create Cookie Parser in `server.ts`

Following the `compression` pattern (line 73–80), load `cookie-parser` via `loadPeer` and attach it as global middleware. Place it after compression, before `beforeRouting`:

```typescript
if (config.cookies) {
  const cookieParser = await loadPeer("cookie-parser");
  const settings = typeof config.cookies === "object" ? config.cookies : {};
  const { secret, decode } = settings;
  app.use(cookieParser(secret, decode ? { decode } : undefined));
}
```

This means cookie-parser runs on every request when the feature is enabled.

### 2.2 Tests

- **`server.spec.ts`**: Verify cookie parser middleware is registered when `config.cookies` is truthy and absent when falsy.
- **`server-helpers.spec.ts`**: Verify `loadPeer` behavior for `cookie-parser`.

---

## Phase 3: Input Source Plumbing

### 3.1 Update `getInput` in `common-helpers.ts`

No special filtering needed — unlike `"files"` (which checks `areFilesAvailable`), `req.cookies` and `req.signedCookies` are either populated by cookie-parser or `undefined`. `Object.assign` handles `undefined` gracefully.

The existing code already handles this correctly since it does:

```typescript
.reduce<FlatObject>((agg, src) => Object.assign(agg, req[src]), {});
```

The `"cookies"` and `"signedCookies"` sources need no guards added to the `.filter()` chain.

### 3.2 Default Input Sources

`defaultInputSources` stays unchanged — cookies are opt-in:

```typescript
// User enables cookies per-method:
createConfig({
  inputSources: { get: ["query", "params", "cookies", "signedCookies"] },
  cookies: { secret: "my-secret" },
});
```

### 3.3 Tests

- **`common-helpers.spec.ts`**: Verify merged input order (later source overrides earlier when keys collide between `cookies` and `signedCookies`).

---

## Phase 4: Public Cookie-Setting Middleware

### 4.1 New File: `express-zod-api/src/cookie-middleware.ts`

A singleton `Middleware` instance that exposes `setCookie` and `clearCookie` directly into context — no wrapper class needed since middlewares already have access to `response`:

```typescript
import { Middleware } from "./middleware";
import type { CookieOptions } from "express"; // already available from @types/express-serve-static-core

export const cookieMiddleware = new Middleware({
  handler: async ({ response }) => ({
    setCookie: (name: string, value: string, options?: CookieOptions) => {
      response.cookie(name, value, options);
    },
    clearCookie: (
      name: string,
      options?: Pick<CookieOptions, "path" | "domain" | "secure" | "sameSite">,
    ) => {
      response.clearCookie(name, options);
    },
  }),
});
```

Usage:

```typescript
import { cookieMiddleware } from "express-zod-api";

const factory = new EndpointsFactory(defaultResultHandler).addMiddleware(
  cookieMiddleware,
);

const setSession = factory.build({
  method: "post",
  path: "/session",
  output: z.object({ success: z.boolean() }),
  handler: async ({ ctx: { setCookie, clearCookie } }) => {
    setCookie("session", "abc123", { httpOnly: true, path: "/" });
    return { success: true };
  },
});
```

### 4.2 Export in `index.ts`

```typescript
export { cookieMiddleware } from "./cookie-middleware";
```

### 4.3 Tests

- **`cookie-middleware.spec.ts`**: Verify `setCookie` delegates to `response.cookie()`, `clearCookie` delegates to `response.clearCookie()`, and `cookieMiddleware` provides both functions in context.

---

## Phase 5: OpenAPI Documentation

### 5.1 Add `"cookie"` Location in `depictRequestParams`

Extract cookie security names from the security schemas:

```typescript
const securityCookieNames = R.chain(
  R.filter((entry: Security) => entry.type === "cookie"),
  security ?? [],
).map(({ name }) => name);
```

Add `areCookiesEnabled` flag:

```typescript
const areCookiesEnabled =
  inputSources.includes("cookies") || inputSources.includes("signedCookies");
```

Update `getLocation` priority: **path → cookie → header → query**

```typescript
const getLocation = (name: string) => {
  if (areParamsEnabled && pathParams.includes(name)) return "path";
  if (areCookiesEnabled && securityCookieNames.includes(name)) return "cookie";
  if (
    areHeadersEnabled &&
    (isHeader?.(name, method, path) ?? defaultIsHeader(name, securityHeaders))
  )
    return "header";
  if (isQueryEnabled) return "query";
};
```

Cookie is checked before header to avoid misclassification when a property name matches both a cookie and header security scheme (unlikely but safe).

### 5.2 Tests

- **`documentation-helpers.spec.ts`**: Test cookie parameter depiction — properties matching `CookieSecurity` names are placed `in: "cookie"`, others fall through to header/query.
- **`documentation.spec.ts`**: Full integration test — `Documentation` class produces correct OpenAPI output with cookie parameters and security schemes.

---

## Phase 6: Polish & Documentation

### 6.1 README Update

Add a "Cookies" section covering:

- Enabling cookie parsing via `config.cookies`
- Adding `"cookies"`/`"signedCookies"` to `inputSources`
- Using `cookieMiddleware` for setting cookies
- Cookie security schemas for OpenAPI

### 6.2 CHANGELOG

Note the new feature in upcoming version under `Added:`.

### 6.3 Migration

No migration rule needed — no breaking changes to existing public API types.

---

## Implementation Order Summary

```
Phase 1 (Types & config)
  ├── 1.1 Module augmentation
  ├── 1.2 Expand InputSource
  ├── 1.3 CookieOptions type
  ├── 1.4 ServerConfig.cookies
  └── 1.5 Tests

Phase 2 (Parser integration)
  ├── 2.1 Load & attach in server.ts
  └── 2.2 Tests

Phase 3 (Input plumbing)
  ├── 3.1 getInput handles new sources
  └── 3.2 Tests

Phase 4 (Cookie middleware)
  ├── 4.1 cookieMiddleware singleton
  ├── 4.2 Export from index.ts
  └── 4.3 Tests

Phase 5 (OpenAPI docs)
  ├── 5.1 Cookie location in depictRequestParams
  └── 5.2 Tests

Phase 6 (Polish)
  ├── 6.1 README
  ├── 6.2 CHANGELOG
  └── 6.3 (no migration needed)
```
