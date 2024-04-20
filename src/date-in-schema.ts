import { z } from "zod";
import { proprietary } from "./metadata";
import { isValidDate, isoDateRegex } from "./schema-helpers";

export const ezDateInKind = "DateIn";

export const dateIn = () => {
  const base = z.string();
  const hasDateMethod = typeof base.date === "function";
  const schema = hasDateMethod
    ? base
        .date()
        .or(base.datetime())
        .or(base.datetime({ local: true }))
    : base.regex(isoDateRegex); // @todo remove after min zod v3.23 (v19)

  return proprietary(
    ezDateInKind,
    schema.transform((str) => new Date(str)).pipe(z.date().refine(isValidDate)),
  );
};
