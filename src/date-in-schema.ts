import { z } from "zod";
import { metaProp, withMeta } from "./metadata";
import { isValidDate } from "./schema-helpers";

export const shortDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const zodDateInKind = "ZodDateIn";

export const dateIn = () => {
  const schema = withMeta(
    z
      .string()
      .datetime()
      .or(z.string().regex(shortDateRegex))
      .transform((str) => new Date(str))
      .pipe(z.date().refine(isValidDate)),
  );
  schema._def[metaProp].proprietaryKind = zodDateInKind;
  return schema;
};
