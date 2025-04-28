import type { $ZodType } from "@zod/core";
import * as R from "ramda";
import { globalRegistry, z } from "zod";
import { ezDateInBrand } from "./date-in-schema";
import { ezDateOutBrand } from "./date-out-schema";
import { DeepCheckError } from "./errors";
import { ezFormBrand } from "./form-schema";
import { IOSchema } from "./io-schema";
import { metaSymbol } from "./metadata";
import { FirstPartyKind } from "./schema-walker";
import { ezUploadBrand } from "./upload-schema";
import { ezRawBrand } from "./raw-schema";

interface NestedSchemaLookupProps {
  io: "input" | "output";
  condition: (zodSchema: $ZodType) => boolean;
}

export const findNestedSchema = (
  subject: $ZodType,
  { io, condition }: NestedSchemaLookupProps,
) =>
  R.tryCatch(
    () => {
      z.toJSONSchema(subject, {
        io,
        unrepresentable: "any",
        override: ({ zodSchema }) => {
          if (condition(zodSchema)) throw new DeepCheckError(zodSchema); // exits early
        },
      });
      return undefined;
    },
    (err: DeepCheckError) => err.cause,
  )();

export const hasUpload = (subject: IOSchema) =>
  Boolean(
    findNestedSchema(subject, {
      condition: (schema) =>
        globalRegistry.get(schema)?.[metaSymbol]?.brand === ezUploadBrand,
      io: "input",
    }),
  );

export const hasRaw = (subject: IOSchema) =>
  Boolean(
    findNestedSchema(subject, {
      condition: (schema) =>
        globalRegistry.get(schema)?.[metaSymbol]?.brand === ezRawBrand,
      io: "input",
    }),
  );

export const hasForm = (subject: IOSchema) =>
  Boolean(
    findNestedSchema(subject, {
      condition: (schema) =>
        globalRegistry.get(schema)?.[metaSymbol]?.brand === ezFormBrand,
      io: "input",
    }),
  );

const unsupported: FirstPartyKind[] = [
  "nan",
  "symbol",
  "map",
  "set",
  "bigint",
  "void",
  "promise",
  "never",
];

export const findJsonIncompatible = (
  subject: $ZodType,
  io: "input" | "output",
) =>
  findNestedSchema(subject, {
    io,
    condition: (zodSchema) => {
      const { brand } = globalRegistry.get(zodSchema)?.[metaSymbol] || {};
      const { type } = zodSchema._zod.def;
      if (unsupported.includes(type)) return true;
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
