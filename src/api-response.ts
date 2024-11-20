import { z } from "zod";

export const defaultStatusCodes = {
  positive: 200,
  negative: 400,
} satisfies Record<string, number>;

export type ResponseVariant = keyof typeof defaultStatusCodes;

/** @public this is the user facing configuration */
export interface ApiResponse<S extends z.ZodTypeAny> {
  schema: S;
  /** @default 200 for a positive and 400 for a negative response */
  statusCode?: number | [number, ...number[]];
  /** @default "application/json" */
  mimeType?: string | [string, ...string[]];
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
  schema: z.ZodTypeAny;
  statusCodes: [number, ...number[]];
  mimeTypes: [string, ...string[]];
}
