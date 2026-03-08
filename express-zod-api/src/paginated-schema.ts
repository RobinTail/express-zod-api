import { z } from "zod";

const DEFAULT_MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/** @desc Configuration for offset-based pagination (limit + offset) */
export type OffsetPaginatedConfig<T extends z.ZodType = z.ZodType> = {
  style: "offset";
  /** Schema for each item in the paginated list */
  itemSchema: T;
  /** Maximum allowed page size (default 100) */
  maxLimit?: number;
  /** Default page size when client omits limit (default 20) */
  defaultLimit?: number;
};

/** @desc Configuration for cursor-based pagination (cursor + limit) */
export type CursorPaginatedConfig<T extends z.ZodType = z.ZodType> = {
  style: "cursor";
  /** Schema for each item in the paginated list */
  itemSchema: T;
  /** Maximum allowed page size (default 100) */
  maxLimit?: number;
  /** Default page size when client omits limit (default 20) */
  defaultLimit?: number;
};

type OffsetInput = { limit: number; offset: number };
type CursorInput = { cursor?: string; limit: number };
type OffsetOutput<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};
type CursorOutput<T> = {
  items: T[];
  nextCursor: string | null;
  limit: number;
};

/** @desc Return type of ez.paginated() for offset style: input and output schemas */
export type OffsetPaginatedResult<T extends z.ZodType = z.ZodType> = {
  input: z.ZodType<OffsetInput>;
  output: z.ZodType<OffsetOutput<z.output<T>>>;
};

/** @desc Return type of ez.paginated() for cursor style: input and output schemas */
export type CursorPaginatedResult<T extends z.ZodType = z.ZodType> = {
  input: z.ZodType<CursorInput>;
  output: z.ZodType<CursorOutput<z.output<T>>>;
};

/**
 * Creates a pagination helper with a single config for both request params and response shape.
 * Use the returned `.input` as the endpoint input schema and `.output` as the response schema.
 * Compose with other params via `.input.and(z.object({ ... }))`.
 *
 * @param config - Pagination config; `style` discriminates offset vs cursor; `itemSchema` defines each list item.
 * @returns Object with `input` (Zod schema for pagination params) and `output` (schema for paginated response).
 *
 * @example
 * const pagination = ez.paginated({ style: "offset", maxLimit: 100, defaultLimit: 20, itemSchema: userSchema });
 * input: pagination.input,
 * output: pagination.output,
 */
export function paginated<T extends z.ZodType>(
  config: OffsetPaginatedConfig<T>,
): OffsetPaginatedResult<T>;
export function paginated<T extends z.ZodType>(
  config: CursorPaginatedConfig<T>,
): CursorPaginatedResult<T>;
export function paginated(
  config: OffsetPaginatedConfig | CursorPaginatedConfig,
): OffsetPaginatedResult | CursorPaginatedResult {
  const maxLimit = config.maxLimit ?? DEFAULT_MAX_LIMIT;
  const defaultLimit = config.defaultLimit ?? DEFAULT_LIMIT;
  const itemSchema = config.itemSchema;

  const limitSchema = z.coerce
    .number()
    .int()
    .min(1)
    .max(maxLimit)
    .default(defaultLimit)
    .describe("Page size (number of items per page)");

  if (config.style === "offset") {
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
