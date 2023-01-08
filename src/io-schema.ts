import { z } from "zod";
import { copyMeta } from "./metadata";
import { AnyMiddlewareDef } from "./middleware";

// the copy of the private Zod utility type of ZodObject
type UnknownKeysParam = "passthrough" | "strict" | "strip";

type Refined<T extends z.ZodType> = T extends z.ZodType<infer O>
  ? z.ZodEffects<T | Refined<T>, O, O>
  : never;

/**
 * @desc The type allowed on the top level of Middlewares and Endpoints
 * @param U — only "strip" is allowed for Middlewares due to intersection issue (Zod) #600
 * */
export type IOSchema<U extends UnknownKeysParam = any> =
  | z.ZodObject<any, U>
  | z.ZodUnion<[IOSchema<U>, ...IOSchema<U>[]]>
  | z.ZodIntersection<IOSchema<U>, IOSchema<U>>
  | z.ZodDiscriminatedUnion<string, z.ZodObject<any, U>[]>
  | Refined<z.ZodObject<any, U>>;

export type ProbableIntersection<
  A extends IOSchema<"strip"> | null,
  B extends IOSchema
> = A extends null
  ? B
  : A extends IOSchema<"strip">
  ? z.ZodIntersection<A, B>
  : never;

/**
 * @description intersects input schemas of middlewares and the endpoint
 * @since 07.03.2022 former combineEndpointAndMiddlewareInputSchemas()
 */
export const getFinalEndpointInputSchema = <
  MIN extends IOSchema<"strip"> | null,
  IN extends IOSchema
>(
  middlewares: AnyMiddlewareDef[],
  input: IN
): ProbableIntersection<MIN, IN> => {
  const result = middlewares
    .map(({ input: schema }) => schema)
    .concat(input)
    .reduce((acc, schema) => acc.and(schema)) as ProbableIntersection<MIN, IN>;
  for (const middleware of middlewares) {
    copyMeta(middleware.input, result);
  }
  copyMeta(input, result);
  return result;
};
