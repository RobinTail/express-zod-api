import type { JSONSchema } from "zod/v4/core";
import * as R from "ramda";
import { combinations, FlatObject, isObject } from "./common-helpers";

const isJsonObjectSchema = (
  subject: JSONSchema.BaseSchema,
): subject is JSONSchema.ObjectSchema => subject.type === "object";

const propsMerger = R.mergeDeepWith((a: unknown, b: unknown) => {
  if (Array.isArray(a) && Array.isArray(b)) return R.concat(a, b);
  if (a === b) return b;
  throw new Error("Can not flatten properties", { cause: { a, b } });
});

const canMerge = R.pipe(
  Object.keys,
  R.without([
    "type",
    "properties",
    "required",
    "examples",
    "description",
    "additionalProperties",
  ] satisfies Array<keyof JSONSchema.ObjectSchema>),
  R.isEmpty,
);

const nestOptional = R.pair(true);

export const flattenIO = (
  jsonSchema: JSONSchema.BaseSchema,
  mode: "coerce" | "throw" = "coerce",
) => {
  const stack = [R.pair(false, jsonSchema)]; // [isOptional, JSON Schema]
  const flat: JSONSchema.ObjectSchema &
    Required<Pick<JSONSchema.ObjectSchema, "properties">> = {
    type: "object",
    properties: {},
  };
  const flatRequired: string[] = [];
  while (stack.length) {
    const [isOptional, entry] = stack.shift()!;
    if (entry.description) flat.description ??= entry.description;
    if (entry.allOf) {
      stack.push(
        ...entry.allOf.map((one) => {
          if (mode === "throw" && !(one.type === "object" && canMerge(one)))
            throw new Error("Can not merge");
          return R.pair(isOptional, one);
        }),
      );
    }
    if (entry.anyOf) stack.push(...R.map(nestOptional, entry.anyOf));
    if (entry.oneOf) stack.push(...R.map(nestOptional, entry.oneOf));
    if (entry.examples?.length) {
      if (isOptional) {
        flat.examples = R.concat(flat.examples || [], entry.examples);
      } else {
        flat.examples = combinations(
          flat.examples?.filter(isObject) || [],
          entry.examples.filter(isObject),
          ([a, b]) => R.mergeDeepRight(a, b),
        );
      }
    }
    if (!isJsonObjectSchema(entry)) continue;
    stack.push([isOptional, { examples: pullRequestExamples(entry) }]);
    if (entry.properties) {
      flat.properties = (mode === "throw" ? propsMerger : R.mergeDeepRight)(
        flat.properties,
        entry.properties,
      );
      if (!isOptional && entry.required) flatRequired.push(...entry.required);
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
      if (!isOptional) flatRequired.push(...keys);
    }
  }
  if (flatRequired.length) flat.required = [...new Set(flatRequired)];
  return flat;
};

/** @see pullResponseExamples */
export const pullRequestExamples = (subject: JSONSchema.ObjectSchema) =>
  Object.entries(subject.properties || {}).reduce<FlatObject[]>(
    (acc, [key, { examples = [] }]) =>
      combinations(acc, examples.map(R.objOf(key)), ([left, right]) => ({
        ...left,
        ...right,
      })),
    [],
  );
