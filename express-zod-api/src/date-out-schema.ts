import { z } from "zod/v4";

export const ezDateOutBrand = Symbol("DateOut");

export const dateOut = ({
  examples,
  ...rest
}: Parameters<z.ZodString["meta"]>[0] = {}) =>
  z
    .date()
    .transform((date) => date.toISOString())
    .brand(ezDateOutBrand as symbol)
    .meta({
      ...rest,
      examples: examples as
        | Array<NonNullable<typeof examples>[number] & z.$brand>
        | undefined,
    });
