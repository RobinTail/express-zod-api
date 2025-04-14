import * as R from "ramda";
import { z } from "zod";
import { copyMeta } from "./metadata";
import { AbstractMiddleware } from "./middleware";

type Base = object & { [Symbol.iterator]?: never };

/** @desc The type allowed on the top level of Middlewares and Endpoints */
export type IOSchema = z.ZodType<Base>;

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
