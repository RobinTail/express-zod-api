import { z } from "zod/v4";

export const defaultStatusCodes = {
  positive: 200,
  negative: 400,
} satisfies Record<string, number>;

export type ResponseVariant = keyof typeof defaultStatusCodes;
export const responseVariants = Object.keys(
  defaultStatusCodes,
) as ResponseVariant[];

/** @public this is the user facing configuration */
export interface ApiResponse<S extends z.ZodType> {
  schema: S;
  /** @default 200 for a positive and 400 for a negative response */
  statusCode?: number | [number, ...number[]];
  /**
   * @example null is for no content, such as 204 and 302
   * @default "application/json"
   * */
  mimeType?: string | [string, ...string[]] | null;
  /** @deprecated use statusCode */
  statusCodes?: never;
  /** @deprecated use mimeType */
  mimeTypes?: never;
}

/**
 * @private This is what the framework entities operate
 * @see normalize
 * */
export interface NormalizedResponse {
  schema: z.ZodType;
  statusCodes: [number, ...number[]];
  mimeTypes: [string, ...string[]] | null;
}
