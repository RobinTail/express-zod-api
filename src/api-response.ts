import { z } from "zod";

export const defaultStatusCodes = {
  positive: 200,
  negative: 400,
} satisfies Record<string, number>;

export type ResponseVariant = keyof typeof defaultStatusCodes;

export interface ApiResponse<S extends z.ZodTypeAny> {
  schema: S;
  /** @default 200 for a positive and 400 for a negative response */
  statusCode?: number | [number, ...number[]];
  /**
   * @example [] for no content, such as 204 and 302
   * @default "application/json"
   * */
  mimeType?: string | string[];
  /** @deprecated use statusCode */
  statusCodes?: never;
  /** @deprecated use mimeType */
  mimeTypes?: never;
}

export type NormalizedResponse = Pick<ApiResponse<z.ZodTypeAny>, "schema"> & {
  statusCodes: Extract<ApiResponse<z.ZodTypeAny>["statusCode"], Array<unknown>>;
  mimeTypes: Extract<ApiResponse<z.ZodTypeAny>["mimeType"], Array<unknown>>;
};
