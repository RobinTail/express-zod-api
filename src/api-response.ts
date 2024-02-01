import { z } from "zod";

export const defaultStatusCodes = {
  positive: 200,
  negative: 400,
};

export interface ApiResponse<S extends z.ZodTypeAny> {
  schema: S;
  /**
   * @default 200 for positive response
   * @default 400 for negative response
   * */
  statusCodes?: number | [number, ...number[]];
  /** @default "application/json" */
  mimeTypes?: string | [string, ...string[]];
  /** @deprecated use statusCodes instead */
  statusCode?: never;
  /** @deprecated use mimeTypes instead */
  mimeType?: never;
}

export interface NormalizedResponse {
  schema: z.ZodTypeAny;
  statusCodes: [number, ...number[]];
  mimeTypes: [string, ...string[]];
}

export type AnyResponseDefinition =
  | z.ZodTypeAny // plain schema, default status codes applied
  | ApiResponse<z.ZodTypeAny> // single response definition, status code(s) customizable
  | ApiResponse<z.ZodTypeAny>[]; // Feature #1431: different responses for different status codes

export const normalizeApiResponse = (
  subject: AnyResponseDefinition,
  fallback: Omit<NormalizedResponse, "schema">,
): NormalizedResponse[] => {
  if (subject instanceof z.ZodType) {
    return [{ ...fallback, schema: subject }];
  }
  return (Array.isArray(subject) ? subject : [subject]).map(
    ({ schema, statusCodes, mimeTypes }) => ({
      schema,
      statusCodes:
        typeof statusCodes === "number"
          ? [statusCodes]
          : statusCodes || fallback.statusCodes,
      mimeTypes:
        typeof mimeTypes === "string"
          ? [mimeTypes]
          : mimeTypes || fallback.mimeTypes,
    }),
  );
};
