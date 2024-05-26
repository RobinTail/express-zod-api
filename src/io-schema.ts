import { z } from "zod";
import { copyMeta } from "./metadata";
import { AbstractMiddleware } from "./middleware";
import { RawSchema } from "./raw-schema";

type Refined<T extends z.ZodTypeAny> =
  T extends z.ZodType<infer O> ? z.ZodEffects<T | Refined<T>, O, O> : never;

/**
 * @desc The type allowed on the top level of Middlewares and Endpoints
 * @param U — only "strip" is allowed for Middlewares due to intersection issue (Zod) #600
 * */
export type IOSchema<U extends z.UnknownKeysParam = z.UnknownKeysParam> =
  | z.ZodObject<z.ZodRawShape, U>
  | z.ZodUnion<[IOSchema<U>, ...IOSchema<U>[]]>
  | z.ZodIntersection<IOSchema<U>, IOSchema<U>>
  | z.ZodDiscriminatedUnion<string, z.ZodObject<z.ZodRawShape, U>[]>
  | Refined<z.ZodObject<z.ZodRawShape, U>>
  | RawSchema;

/**
 * @description intersects input schemas of middlewares and the endpoint
 * @since 07.03.2022 former combineEndpointAndMiddlewareInputSchemas()
 * @since 05.03.2023 is immutable to metadata
 * @since 26.05.2024 uses the regular ZodIntersection
 * @see copyMeta
 */
export const getFinalEndpointInputSchema = <
  MIN extends IOSchema<"strip">,
  IN extends IOSchema,
>(
  middlewares: AbstractMiddleware[],
  input: IN,
): z.ZodIntersection<MIN, IN> => {
  const allSchemas = middlewares
    .map((mw) => mw.getSchema() as IOSchema)
    .concat(input);

  const finalSchema = allSchemas.reduce((acc, schema) => acc.and(schema));

  return allSchemas.reduce(
    (acc, schema) => copyMeta(schema, acc),
    finalSchema,
  ) as z.ZodIntersection<MIN, IN>;
};
