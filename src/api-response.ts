import { z } from "zod";

export const defaultStatusCodes = {
  positive: 200,
  negative: 400,
};

export interface NormalizedResponse<S extends z.ZodTypeAny> {
  schema: S;
  /** @default [ "application/json" ] */
  mimeTypes: [string, ...string[]];
  /**
   * @default [200] for positive response
   * @default [400] for negative response
   * */
  statusCodes: [number, ...number[]];
}

type Opt<S extends z.ZodTypeAny> = Pick<NormalizedResponse<S>, "schema"> &
  Partial<Omit<NormalizedResponse<S>, "schema">>;

export interface ApiResponse<S extends z.ZodTypeAny> extends Opt<S> {
  schema: S;
  /**
   * @default 200 for a positive response
   * @default 400 for a negative response
   * @override statusCodes
   * */
  statusCode?: number;
  /**
   * @default "application/json"
   * @override mimeTypes
   * */
  mimeType?: string;
}

export type AnyResponseDefinition =
  | z.ZodTypeAny // plain schema, default status codes applied
  | ApiResponse<z.ZodTypeAny> // single response definition, status code(s) customizable
  | ApiResponse<z.ZodTypeAny>[]; // Feature #1431: different responses for different status codes
