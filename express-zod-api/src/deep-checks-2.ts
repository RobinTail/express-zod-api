import type { $ZodType } from "@zod/core";
import assert from "node:assert/strict";
import * as R from "ramda";
import { z } from "zod";

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
          assert.equal(condition(zodSchema), false, zodSchema._zod.def.type);
        },
      }) && false,
    () => true,
  )();
