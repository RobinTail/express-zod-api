import type { JSONSchema } from "@zod/core";
import { combinations, isObject } from "./common-helpers";

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
    if (!isJsonObjectSchema(entry)) continue;
    if (entry.properties) {
      Object.assign(flat.properties, entry.properties);
      if (!isOptional && entry.required) flat.required.push(...entry.required);
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
          ...entry.propertyNames.enum.filter((one) => typeof one === "string"),
        );
      }
      const value = { ...Object(entry.additionalProperties) }; // it can be bool
      for (const key of keys) flat.properties[key] = value;
      if (!isOptional) flat.required.push(...keys);
    }
  }
  if (flat.required.length > 1) flat.required = [...new Set(flat.required)]; // drop duplicates
  return flat;
};
