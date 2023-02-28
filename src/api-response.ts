import { z } from "zod";

export type ApiResponse<S = z.ZodTypeAny> = {
  schema: S;
  /** @default 200 for a positive response, 400 for a negative response */
  statusCode?: number;
} & (
  | {
      /** @default [application/json] */
      mimeTypes?: string[];
    }
  | {
      /** @default application/json */
      mimeType?: string;
    }
);

/**
 * @deprecated replace with { schema, mimeType } or { schema, mimeTypes } object
 * @todo remove in v9
 */
export const createApiResponse = <S extends z.ZodTypeAny>(
  schema: S,
  mimeTypes?: string | [string, ...string[]]
): ApiResponse<S> => ({
  schema,
  ...(typeof mimeTypes === "string" && mimeTypes
    ? { mimeType: mimeTypes }
    : {}),
  ...(typeof mimeTypes === "string" ? {} : { mimeTypes }),
});
