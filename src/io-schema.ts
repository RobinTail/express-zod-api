import { z } from "zod";
import { copyMeta } from "./metadata";
import { AnyMiddlewareDef } from "./middleware";
import { RawSchema } from "./raw-schema";

type Refined<T extends z.ZodTypeAny> =
  T extends z.ZodType<infer O> ? z.ZodEffects<T | Refined<T>, O, O> : never;

/**
 * @desc The type allowed on the top level of Middlewares and Endpoints
 * @param U — only "strip" is allowed for Middlewares due to intersection issue (Zod) #600
 * */
export type IOSchema<U extends z.UnknownKeysParam = z.UnknownKeysParam> =
  | z.ZodObject<any, U>
  | z.ZodUnion<[IOSchema<U>, ...IOSchema<U>[]]>
  | z.ZodIntersection<IOSchema<U>, IOSchema<U>>
  | z.ZodDiscriminatedUnion<string, z.ZodObject<any, U>[]>
  | Refined<z.ZodObject<any, U>>
  | RawSchema;

export type ProbableIntersection<
  A extends IOSchema<"strip"> | null,
  B extends IOSchema,
> = A extends null
  ? B
  : A extends IOSchema<"strip">
    ? z.ZodIntersection<A, B>
    : never;

/**
 * @description intersects input schemas of middlewares and the endpoint
 * @since 07.03.2022 former combineEndpointAndMiddlewareInputSchemas()
 * @since 05.03.2023 is immutable to metadata
 * @see copyMeta
 */
export const getFinalEndpointInputSchema = <
  MIN extends IOSchema<"strip"> | null,
  IN extends IOSchema,
>(
  middlewares: AnyMiddlewareDef[],
  input: IN,
): ProbableIntersection<MIN, IN> => {
  const allSchemas = middlewares
    .map(({ input: schema }) => schema)
    .concat(input);

  const finalSchema = allSchemas.reduce((acc, schema) =>
    acc.and(schema),
  ) as ProbableIntersection<MIN, IN>;

  return allSchemas.reduce((acc, schema) => copyMeta(schema, acc), finalSchema);
};
