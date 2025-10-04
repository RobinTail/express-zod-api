import * as R from "ramda";
import { z } from "zod";
import { ezBufferBrand } from "./buffer-schema.ts";
import { ezDateInBrand } from "./date-in-schema.ts";
import { ezDateOutBrand } from "./date-out-schema.ts";
import { DeepCheckError } from "./errors.ts";
import { ezFormBrand } from "./form-schema.ts";
import type { IOSchema } from "./io-schema.ts";
import { getBrand } from "@express-zod-api/zod-plugin";
import type { FirstPartyKind } from "./schema-walker.ts";
import { ezUploadBrand } from "./upload-schema.ts";
import { ezRawBrand } from "./raw-schema.ts";

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
  while (stack.length) {
    const entry = stack.shift()!;
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
