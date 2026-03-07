# Built-in Pagination Helpers (`ez.paginated()`)

## Current state

- **`ez` namespace** lives in `express-zod-api/src/proprietary-schemas.ts` and aggregates helpers from `*-schema.ts`
  files (e.g. `date-in-schema.ts`, `form-schema.ts`). Some helpers use a **brand** for custom OpenAPI/Integration
  handling (e.g. `ezDateInBrand`, `ezFormBrand`); others are plain schema factories.
- **Input** for endpoints is built by `makeFinalInputSchema(factorySchema, buildSchema)` in `endpoints-factory.ts` and
  merged from request `query` / `body` / `params` / `headers` per `config.inputSources` (GET defaults to
  `["query", "params"]`). So pagination query params are already merged into a single object and validated against the
  endpoint's input schema.
- **OpenAPI** in `documentation-helpers.ts` uses `depict()` and a `depicters` map keyed by brand or Zod type;
  request/response are derived from the schema. **Integration** in `integration.ts` uses `zodToTs()` with the same
  schema and optional `brandHandling`. Plain `z.object()` schemas are depicted and typed without any special handling.
- **No existing pagination primitive** in the repo; there is only an ad-hoc `cursor` example in
  `documentation.spec.ts` (Issue #929).

---

## API design: config-based, no overloads

**`ez.paginated(config)`** accepts a single configuration object and returns an object with:

- **`input`** — Zod schema for incoming pagination params (query/body). Use as endpoint input, optionally composed with
  `.and(otherSchema)`.
- **`output(itemSchema)`** — Method that takes the item schema and returns the paginated response schema. No need to
  repeat `style` or other config.

**`style`** is the discriminator: it defines which config properties are allowed and what the input/output shapes are.

### Code sample: offset-based pagination

```ts
import { z } from "zod";
import { defaultEndpointsFactory, ez } from "express-zod-api";

const userSchema = z.object({ id: z.number(), name: z.string() });

// One config for both input and output
const pagination = ez.paginated({
  style: "offset",
  maxLimit: 100,
  defaultLimit: 20,
});

const listUsersEndpoint = defaultEndpointsFactory.build({
  method: "get",
  input: pagination.input,
  output: pagination.output(userSchema),
  handler: async ({ input: { limit, offset } }) => {
    const [items, total] = await db.users.findAndCount({
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  },
});
```

### Code sample: cursor-based pagination

```ts
const pagination = ez.paginated({
  style: "cursor",
  maxLimit: 50,
  defaultLimit: 20,
});

const listPostsEndpoint = defaultEndpointsFactory.build({
  method: "get",
  input: pagination.input,
  output: pagination.output(postSchema),
  handler: async ({ input: { cursor, limit } }) => {
    const { items, nextCursor, hasMore } = await db.posts.findPage({
      cursor,
      limit,
    });
    return { items, nextCursor, hasMore, limit };
  },
});
```

### Code sample: composable input (pagination + filters)

```ts
const pagination = ez.paginated({
  style: "offset",
  maxLimit: 100,
  defaultLimit: 20,
});

const listUsersEndpoint = defaultEndpointsFactory.build({
  method: "get",
  input: pagination.input.and(
    z.object({
      search: z.string().optional(),
      role: z.enum(["admin", "user"]).optional(),
    }),
  ),
  output: pagination.output(userSchema),
  handler: async ({ input: { limit, offset, search, role } }) => {
    // ...
  },
});
```

---

## Config and styles (discriminated by `style`)

### Common options (both styles)

- **`maxLimit`** (optional) — Maximum allowed page size (default e.g. 100).
- **`defaultLimit`** (optional) — Default page size when client omits it (default e.g. 20).

### Style: `"offset"`

**Allowed config:** `style: "offset"`, `maxLimit?`, `defaultLimit?`.

**Input schema shape:** `{ limit, offset }`

- `limit`: number, coerced from query, min 1, max `maxLimit`, default `defaultLimit`.
- `offset`: number, coerced from query, min 0, default 0.

**Output schema shape (from `output(itemSchema)`):** `{ items: T[], total: number, limit: number, offset: number }`.

### Style: `"cursor"`

**Allowed config:** `style: "cursor"`, `maxLimit?`, `defaultLimit?`, and optionally `cursorKey?` (default `"cursor"`),
`limitKey?` (default `"limit"`) if we support custom param names.

**Input schema shape:** `{ cursor?, limit }`

- `cursor`: string, optional (first page has no cursor).
- `limit`: number, same rules as offset style.

**Output schema shape:** `{ items: T[], nextCursor: string | null, hasMore?: boolean, limit: number }`.

Use `z.coerce` for numeric input fields so query string values are coerced. Apply `.default()` so the handler receives
typed numbers.

---

## Design decisions

1. **No new brand**  
   Input and output are plain `z.object()` schemas so OpenAPI and Integration work without custom depicters or ZTS
   producers.

2. **Single entry point, no overloads**  
   `ez.paginated(config)` returns `{ input, output(itemSchema) }`. Config is defined once; style drives both schemas.

3. **Style as discriminator**  
   TypeScript config types can be discriminated unions (e.g. `OffsetPaginatedConfig | CursorPaginatedConfig`) so
   style-specific options are type-safe. Implementation branches on `config.style` to build the right input/output
   schemas.

4. **Composability**  
   `pagination.input` is a normal ZodObject, so users can `.and(z.object({ ... }))` for filters or other query params.

---

## Implementation plan

### 1. New module: `express-zod-api/src/paginated-schema.ts`

**Function signature:**

```ts
// Discriminated config types
type OffsetPaginatedConfig = {
  style: "offset";
  maxLimit?: number;
  defaultLimit?: number;
};

type CursorPaginatedConfig = {
  style: "cursor";
  maxLimit?: number;
  defaultLimit?: number;
  cursorKey?: string;  // default "cursor"
  limitKey?: string;  // default "limit"
};

type PaginatedConfig = OffsetPaginatedConfig | CursorPaginatedConfig;

// Return type: object with input schema and output(schema) method
type PaginatedResult = {
  input: z.ZodObject<...>;  // shape depends on config.style
  output: <T extends z.ZodType>(itemSchema: T) => z.ZodObject<...>;
};

export function paginated(config: PaginatedConfig): PaginatedResult;
```

**Implementation outline:**

- If `config.style === "offset"`: build input schema with `limit` and `offset` (coerced, defaults). Build output factory
  that returns `z.object({ items: z.array(itemSchema), total, limit, offset })`.
- If `config.style === "cursor"`: build input schema with `cursor` (optional string) and `limit`. Build output factory
  that returns
  `z.object({ items: z.array(itemSchema), nextCursor: z.string().nullable(), hasMore: z.boolean().optional(), limit })`.
- Return `{ input, output }` where `output` is a function that closes over the config and returns the appropriate output
  schema for the given item schema.
- Add `.describe()` on each field where useful for OpenAPI (e.g. "Page size", "Number of items to skip", "Cursor for the
  next page").

### 2. Wire into `ez`

- In `proprietary-schemas.ts`: import `paginated` from `./paginated-schema` and add to `ez`:  
  `export const ez = { dateIn, dateOut, form, upload, raw, buffer, paginated };`.
- No new brand or `ProprietaryBrand` member.

### 3. OpenAPI and Integration

- No changes in `documentation-helpers.ts`, `documentation.ts`, `zts.ts`, or `integration.ts`. Schemas are plain
  objects. Optional: enrich OpenAPI via `.describe()` in `paginated-schema.ts`.

### 4. Tests

- **Unit:** Parse input `{ limit: "10", offset: "0" }` (and cursor variant) and assert parsed shape and defaults. Parse
  output `{ items: [...], total: 42, limit: 10, offset: 0 }` (and cursor variant) with a simple item schema. Edge cases:
  missing params, defaults, maxLimit.
- **OpenAPI snapshot:** Endpoint with `input: pagination.input`, `output: pagination.output(userSchema)`; snapshot spec
  for query params and response schema.
- **Integration:** Generate client for the same endpoint; confirm request/response types include pagination fields.

### 5. Documentation and types

- JSDoc on `paginated()`: describe config (style, limits), return type `{ input, output(itemSchema) }`, and
  composability (e.g. `pagination.input.and(...)`). Export `PaginatedConfig` (or style-specific types) from
  `paginated-schema.ts` if useful for the public API.

### 6. Optional follow-ups (out of scope)

- Brand + custom depicters for "Paginated response" in OpenAPI.
- Helpers like `getNextPageParams(input, output)` for cursor style.
- `total` in cursor style via an option.

---

## Files to add/change

| Action | File                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Add    | `express-zod-api/src/paginated-schema.ts` — `paginated(config)` returning `{ input, output(itemSchema) }`, style-discriminated config |
| Edit   | `express-zod-api/src/proprietary-schemas.ts` — add `paginated` to `ez`                                                                |
| Add    | `express-zod-api/tests/paginated-schema.spec.ts` — unit tests + OpenAPI snapshot                                                      |
| Edit   | `express-zod-api/src/index.ts` — only if exporting new types (e.g. `PaginatedConfig`)                                                 |

---

## Data flow

Unchanged: request (e.g. GET `?limit=10&offset=0`) → `getInput()` merges `query` → `inputSchema.parseAsync(input)` (e.g.
`pagination.input` or `pagination.input.and(...)`) → handler gets `{ limit, offset }` (or cursor variant). Handler
returns `{ items, total, limit, offset }` (or cursor variant) → `outputSchema.parseAsync()` → response. OpenAPI and
Integration consume the same schemas.

---

## Summary

- **`ez.paginated(config)`** returns `{ input, output(itemSchema) }`. One config drives both input and output; no
  overloads, no repeated options.
- **`style`** discriminates offset vs cursor: allowed config props and input/output shapes.
- Plain `z.object()` schemas; no new brand. Optional `.describe()` for better OpenAPI.
- Single new file `paginated-schema.ts`, wire into `ez`, add tests and JSDoc.
