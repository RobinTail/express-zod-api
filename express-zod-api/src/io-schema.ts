import { z } from "zod";
import type { $ZodShape } from "@zod/core";
import { EmptyObject, FlatObject } from "./common-helpers";
import { FormSchema } from "./form-schema";
import { copyMeta } from "./metadata";
import { AbstractMiddleware } from "./middleware";
import { RawSchema } from "./raw-schema";

type BaseObject<U extends FlatObject> = z.ZodObject<$ZodShape, U>;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- workaround for TS2456, circular reference
interface ObjectTransformation<T extends z.ZodType>
  extends z.ZodPipe<T, z.ZodTransform<FlatObject, z.output<T>>> {}

type EffectsChain<U extends FlatObject> = ObjectTransformation<
  BaseObject<U> | EffectsChain<U>
>;

/**
 * @desc The type allowed on the top level of Middlewares and Endpoints
 * @param U — only EmptyObject is allowed for Middlewares due to intersection issue (Zod) #600
 * */
export type IOSchema<U extends FlatObject = FlatObject> =
  | BaseObject<U> // z.object()
  | EffectsChain<U> // z.object().refine(), z.object().transform(), z.object().preprocess()
  | RawSchema // ez.raw()
  | FormSchema // ez.form()
  | z.ZodUnion<[IOSchema<U>, ...IOSchema<U>[]]> // z.object().or()
  | z.ZodIntersection<IOSchema<U>, IOSchema<U>> // z.object().and()
  | z.ZodDiscriminatedUnion<BaseObject<U>[]> // z.discriminatedUnion()
  | z.ZodPipe<ObjectTransformation<BaseObject<U>>, BaseObject<U>>; // z.object().remap()

/**
 * @description intersects input schemas of middlewares and the endpoint
 * @since 07.03.2022 former combineEndpointAndMiddlewareInputSchemas()
 * @since 05.03.2023 is immutable to metadata
 * @since 26.05.2024 uses the regular ZodIntersection
 * @see copyMeta
 */
export const getFinalEndpointInputSchema = <
  MIN extends IOSchema<EmptyObject>,
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

export const extractObjectSchema = (subject: IOSchema): z.ZodObject => {
  if (subject instanceof z.ZodObject) return subject;
  if (
    subject instanceof z.ZodUnion ||
    subject instanceof z.ZodDiscriminatedUnion
  ) {
    return subject.options
      .map((option) => extractObjectSchema(option))
      .reduce((acc, option) => acc.merge(option.partial()), z.object({}));
  } else if (subject instanceof z.ZodEffects) {
    return extractObjectSchema(subject._def.schema);
  } else if (subject instanceof z.ZodPipeline) {
    return extractObjectSchema(subject._def.in);
  } // intersection left:
  return extractObjectSchema(subject._def.left).merge(
    extractObjectSchema(subject._def.right),
  );
};
