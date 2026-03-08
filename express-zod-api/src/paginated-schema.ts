import { z } from "zod";

const DEFAULT_MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const DEFAULT_ITEMS_NAME = "items" as const;

/** @desc Common pagination config: shared by offset and cursor styles. */
interface CommonPaginationConfig<
  T extends z.ZodType = z.ZodType,
  K extends string = typeof DEFAULT_ITEMS_NAME,
> {
  /** @desc Zod schema for each item in the paginated list. */
  itemSchema: T;
  /**
   * @desc The name of the property containing the list of items.
   * @default "items"
   * */
  itemsName?: K;
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
interface OffsetPaginatedConfig<
  T extends z.ZodType = z.ZodType,
  K extends string = typeof DEFAULT_ITEMS_NAME,
> extends CommonPaginationConfig<T, K> {
  /** @desc Discriminator for offset-style pagination. */
  style: "offset";
}

/**
 * @desc Configuration for cursor-based pagination (cursor and limit).
 * @example { style: "cursor", itemSchema, maxLimit: 50, defaultLimit: 10 }
 */
interface CursorPaginatedConfig<
  T extends z.ZodType = z.ZodType,
  K extends string = typeof DEFAULT_ITEMS_NAME,
> extends CommonPaginationConfig<T, K> {
  /** @desc Discriminator for cursor-style pagination. */
  style: "cursor";
}

/** @desc Request params for offset pagination. */
type OffsetInput = z.ZodObject<{
  /** @desc Page size (number of items per page). */
  limit: z.ZodDefault<z.ZodCoercedNumber>;
  /** @desc Number of items to skip from the start of the list. */
  offset: z.ZodDefault<z.ZodCoercedNumber>;
}>;

/** @desc Request params for cursor pagination. */
type CursorInput = z.ZodObject<{
  /** @desc Opaque cursor for the next page; omit for the first page. */
  cursor: z.ZodOptional<z.ZodString>;
  /** @desc Page size (number of items per page). */
  limit: z.ZodDefault<z.ZodCoercedNumber>;
}>;

/** @desc Response shape for offset pagination. */
type OffsetOutput<T extends z.ZodType, K extends string> = z.ZodObject<
  {
    /** @desc Page of items for the current request. */
    [ITEMS in K]: z.ZodArray<T>;
  } & {
    /** @desc Total number of items across all pages. */
    total: z.ZodNumber;
    /** @desc Page size used for this response. */
    limit: z.ZodNumber;
    /** @desc Offset used for this response. */
    offset: z.ZodNumber;
  }
>;

/** Keys reserved by offset output shape (itemsName must not match). */
const OFFSET_OUTPUT_RESERVED_KEYS: string[] = [
  "total",
  "limit",
  "offset",
] as const satisfies Array<keyof OffsetOutput<never, never>["shape"]>;

/** @desc Response shape for cursor pagination. */
type CursorOutput<T extends z.ZodType, K extends string> = z.ZodObject<
  {
    /** @desc Page of items for the current request. */
    [ITEMS in K]: z.ZodArray<T>;
  } & {
    /** @desc Cursor for the next page, or null if there are no more pages. */
    nextCursor: z.ZodNullable<z.ZodString>;
    /** @desc Page size used for this response. */
    limit: z.ZodNumber;
  }
>;

/** Keys reserved by cursor output shape (itemsName must not match). */
const CURSOR_OUTPUT_RESERVED_KEYS: string[] = [
  "nextCursor",
  "limit",
] as const satisfies Array<keyof CursorOutput<never, never>["shape"]>;

/** @desc Return type of ez.paginated() for offset style. */
export interface OffsetPaginatedResult<
  T extends z.ZodType = z.ZodType,
  K extends string = typeof DEFAULT_ITEMS_NAME,
> {
  /** @desc Zod schema for offset pagination request params. */
  input: OffsetInput;
  /** @desc Zod schema for offset pagination response. */
  output: OffsetOutput<T, K>;
}

/** @desc Return type of ez.paginated() for cursor style. */
export interface CursorPaginatedResult<
  T extends z.ZodType = z.ZodType,
  K extends string = typeof DEFAULT_ITEMS_NAME,
> {
  /** @desc Zod schema for cursor pagination request params. */
  input: CursorInput;
  /** @desc Zod schema for cursor pagination response. */
  output: CursorOutput<T, K>;
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
export function paginated<
  T extends z.ZodType,
  K extends string = typeof DEFAULT_ITEMS_NAME,
>(config: OffsetPaginatedConfig<T, K>): OffsetPaginatedResult<T, K>;
export function paginated<
  T extends z.ZodType,
  K extends string = typeof DEFAULT_ITEMS_NAME,
>(config: CursorPaginatedConfig<T, K>): CursorPaginatedResult<T, K>;
export function paginated({
  style,
  itemSchema,
  itemsName = DEFAULT_ITEMS_NAME,
  maxLimit = DEFAULT_MAX_LIMIT,
  defaultLimit = DEFAULT_LIMIT,
}: OffsetPaginatedConfig | CursorPaginatedConfig):
  | OffsetPaginatedResult
  | CursorPaginatedResult {
  if (maxLimit <= 0)
    throw new Error("ez.paginated: maxLimit must be greater than 0");
  if (defaultLimit > maxLimit) {
    throw new Error(
      "ez.paginated: defaultLimit must not be greater than maxLimit",
    );
  }
  if (style === "offset" && OFFSET_OUTPUT_RESERVED_KEYS.includes(itemsName)) {
    throw new Error(
      `ez.paginated: itemsName must not match reserved keys for offset output (${OFFSET_OUTPUT_RESERVED_KEYS.join(", ")})`,
    );
  }
  if (style === "cursor" && CURSOR_OUTPUT_RESERVED_KEYS.includes(itemsName)) {
    throw new Error(
      `ez.paginated: itemsName must not match reserved keys for cursor output (${CURSOR_OUTPUT_RESERVED_KEYS.join(", ")})`,
    );
  }
  const limitSchema = z.coerce
    .number()
    .int()
    .min(1)
    .max(maxLimit)
    .default(defaultLimit)
    .describe(`Page size (number of ${itemsName} per page)`);

  if (style === "offset") {
    const offsetSchema = z.coerce
      .number()
      .int()
      .min(0)
      .default(0)
      .describe(`Number of ${itemsName} to skip`);

    const input = z.object({
      limit: limitSchema,
      offset: offsetSchema,
    });

    const output = z.object({
      [itemsName]: z.array(itemSchema).describe(`Page of ${itemsName}`),
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
    [itemsName]: z.array(itemSchema).describe(`Page of ${itemsName}`),
    nextCursor: z
      .string()
      .nullable()
      .describe("Cursor for the next page, or null if no more pages"),
    limit: z.number().int().min(1).describe("Page size used"),
  });

  return { input, output };
}
