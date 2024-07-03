import { z } from "zod";
import { FlatObject } from "./common-helpers";
import { copyMeta } from "./metadata";
import { AbstractMiddleware } from "./middleware";
import { RawSchema } from "./raw-schema";

type BaseObject<U extends z.UnknownKeysParam> = z.ZodObject<z.ZodRawShape, U>;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- workaround for TS2456, circular reference
interface ObjectBasedEffect<T extends z.ZodTypeAny>
  extends z.ZodEffects<T, FlatObject> {}

type EffectsChain<U extends z.UnknownKeysParam> = ObjectBasedEffect<
  BaseObject<U> | EffectsChain<U>
>;

/**
 * @desc The type allowed on the top level of Middlewares and Endpoints
 * @param U — only "strip" is allowed for Middlewares due to intersection issue (Zod) #600
 * */
export type IOSchema<U extends z.UnknownKeysParam = z.UnknownKeysParam> =
  | BaseObject<U> // z.object()
  | EffectsChain<U> // z.object().refine(), z.object().transform(), z.object().preprocess()
  | RawSchema // ez.raw()
  | z.ZodUnion<[IOSchema<U>, ...IOSchema<U>[]]> // z.object().or()
  | z.ZodIntersection<IOSchema<U>, IOSchema<U>> // z.object().and()
  | z.ZodDiscriminatedUnion<string, BaseObject<U>[]> // z.discriminatedUnion()
  | z.ZodPipeline<ObjectBasedEffect<BaseObject<U>>, BaseObject<U>>; // z.object().remap()

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
