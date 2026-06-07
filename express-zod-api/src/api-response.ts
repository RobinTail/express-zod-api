import { z } from "zod";

export type StatusCode = number | "1XX" | "2XX" | "3XX" | "4XX" | "5XX";

export const defaultStatusCodes = {
  positive: 200,
  negative: 400,
} satisfies Record<string, number>;

export type ResponseVariant = keyof typeof defaultStatusCodes;
export const responseVariants = Object.keys(
  defaultStatusCodes,
) as ResponseVariant[];

/**
 * @desc A container for describing an API response: its schema, status code(s) and MIME type(s).
 * @see ResultHandler
 * */
export interface ApiResponse<S extends z.ZodType> {
  /** @desc The Zod schema describing the response body. */
  schema: S;
  /**
   * @desc The status code(s) for this response.
   * @default 200 for a positive response, 400 for a negative one
   * */
  statusCode?: StatusCode | [StatusCode, ...StatusCode[]];
  /**
   * @desc The MIME type(s) of the response.
   * @default "application/json"
   * @example null — no content, typical for 204 and 302
   * */
  mimeType?: string | [string, ...string[]] | null;
}

/**
 * @private This is what the framework entities operate internally.
 * @see normalize
 * */
export interface NormalizedResponse {
  schema: z.ZodType;
  statusCodes: [StatusCode, ...StatusCode[]];
  mimeTypes: [string, ...string[]] | null;
}
