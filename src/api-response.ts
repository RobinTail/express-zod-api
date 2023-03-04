import { z } from "zod";

export interface ApiResponse<S extends z.ZodTypeAny> {
  schema: S;
  /**
   * @default 200 for a positive response
   * @default 400 for a negative response
   * */
  statusCode?: number;
  /**
   * @default "application/json"
   * @override mimeTypes
   * */
  mimeType?: string;
  /** @default [ "application/json" ] */
  mimeTypes?: [string, ...string[]];
}
