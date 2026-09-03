import * as R from "ramda";
import { z } from "zod";
import { ezBufferBrand } from "./buffer-schema";
import { ezDateInBrand } from "./date-in-schema";
import { ezDateOutBrand } from "./date-out-schema";
import { DeepCheckError, type LookupContext } from "./errors";
import { ezFormBrand } from "./form-schema";
import type { IOSchema } from "./io-schema";
import { brandProperty } from "./metadata";
import type { FirstPartyKind } from "./schema-walker";
import { ezUploadBrand } from "./upload-schema";
import { ezRawBrand } from "./raw-schema";

interface NestedSchemaLookupProps {
  io: "input" | "output";
  condition: (ctx: LookupContext) => boolean;
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
        override: (ctx) => {
          if (condition(ctx)) throw new DeepCheckError(ctx); // exits early
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
  const { $ref: selfRef } = json;
  const stack: unknown[] = [json];
  for (let idx = 0; idx < stack.length; idx++) {
    const entry = stack[idx];
    if (R.is(Object, entry)) {
      const { $ref } = entry as z.core.JSONSchema.BaseSchema;
      if ($ref === "#") return true;
      if (idx && $ref && $ref === selfRef) return true;
      stack.push(...R.values(entry));
    }
    if (R.is(Array, entry)) stack.push(...R.values(entry));
  }
  return false;
};

const isRequestDefiningBrand = Set.prototype.has.bind(
  new Set([ezUploadBrand, ezRawBrand, ezFormBrand]),
);
export const findRequestTypeDefiningSchema = (subject: IOSchema) =>
  findNestedSchema(subject, {
    condition: ({ jsonSchema }) =>
      isRequestDefiningBrand(jsonSchema[brandProperty]),
    io: "input",
  });

const unsupported = new Set<FirstPartyKind>([
  "nan",
  "symbol",
  "map",
  "set",
  "bigint",
  "void",
  "promise",
  "never",
  "function",
]);

export const findJsonIncompatible = (
  subject: z.core.$ZodType,
  io: "input" | "output",
) =>
  findNestedSchema(subject, {
    io,
    condition: ({ zodSchema, jsonSchema }) => {
      const { type } = zodSchema._zod.def;
      if (unsupported.has(type)) return true;
      if (jsonSchema[brandProperty] === ezBufferBrand) return true;
      if (io === "input") {
        if (type === "date") return true;
        if (jsonSchema[brandProperty] === ezDateOutBrand) return true;
      }
      if (io === "output") {
        if (jsonSchema[brandProperty] === ezDateInBrand) return true;
        if (jsonSchema[brandProperty] === ezRawBrand) return true;
        if (jsonSchema[brandProperty] === ezUploadBrand) return true;
      }
      return false;
    },
  });
