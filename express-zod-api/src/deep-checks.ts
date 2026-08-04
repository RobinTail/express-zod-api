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
 * Whether a query/path parameter of this JSON type can be satisfied by a
 * string, which is how such values always arrive. Non-coercing primitives
 * (`number`, `boolean`) and stringless literals/enums cannot, while coerced
 * primitives (marked `x-coerce` via the `override` of `toJSONSchema`) and
 * `string` can, so this is a warning signal rather than an error. Complex
 * (`array`, `object`, `null`) and unconstrained schemas are treated as
 * satisfiable to avoid false positives (e.g. `bigint` is already covered by
 * the JSON-incompatible warning).
 * */
export const isStringSatisfiable = (
  subject: z.core.JSONSchema.BaseSchema,
): boolean => {
  if (subject["x-coerce"] === true) return true;
  if (subject.anyOf) return subject.anyOf.some(isStringSatisfiable);
  if (subject.oneOf) return subject.oneOf.some(isStringSatisfiable);
  if (subject.allOf) return subject.allOf.every(isStringSatisfiable);
  if (subject.type === undefined || subject.type === "string") return true;
  return (
    subject.type !== "number" &&
    subject.type !== "integer" &&
    subject.type !== "boolean"
  );
};

/** @internal Human-readable type label of a JSON Schema depiction for a warning message */
export const stringifyType = (
  subject: z.core.JSONSchema.BaseSchema,
): string => {
  if (typeof subject.type === "string") return subject.type;
  const branches = subject.anyOf ?? subject.oneOf;
  if (branches) {
    const names = branches.map((branch) =>
      stringifyType(branch as z.core.JSONSchema.BaseSchema),
    );
    return Array.from(new Set(names)).join(" | ");
  }
  if (typeof subject.const === "string") return "string";
  return "non-string";
};
