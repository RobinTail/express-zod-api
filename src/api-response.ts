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

export type NormalizedResponse = Required<
  Pick<ApiResponse<z.ZodTypeAny>, "schema" | "statusCodes" | "mimeTypes">
>;

export type AnyResponseDefinition<S extends z.ZodTypeAny = z.ZodTypeAny> =
  | S // plain schema, default status codes applied
  | ApiResponse<S> // single response definition, status code(s) customizable
  | ApiResponse<S>[]; // Feature #1431: different responses for different status codes

export type LazyResponseDefinition<
  D extends AnyResponseDefinition,
  A extends unknown[] = [],
> = (...args: A) => D;
