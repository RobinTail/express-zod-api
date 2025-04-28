import type { $ZodType } from "@zod/core";
import * as R from "ramda";
import { globalRegistry, z } from "zod";
import { ezFormBrand } from "./form-schema";
import { IOSchema } from "./io-schema";
import { metaSymbol } from "./metadata";
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
          if (condition(zodSchema))
            throw new Error("Early exit", { cause: zodSchema });
        },
      }) && false,
    () => true,
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
