import type { $ZodType } from "@zod/core";
import { AssertionError, fail } from "node:assert/strict";
import * as R from "ramda";
import { globalRegistry, z } from "zod";
import { ezDateInBrand } from "./date-in-schema";
import { ezDateOutBrand } from "./date-out-schema";
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

export const hasNestedSchema = (
  subject: $ZodType,
  { io, condition }: NestedSchemaLookupProps,
) =>
  R.tryCatch(
    () =>
      z.toJSONSchema(subject, {
        io,
        unrepresentable: "any",
        override: ({ zodSchema }) => {
          if (condition(zodSchema)) throw new Error("Early exit");
        },
      }) && false,
    (err) => {
      if (err instanceof AssertionError) throw err;
      return true;
    },
  )();

export const hasUpload = (subject: IOSchema) =>
  hasNestedSchema(subject, {
    condition: (schema) =>
      globalRegistry.get(schema)?.[metaSymbol]?.brand === ezUploadBrand,
    io: "input",
  });

export const hasRaw = (subject: IOSchema) =>
  hasNestedSchema(subject, {
    condition: (schema) =>
      globalRegistry.get(schema)?.[metaSymbol]?.brand === ezRawBrand,
    io: "input",
  });

export const hasForm = (subject: IOSchema) =>
  hasNestedSchema(subject, {
    condition: (schema) =>
      globalRegistry.get(schema)?.[metaSymbol]?.brand === ezFormBrand,
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
];

/** @todo try to delegate to hasNestedSchema with a variant or something */
export const assertJsonCompatible = (
  subject: $ZodType,
  io: "input" | "output",
) =>
  hasNestedSchema(subject, {
    io,
    condition: (zodSchema) => {
      const { brand } = globalRegistry.get(zodSchema)?.[metaSymbol] || {};
      const { type } = zodSchema._zod.def;
      if (unsupported.includes(type)) fail(`z.${type}()`);
      if (io === "input") {
        if (type === "date") fail("z.date()");
        if (brand === ezDateOutBrand) fail("ez.dateOut()");
      }
      if (io === "output") {
        if (brand === ezDateInBrand) fail("ez.dateIn()");
        if (brand === ezRawBrand) fail("ez.raw()");
        if (brand === ezUploadBrand) fail("ez.upload()");
      }
      return false;
    },
  });
