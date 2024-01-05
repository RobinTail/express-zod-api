import { z } from "zod";
import { proprietary } from "./metadata";
import { isValidDate } from "./schema-helpers";

export const zodDateOutKind = "ZodDateOut";

export const dateOut = () =>
  proprietary(
    zodDateOutKind,
    z
      .date()
      .refine(isValidDate)
      .transform((date) => date.toISOString()),
  );
