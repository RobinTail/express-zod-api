import { z } from "zod";

const DEFAULT_MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/** @desc Common pagination config: shared by offset and cursor styles. */
export interface CommonPaginationConfig<T extends z.ZodType = z.ZodType> {
  /** @desc Zod schema for each item in the paginated list. */
  itemSchema: T;
  /**
   * @desc Maximum allowed page size (client request is capped to this).
   * @default 100
   */
  maxLimit?: number;
  /**
   * @desc Default page size when the client omits the limit parameter.
   * @default 20
   */
  defaultLimit?: number;
}

/**
 * @desc Configuration for offset-based pagination (limit and offset).
 * @example { style: "offset", itemSchema, maxLimit: 50, defaultLimit: 10 }
 */
export interface OffsetPaginatedConfig<
  T extends z.ZodType = z.ZodType,
> extends CommonPaginationConfig<T> {
  /** @desc Discriminator for offset-style pagination. */
  style: "offset";
}

/**
 * @desc Configuration for cursor-based pagination (cursor and limit).
 * @example { style: "cursor", itemSchema, maxLimit: 50, defaultLimit: 10 }
 */
export interface CursorPaginatedConfig<
  T extends z.ZodType = z.ZodType,
> extends CommonPaginationConfig<T> {
  /** @desc Discriminator for cursor-style pagination. */
  style: "cursor";
}

/** @desc Request params for offset pagination. */
interface OffsetInput {
  /** @desc Page size (number of items per page). */
  limit: number;
  /** @desc Number of items to skip from the start of the list. */
  offset: number;
}

/** @desc Request params for cursor pagination. */
interface CursorInput {
  /** @desc Opaque cursor for the next page; omit for the first page. */
  cursor?: string;
  /** @desc Page size (number of items per page). */
  limit: number;
}

/** @desc Response shape for offset pagination. */
interface OffsetOutput<T> {
  /** @desc Page of items for the current request. */
  items: T[];
  /** @desc Total number of items across all pages. */
  total: number;
  /** @desc Page size used for this response. */
  limit: number;
  /** @desc Offset used for this response. */
  offset: number;
}

/** @desc Response shape for cursor pagination. */
interface CursorOutput<T> {
  /** @desc Page of items for the current request. */
  items: T[];
  /** @desc Cursor for the next page, or null if there are no more pages. */
  nextCursor: string | null;
  /** @desc Page size used for this response. */
  limit: number;
}

/** @desc Return type of ez.paginated() for offset style. */
export interface OffsetPaginatedResult<T extends z.ZodType = z.ZodType> {
  /** @desc Zod schema for offset pagination request params. */
  input: z.ZodType<OffsetInput>;
  /** @desc Zod schema for offset pagination response. */
  output: z.ZodType<OffsetOutput<z.output<T>>>;
}

/** @desc Return type of ez.paginated() for cursor style. */
export interface CursorPaginatedResult<T extends z.ZodType = z.ZodType> {
  /** @desc Zod schema for cursor pagination request params. */
  input: z.ZodType<CursorInput>;
  /** @desc Zod schema for cursor pagination response. */
  output: z.ZodType<CursorOutput<z.output<T>>>;
}

/**
 * @desc Creates a pagination helper with a single config for both request params and response shape.
 * Use the returned `.input` as the endpoint input schema and `.output` as the response schema.
 * Compose with other params via `.input.and(z.object({ ... }))`.
 *
 * @param config - Pagination config; `style` discriminates offset vs cursor; `itemSchema` defines each list item.
 * @returns Object with `input` (Zod schema for pagination params) and `output` (Zod schema for paginated response).
 *
 * @example
 * const pagination = ez.paginated({ style: "offset", maxLimit: 100, defaultLimit: 20, itemSchema: userSchema });
 * endpoint.input = pagination.input.and(z.object({ ... }));
 * endpoint.output = pagination.output;
 */
export function paginated<T extends z.ZodType>(
  config: OffsetPaginatedConfig<T>,
): OffsetPaginatedResult<T>;
export function paginated<T extends z.ZodType>(
  config: CursorPaginatedConfig<T>,
): CursorPaginatedResult<T>;
export function paginated({
  style,
  itemSchema,
  maxLimit = DEFAULT_MAX_LIMIT,
  defaultLimit = DEFAULT_LIMIT,
}: OffsetPaginatedConfig | CursorPaginatedConfig):
  | OffsetPaginatedResult
  | CursorPaginatedResult {
  const limitSchema = z.coerce
    .number()
    .int()
    .min(1)
    .max(maxLimit)
    .default(defaultLimit)
    .describe("Page size (number of items per page)");

  if (style === "offset") {
    const offsetSchema = z.coerce
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Number of items to skip");

    const input = z.object({
      limit: limitSchema,
      offset: offsetSchema,
    });

    const output = z.object({
      items: z.array(itemSchema).describe("Page of items"),
      total: z.number().int().min(0).describe("Total number of items"),
      limit: z.number().int().min(1).describe("Page size used"),
      offset: z.number().int().min(0).describe("Offset used"),
    });

    return { input, output };
  }

  // cursor style
  const cursorSchema = z
    .string()
    .optional()
    .describe("Cursor for the next page; omit for first page");

  const input = z.object({
    cursor: cursorSchema,
    limit: limitSchema,
  });

  const output = z.object({
    items: z.array(itemSchema).describe("Page of items"),
    nextCursor: z
      .string()
      .nullable()
      .describe("Cursor for the next page, or null if no more pages"),
    limit: z.number().int().min(1).describe("Page size used"),
  });

  return { input, output };
}
