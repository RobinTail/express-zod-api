import * as R from "ramda";
import { z } from "zod";
import { ezBufferBrand } from "./buffer-schema";
import { ezDateInBrand } from "./date-in-schema";
import { ezDateOutBrand } from "./date-out-schema";
import { DeepCheckError } from "./errors";
import { ezFormBrand } from "./form-schema";
import type { IOSchema } from "./io-schema";
import { getBrand } from "./metadata";
import type { FirstPartyKind } from "./schema-walker";
import { ezUploadBrand } from "./upload-schema";
import { ezRawBrand } from "./raw-schema";

interface NestedSchemaLookupProps {
  io: "input" | "output";
  condition: (zodSchema: z.core.$ZodType) => boolean;
}

export const findNestedSchema = (
  subject: z.core.$ZodType,
  { io, condition }: NestedSchemaLookupProps,
) =>
  R.tryCatch(
    () =>
      void z.toJSONSchema(subject, {
        io,
        unrepresentable: "any",
        override: ({ zodSchema }) => {
          if (condition(zodSchema)) throw new DeepCheckError(zodSchema); // exits early
        },
      }),
    (err: DeepCheckError) => err.cause,
  )();

/** not using cycle:"throw" because it also affects parenting objects */
export const hasCycle = (
  subject: z.core.$ZodType,
  { io }: Pick<NestedSchemaLookupProps, "io">,
) => {
  const json = z.toJSONSchema(subject, { io, unrepresentable: "any" });
  const stack: unknown[] = [json];
  for (let idx = 0; idx < stack.length; idx++) {
    const entry = stack[idx];
    if (R.is(Object, entry)) {
      if ((entry as z.core.JSONSchema.BaseSchema).$ref === "#") return true;
      stack.push(...R.values(entry));
    }
    if (R.is(Array, entry)) stack.push(...R.values(entry));
  }
  return false;
};

export const findRequestTypeDefiningSchema = (subject: IOSchema) =>
  findNestedSchema(subject, {
    condition: (schema) => {
      const brand = getBrand(schema);
      return (
        typeof brand === "symbol" &&
        [ezUploadBrand, ezRawBrand, ezFormBrand].includes(brand)
      );
    },
    io: "input",
  });

const unsupported: FirstPartyKind[] = [
  "nan",
  "symbol",
  "map",
  "set",
  "bigint",
  "void",
  "promise",
  "never",
  "function",
];

export const findJsonIncompatible = (
  subject: z.core.$ZodType,
  io: "input" | "output",
) =>
  findNestedSchema(subject, {
    io,
    condition: (zodSchema) => {
      const brand = getBrand(zodSchema);
      const { type } = zodSchema._zod.def;
      if (unsupported.includes(type)) return true;
      if (brand === ezBufferBrand) return true;
      if (io === "input") {
        if (type === "date") return true;
        if (brand === ezDateOutBrand) return true;
      }
      if (io === "output") {
        if (brand === ezDateInBrand) return true;
        if (brand === ezRawBrand) return true;
        if (brand === ezUploadBrand) return true;
      }
      return false;
    },
  });

/**
 * Whether a query/path parameter of this type can be satisfied by a string,
 * which is how such values always arrive. Non-coercing primitives (`number`,
 * `boolean`) and stringless literals/enums cannot, while `z.coerce.number()`
 * and `z.string()` can, so this is a warning signal rather than an error.
 * Unsupported and unknown schemas are treated as satisfiable to avoid
 * false positives (e.g. `bigint` is already covered by the JSON-incompatible
 * warning).
 * */
export const isStringSatisfiable = (subject: z.core.$ZodType): boolean => {
  const def = subject._zod.def;
  if (unsupported.includes(def.type)) return true; // already covered elsewhere
  switch (def.type) {
    case "string":
      return true;
    case "enum":
      return Object.values((def as z.core.$ZodEnumDef).entries).some(
        (entry) => typeof entry === "string",
      );
    case "literal":
      return (def as unknown as { values: unknown[] }).values.some(
        (entry) => typeof entry === "string",
      );
    case "optional":
    case "nullable":
    case "default":
      return isStringSatisfiable((def as z.core.$ZodDefaultDef).innerType);
    case "lazy":
      return isStringSatisfiable((def as z.core.$ZodLazyDef).getter());
    case "union":
      return (def as z.core.$ZodUnionDef).options.some(isStringSatisfiable);
    case "number":
    case "boolean":
      return (def as z.core.$ZodNumberDef).coerce === true;
    case "pipe":
      return isStringSatisfiable((def as z.core.$ZodPipeDef).in); // input side
    default:
      return true; // unknown types are treated as satisfiable
  }
};

/** @internal Top-level object properties of an (possibly intersected) input schema */
export const getObjectProperties = (
  subject: z.core.$ZodType,
): Record<string, z.core.$ZodType> => {
  const def = subject._zod.def;
  if (def.type === "intersection") {
    const { left, right } = def as z.core.$ZodIntersectionDef;
    return { ...getObjectProperties(left), ...getObjectProperties(right) };
  }
  if (def.type === "object") return (def as z.core.$ZodObjectDef).shape;
  return {};
};
