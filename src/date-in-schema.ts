import { z } from "zod";
import { proprietary } from "./metadata";
import { isValidDate } from "./schema-helpers";

export const ezDateInKind = "DateIn";

export const dateIn = () => {
  const schema = z.union([
    z.string().date(),
    z.string().datetime(),
    z.string().datetime({ local: true }),
  ]);

  return proprietary(
    ezDateInKind,
    schema.transform((str) => new Date(str)).pipe(z.date().refine(isValidDate)),
  );
};
