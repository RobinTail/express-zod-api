import { z } from "zod";
import { proprietary } from "./metadata";
import { isValidDate } from "./schema-helpers";

// simple regex for ISO date, supports the following formats:
// 2021-01-01T00:00:00.000Z
// 2021-01-01T00:00:00.0Z
// 2021-01-01T00:00:00Z
// 2021-01-01T00:00:00
// 2021-01-01
export const isoDateRegex =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?)?Z?$/;

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
