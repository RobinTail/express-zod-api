import { z } from "zod";
import { copyMeta } from "./metadata";
import { AnyMiddlewareDef } from "./middleware";

// the copy of the private Zod utility type of ZodObject
type UnknownKeysParam = "passthrough" | "strict" | "strip";

type Refined<T extends z.ZodTypeAny> = T extends z.ZodType<infer O>
  ? z.ZodEffects<T | Refined<T>, O, O>
  : never;

/**
 * @desc The type allowed on the top level of Middlewares and Endpoints
 * @param U — only "strip" is allowed for Middlewares due to intersection issue (Zod) #600
 * @param S — the shape of the object which IOSchema is based on
 * */
export type IOSchema<
  U extends UnknownKeysParam = any,
  S extends z.ZodRawShape = any,
> =
  | z.ZodObject<S, U>
  | z.ZodUnion<[IOSchema<U, S>, ...IOSchema<U, S>[]]>
  | z.ZodIntersection<IOSchema<U, S>, IOSchema<U, S>>
  | z.ZodDiscriminatedUnion<string, z.ZodObject<S, U>[]>
  | Refined<z.ZodObject<S, U>>;

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
