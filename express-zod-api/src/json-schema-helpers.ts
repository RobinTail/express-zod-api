import type { JSONSchema } from "@zod/core";
import * as R from "ramda";
import { combinations, isObject } from "./common-helpers";

const isJsonObjectSchema = (
  subject: JSONSchema.BaseSchema,
): subject is JSONSchema.ObjectSchema => subject.type === "object";

const propsMerger = R.mergeDeepWith((a: unknown, b: unknown) => {
  if (Array.isArray(a) && Array.isArray(b)) return R.concat(a, b);
  if (a === b) return b;
  throw new Error("Can not flatten properties");
});

/** @todo DNRY with intersect() */
export const flattenIO = (
  jsonSchema: JSONSchema.BaseSchema,
  mode: "coercive" | "suggestive" = "coercive", // throws in suggestive mode
) => {
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
      flat.properties = (mode === "coercive" ? R.mergeDeepRight : propsMerger)(
        flat.properties,
        entry.properties,
      );
      if (!isOptional && entry.required)
        flat.required = R.union(flat.required, entry.required);
    }
    if (entry.examples) {
      if (isOptional) {
        flat.examples.push(...entry.examples);
      } else {
        flat.examples = combinations(
          flat.examples.filter(isObject),
          entry.examples.filter(isObject),
          ([a, b]) => R.mergeDeepRight(a, b),
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
      for (const key of keys) flat.properties[key] ??= value;
      if (!isOptional) flat.required = R.union(flat.required, keys);
    }
  }
  return flat;
};
