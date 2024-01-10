import { z } from "zod";
import { proprietary } from "./metadata";
import { isValidDate, isoDateRegex } from "./schema-helpers";

export const ezDateInKind = "DateIn";

export const dateIn = () =>
  proprietary(
    ezDateInKind,
    z
      .string()
      .regex(isoDateRegex)
      .transform((str) => new Date(str))
      .pipe(z.date().refine(isValidDate)),
  );
