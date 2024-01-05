import { z } from "zod";
import { metaProp, withMeta } from "./metadata";
import { isValidDate } from "./schema-helpers";

export const zodDateOutKind = "ZodDateOut";

export const dateOut = () => {
  const schema = withMeta(
    z
      .date()
      .refine(isValidDate)
      .transform((date) => date.toISOString()),
  );
  schema._def[metaProp].proprietaryKind = zodDateOutKind;
  return schema;
};
