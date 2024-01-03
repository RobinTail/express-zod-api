import { z } from "zod";

export const defaultStatusCodes = {
  positive: 200,
  negative: 400,
};

export interface ApiResponse<S extends z.ZodTypeAny> {
  schema: S;
  /**
   * @default 200 for a positive response
   * @default 400 for a negative response
   * @override statusCodes
   * */
  statusCode?: number;
  /**
   * @default [200] for positive response
   * @default [400] for negative response
   * */
  statusCodes?: [number, ...number[]];
  /**
   * @default "application/json"
   * @override mimeTypes
   * */
  mimeType?: string;
  /** @default [ "application/json" ] */
  mimeTypes?: [string, ...string[]];
}

export type NormalizedResponse = Required<
  Pick<ApiResponse<z.ZodTypeAny>, "schema" | "statusCodes" | "mimeTypes">
>;

export const normalizeApiResponse = (
  subject:
    | z.ZodTypeAny
    | ApiResponse<z.ZodTypeAny>
    | ApiResponse<z.ZodTypeAny>[],
  fallback: Omit<NormalizedResponse, "schema">,
): NormalizedResponse[] => {
  if (subject instanceof z.ZodType) {
    return [{ ...fallback, schema: subject }];
  }
  return (Array.isArray(subject) ? subject : [subject]).map(
    ({ schema, statusCodes, statusCode, mimeTypes, mimeType }) => ({
      schema,
      statusCodes: statusCode
        ? [statusCode]
        : statusCodes || fallback.statusCodes,
      mimeTypes: mimeType ? [mimeType] : mimeTypes || fallback.mimeTypes,
    }),
  );
};
