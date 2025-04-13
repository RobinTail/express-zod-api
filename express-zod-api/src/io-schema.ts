import * as R from "ramda";
import { z } from "zod";
import { FlatObject } from "./common-helpers";
import { FormSchema } from "./form-schema";
import { copyMeta } from "./metadata";
import { AbstractMiddleware } from "./middleware";
import { RawSchema } from "./raw-schema";

type BaseObject = z.ZodObject;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- workaround for TS2456, circular reference
interface ObjectTransformation<T extends z.ZodType>
  extends z.ZodPipe<T, z.ZodTransform<FlatObject, z.output<T>>> {}

type EffectsChain = ObjectTransformation<BaseObject | EffectsChain>;

/** @desc The type allowed on the top level of Middlewares and Endpoints */
export type IOSchema =
  | BaseObject // z.object() + .refine()
  | EffectsChain // z.object().transform()
  | RawSchema // ez.raw()
  | FormSchema // ez.form()
  | z.ZodUnion<[IOSchema, ...IOSchema[]]> // z.object().or()
  | z.ZodIntersection<IOSchema, IOSchema> // z.object().and()
  | z.ZodDiscriminatedUnion<BaseObject[]> // z.discriminatedUnion()
  | z.ZodPipe<ObjectTransformation<BaseObject>, BaseObject>; // z.object().remap()

/**
 * @description intersects input schemas of middlewares and the endpoint
 * @since 07.03.2022 former combineEndpointAndMiddlewareInputSchemas()
 * @since 05.03.2023 is immutable to metadata
 * @since 26.05.2024 uses the regular ZodIntersection
 * @see copyMeta
 */
export const getFinalEndpointInputSchema = <
  MIN extends IOSchema,
  IN extends IOSchema,
>(
  middlewares: AbstractMiddleware[],
  input: IN,
): z.ZodIntersection<MIN, IN> => {
  const allSchemas: IOSchema[] = R.pluck("schema", middlewares);
  allSchemas.push(input);
  const finalSchema = allSchemas.reduce((acc, schema) =>
    z.intersection(acc, schema),
  );
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
