import * as R from "ramda";
import { z } from "zod";
import { FlatObject } from "./common-helpers";
import { FormSchema } from "./form-schema";
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
  | FormSchema // ez.form()
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
  const allSchemas: IOSchema[] = R.pluck("schema", middlewares);
  allSchemas.push(input);
  const finalSchema = allSchemas.reduce((acc, schema) => acc.and(schema));
  return allSchemas.reduce(
    (acc, schema) => copyMeta(schema, acc),
    finalSchema,
  ) as z.ZodIntersection<MIN, IN>;
};

export const extractObjectSchema = (
  subject: IOSchema,
): z.ZodObject<z.ZodRawShape> => {
  if (subject instanceof z.ZodObject) return subject;
  if (subject instanceof z.ZodBranded)
    return extractObjectSchema(subject.unwrap());
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
