import { z } from "zod";
import { proprietary } from "./metadata";
import { isValidDate } from "./schema-helpers";

export const ezDateOutKind = "DateOut";

export const dateOut = () =>
  proprietary(
    ezDateOutKind,
    z
      .date()
      .refine(isValidDate)
      .transform((date) => date.toISOString()),
  );
