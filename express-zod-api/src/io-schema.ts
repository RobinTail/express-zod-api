import type { JSONSchema } from "@zod/core";
import * as R from "ramda";
import { z } from "zod";
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

export const extract2 = (jsonSchema: JSONSchema.BaseSchema) => {
  const stack = [jsonSchema];
  const flat: Required<Pick<JSONSchema.ObjectSchema, "type" | "properties">> = {
    type: "object",
    properties: {},
  };
  while (stack.length) {
    const entry = stack.shift()!;
    if (isJsonObjectSchema(entry)) {
      if (entry.properties) Object.assign(flat.properties, entry.properties);
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
      }
    }
    if (entry.allOf) stack.push(...entry.allOf);
    if (entry.anyOf) stack.push(...entry.anyOf);
    if (entry.oneOf) stack.push(...entry.oneOf);
    if (entry.not) stack.push(entry.not);
  }
  return flat;
};
