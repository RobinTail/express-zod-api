import { z } from "zod";
import { MimeDefinition, mimeJson } from "./mime";

export type ApiResponse<A = z.ZodTypeAny> = {
  schema: A;
  mimeTypes: string[];
};

type ApiResponseCreationProps<S extends z.ZodTypeAny> = {
  schema: S;
} & (
  | {
      mimeTypes?: string[];
    }
  | {
      mimeType?: string;
    }
);

/**
 * @deprecated Use the overload below that accepts object
 * @todo remove in v9
 * */
export function createApiResponse<S extends z.ZodTypeAny>(
  schema: S,
  mimeTypes?: MimeDefinition
): ApiResponse<S>;

export function createApiResponse<S extends z.ZodTypeAny>(
  props: ApiResponseCreationProps<S>
): ApiResponse<S>;

export function createApiResponse<S extends z.ZodTypeAny>(
  param1: S | ApiResponseCreationProps<S>,
  param2: MimeDefinition | undefined = mimeJson
): ApiResponse<S> {
  if (param1 instanceof z.ZodType) {
    // @todo remove this block in v9
    return {
      schema: param1,
      mimeTypes: typeof param2 === "string" ? [param2] : param2,
    };
  }
  return {
    schema: param1.schema,
    mimeTypes:
      "mimeType" in param1
        ? [param1.mimeType || mimeJson]
        : "mimeTypes" in param1
        ? param1.mimeTypes || [mimeJson]
        : [mimeJson],
  };
}
