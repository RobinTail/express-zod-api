import { z } from "zod";
import { MimeDefinition, mimeJson } from "./mime";

export type ApiResponse<A = z.ZodTypeAny> = {
  schema: A;
  /** @default application/json */
  mimeTypes?: string[];
  /** @default 200 for a positive response, 400 for a negative response */
  statusCode?: number;
};

type ApiResponseCreationProps<S extends z.ZodTypeAny> = {
  schema: S;
  statusCode?: number;
} & ({ mimeTypes?: [string, ...string[]] } | { mimeType?: string });

export function createApiResponse<S extends z.ZodTypeAny>(
  schema: S,
  mimeTypes?: MimeDefinition // @todo remove in v9
): ApiResponse<S>;

export function createApiResponse<S extends z.ZodTypeAny>(
  props: ApiResponseCreationProps<S>
): ApiResponse<S>;

export function createApiResponse<S extends z.ZodTypeAny>(
  param1: S | ApiResponseCreationProps<S>,
  param2: MimeDefinition | undefined = mimeJson // @todo remove in v9
): ApiResponse<S> {
  if (param1 instanceof z.ZodType) {
    return {
      schema: param1,
      mimeTypes: typeof param2 === "string" ? [param2] : param2, // @todo set to undefined in v9
    };
  }
  return {
    schema: param1.schema,
    mimeTypes:
      "mimeType" in param1 && param1.mimeType
        ? [param1.mimeType]
        : "mimeTypes" in param1
        ? param1.mimeTypes
        : [mimeJson],
    statusCode: "statusCode" in param1 ? param1.statusCode : undefined,
  };
}
