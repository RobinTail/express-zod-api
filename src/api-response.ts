import { z } from "zod";

export type ApiResponse<S extends z.ZodType> = {
  schema: S;
  /**
   * @default 200 for a positive response
   * @default 400 for a negative response
   * */
  statusCode?: number;
  /**
   * @default "application/json"
   * @override mimeTypes
   * */
  mimeType?: string;
  /** @default [ "application/json" ] */
  mimeTypes?: [string, ...string[]];
};

/**
 * @deprecated replace with just a schema, or { schema, mimeType } or { schema, mimeTypes } object
 * @todo remove in v9
 */
export const createApiResponse = <S extends z.ZodType>(
  schema: S,
  mimeDefinition?: string | [string, ...string[]]
): ApiResponse<S> => ({
  schema,
  ...(typeof mimeDefinition === "string"
    ? { mimeType: mimeDefinition }
    : { mimeTypes: mimeDefinition }),
});
