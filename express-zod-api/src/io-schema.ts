import type { JSONSchema } from "@zod/core";
import * as R from "ramda";
import { z } from "zod";
import { IOSchemaError } from "./errors";
import { mixExamples } from "./metadata";
import { AbstractMiddleware } from "./middleware";

type Base = object & { [Symbol.iterator]?: never };

/** @desc The type allowed on the top level of Middlewares and Endpoints */
export type IOSchema = z.ZodType<Base>;

/**
 * @description intersects input schemas of middlewares and the endpoint
 * @since 07.03.2022 former combineEndpointAndMiddlewareInputSchemas()
 * @since 05.03.2023 is immutable to metadata
 * @since 26.05.2024 uses the regular ZodIntersection
 * @see mixExamples
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
  const finalSchema = allSchemas.reduce((acc, schema) => acc.and(schema));
  return allSchemas.reduce(
    (acc, schema) => mixExamples(schema, acc),
    finalSchema,
  ) as z.ZodIntersection<MIN, IN>;
};

export const extractObjectSchema = (subject: IOSchema): z.ZodObject => {
  if (subject instanceof z.ZodObject) return subject;
  if (subject instanceof z.ZodInterface) {
    const { optional } = subject._zod.def;
    const mask = R.zipObj(optional, Array(optional.length).fill(true));
    const partial = subject.pick(mask);
    const required = subject.omit(mask);
    return z
      .object(required._zod.def.shape)
      .extend(z.object(partial._zod.def.shape).partial());
  }
  if (
    subject instanceof z.ZodUnion ||
    subject instanceof z.ZodDiscriminatedUnion
  ) {
    return subject._zod.def.options
      .map((option) => extractObjectSchema(option as IOSchema))
      .reduce((acc, option) => acc.extend(option.partial()), z.object({}));
  }
  if (subject instanceof z.ZodPipe)
    return extractObjectSchema(subject.in as IOSchema);
  if (subject instanceof z.ZodIntersection) {
    return extractObjectSchema(subject._zod.def.left as IOSchema).extend(
      extractObjectSchema(subject._zod.def.right as IOSchema),
    );
  }
  throw new IOSchemaError("Can not flatten IOSchema", { cause: subject });
};

const isJsonObjectSchema = (
  subject: JSONSchema.BaseSchema,
): subject is JSONSchema.ObjectSchema => subject.type === "object";

export const extract2 = (subject: IOSchema) => {
  const jsonSchema = z.toJSONSchema(subject, {
    unrepresentable: "any",
    io: "input",
  });
  const stack = [jsonSchema];
  const props: Record<string, JSONSchema.BaseSchema> = {};
  while (stack.length) {
    const entry = stack.shift()!;
    if (isJsonObjectSchema(entry)) {
      if (entry.properties) Object.assign(props, entry.properties);
      if (entry.propertyNames) {
        const keys: string[] = [];
        if (typeof entry.propertyNames.const === "string")
          keys.push(entry.propertyNames.const);
        if (entry.propertyNames.enum) {
          keys.push(
            ...entry.propertyNames.enum.filter(
              (one) => typeof one === "string",
            ),
          );
        }
        const value =
          typeof entry.additionalProperties === "object"
            ? entry.additionalProperties
            : {};
        for (const key of keys) props[key] = value;
      }
    }
    if (entry.allOf) stack.push(...entry.allOf);
    if (entry.anyOf) stack.push(...entry.anyOf);
    if (entry.oneOf) stack.push(...entry.oneOf);
    if (entry.not) stack.push(entry.not);
  }
  return props;
};
