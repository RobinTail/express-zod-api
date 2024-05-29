import { z } from "zod";

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

export type AnyApiResponse<S extends z.ZodTypeAny = z.ZodTypeAny> =
  | S // plain schema, default status codes applied
  | ApiResponse<S> // single response definition, status code(s) customizable
  | ApiResponse<S>[]; // Feature #1431: different responses for different status codes

export type LazyResponse<D extends AnyApiResponse, A extends unknown[] = []> = (
  ...args: A
) => D;

export type NormalizedResponse = Required<
  Pick<ApiResponse<z.ZodTypeAny>, "schema" | "statusCodes" | "mimeTypes">
>;

export const normalize = <A extends unknown[]>(
  subject: AnyApiResponse | LazyResponse<AnyApiResponse, A>,
  features: {
    arguments: A;
    statusCodes: [number, ...number[]];
    mimeTypes: [string, ...string[]];
  },
): NormalizedResponse[] => {
  if (typeof subject === "function") {
    return normalize(subject(...features.arguments), features);
  }
  if (subject instanceof z.ZodType) {
    return [{ ...features, schema: subject }];
  }
  return (Array.isArray(subject) ? subject : [subject]).map(
    ({ schema, statusCodes, statusCode, mimeTypes, mimeType }) => ({
      schema,
      statusCodes: statusCode
        ? [statusCode]
        : statusCodes || features.statusCodes,
      mimeTypes: mimeType ? [mimeType] : mimeTypes || features.mimeTypes,
    }),
  );
};
