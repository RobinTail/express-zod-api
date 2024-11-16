import { z } from "zod";

export const defaultStatusCodes = {
  positive: 200,
  negative: 400,
} satisfies Record<string, number>;

export type ResponseVariant = keyof typeof defaultStatusCodes;

export interface NormalizedResponse {
  schema: z.ZodTypeAny;
  statusCodes: [number, ...number[]];
  mimeTypes: [string, ...string[]];
}

export interface ApiResponse<S extends z.ZodTypeAny> {
  schema: S;
  /**
   * @default 200 for a positive response
   * @default 400 for a negative response
   * */
  statusCode?:
    | NormalizedResponse["statusCodes"]
    | NormalizedResponse["statusCodes"][number];
  /** @default "application/json" */
  mimeType?:
    | NormalizedResponse["mimeTypes"]
    | NormalizedResponse["mimeTypes"][number];
  /** @deprecated use statusCode */
  statusCodes?: never;
  /** @deprecated use mimeType */
  mimeTypes?: never;
}
