import type { JSONSchema } from "@zod/core";
import * as R from "ramda";
import { z } from "zod";
import { combinations, isObject } from "./common-helpers";
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

const isJsonObjectSchema = (
  subject: JSONSchema.BaseSchema,
): subject is JSONSchema.ObjectSchema => subject.type === "object";

export const flattenIO = (jsonSchema: JSONSchema.BaseSchema) => {
  const stack = [{ entry: jsonSchema, isOptional: false }];
  const flat: Required<
    Pick<
      JSONSchema.ObjectSchema,
      "type" | "properties" | "required" | "examples"
    >
  > = {
    type: "object",
    properties: {},
    required: [],
    examples: [],
  };
  while (stack.length) {
    const { entry, isOptional } = stack.shift()!;
    if (isJsonObjectSchema(entry)) {
      if (entry.properties) {
        Object.assign(flat.properties, entry.properties);
        if (!isOptional && entry.required)
          flat.required.push(...entry.required);
      }
      if (entry.examples) {
        if (isOptional) {
          flat.examples.push(...entry.examples);
        } else {
          flat.examples = combinations(
            flat.examples.filter(isObject),
            entry.examples.filter(isObject),
            ([a, b]) => ({ ...a, ...b }),
          );
        }
      }
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
        for (const key of keys) flat.properties[key] = value;
        if (!isOptional) flat.required.push(...keys);
      }
    }
    if (entry.allOf)
      stack.push(...entry.allOf.map((one) => ({ entry: one, isOptional })));
    if (entry.anyOf) {
      stack.push(
        ...entry.anyOf.map((one) => ({ entry: one, isOptional: true })),
      );
    }
    if (entry.oneOf) {
      stack.push(
        ...entry.oneOf.map((one) => ({ entry: one, isOptional: true })),
      );
    }
  }
  return flat;
};
