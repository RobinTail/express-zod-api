import * as R from "ramda";
import { combinations, FlatObject, isObject } from "./common-helpers";
import type { z } from "zod";
import type { SchemaObject } from "openapi3-ts/oas31";

type MergeMode = "coerce" | "throw";
type FlattenObjectSchema = z.core.JSONSchema.ObjectSchema &
  Required<Pick<z.core.JSONSchema.ObjectSchema, "properties">>;

/** @internal */
export const isJsonObjectSchema = (
  subject: z.core.JSONSchema.BaseSchema,
): subject is z.core.JSONSchema.ObjectSchema => subject.type === "object";

/** @internal */
export const propsMerger = R.mergeDeepWith((a: unknown, b: unknown) => {
  if (Array.isArray(a) && Array.isArray(b)) return R.concat(a, b);
  if (a === b) return b;
  throw new Error("Can not flatten properties", { cause: { a, b } });
});

const mergeableKeys = new Set<string>([
  "type",
  "properties",
  "required",
  "examples",
  "description",
  "additionalProperties",
] satisfies Array<keyof SchemaObject>); // z.core.JSONSchema has index signature

/** @internal */
export const canMerge = (subject: FlatObject): boolean => {
  for (const key of Object.keys(subject))
    if (!mergeableKeys.has(key)) return false;
  return true;
};

/** @internal */
export const nestOptional = R.pair(true)<z.core.JSONSchema.BaseSchema>;
type Stack = Array<ReturnType<typeof nestOptional>>;

/** @internal */
export const processAllOf = (
  subject: z.core.JSONSchema.BaseSchema,
  mode: MergeMode,
  isOptional: boolean,
) => {
  if (!("allOf" in subject) || !subject.allOf) return [];
  return subject.allOf.map((one) => {
    if (mode === "throw" && !(one.type === "object" && canMerge(one)))
      throw new Error("Can not merge");
    return R.pair(isOptional, one);
  });
};

/** @internal */
export const processVariants = (subject: z.core.JSONSchema.BaseSchema) => {
  const result: Stack = [];
  if (subject.anyOf) result.push(...R.map(nestOptional, subject.anyOf));
  if (subject.oneOf) result.push(...R.map(nestOptional, subject.oneOf));
  return result;
};

/** @internal */
export const processPropertyNames = (
  subject: z.core.JSONSchema.ObjectSchema,
  target: FlattenObjectSchema,
  requiredKeys: string[],
  isOptional: boolean,
) => {
  if (!isObject(subject.propertyNames)) return;
  const keys: string[] = [];
  if (typeof subject.propertyNames.const === "string")
    keys.push(subject.propertyNames.const);
  if (subject.propertyNames.enum) {
    keys.push(
      ...subject.propertyNames.enum.filter((one) => typeof one === "string"),
    );
  }
  const value = { ...Object(subject.additionalProperties) }; // it can be bool
  for (const key of keys) target.properties[key] ??= value;
  if (!isOptional) requiredKeys.push(...keys);
};

/** @internal */
export const mergeExamples = (
  target: FlattenObjectSchema,
  entry: z.core.JSONSchema.BaseSchema,
  {
    isOptional,
    maxCombinations,
  }: { isOptional: boolean; maxCombinations?: number },
) => {
  if (!entry.examples?.length) return;
  if (isOptional) {
    target.examples = R.concat(target.examples || [], entry.examples);
  } else {
    target.examples = combinations(
      target.examples?.filter(isObject) || [],
      entry.examples.filter(isObject),
      R.mergeDeepRight,
      maxCombinations,
    );
  }
};

export const flattenIO = (
  jsonSchema: z.core.JSONSchema.BaseSchema,
  {
    mode = "coerce",
    maxCombinations,
  }: {
    /** @default "coerce" */
    mode?: MergeMode;
    maxCombinations?: number;
  } = {},
) => {
  const stack: Stack = [R.pair(false, jsonSchema)]; // [isOptional, JSON Schema]
  const flat: FlattenObjectSchema = { type: "object", properties: {} };
  const flatRequired: string[] = [];
  for (let idx = 0; idx < stack.length; idx++) {
    const [isOptional, entry] = stack[idx];
    if (entry.description) flat.description ??= entry.description;
    stack.push(...processAllOf(entry, mode, isOptional));
    stack.push(...processVariants(entry));
    mergeExamples(flat, entry, { isOptional, maxCombinations });
    if (!isJsonObjectSchema(entry)) continue;
    stack.push([
      isOptional,
      { examples: pullRequestExamples(entry, maxCombinations) },
    ]);
    if (entry.properties) {
      flat.properties = (mode === "throw" ? propsMerger : R.mergeDeepRight)(
        flat.properties,
        entry.properties,
      );
      if (!isOptional && entry.required) flatRequired.push(...entry.required);
    }
    processPropertyNames(entry, flat, flatRequired, isOptional);
  }
  if (flatRequired.length) flat.required = [...new Set(flatRequired)];
  return flat;
};

/** @see pullResponseExamples */
export const pullRequestExamples = (
  subject: z.core.JSONSchema.ObjectSchema,
  limit?: number,
) =>
  Object.entries(subject.properties || {}).reduce<FlatObject[]>(
    (acc, [key, prop]) => {
      const { examples = [] } = isObject(prop) ? prop : {};
      return combinations(acc, examples.map(R.objOf(key)), R.mergeRight, limit);
    },
    [],
  );
