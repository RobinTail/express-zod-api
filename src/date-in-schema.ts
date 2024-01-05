import { z } from "zod";
import { proprietary } from "./metadata";
import { isValidDate, isoDateRegex } from "./schema-helpers";

export const zodDateInKind = "ZodDateIn";

export const dateIn = () =>
  proprietary(
    zodDateInKind,
    z
      .string()
      .regex(isoDateRegex)
      .transform((str) => new Date(str))
      .pipe(z.date().refine(isValidDate)),
  );
