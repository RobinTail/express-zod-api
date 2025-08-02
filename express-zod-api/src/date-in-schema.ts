import { z } from "zod";

export const ezDateInBrand = Symbol("DateIn");

export const dateIn = ({
  examples,
  ...rest
}: Parameters<z.ZodString["meta"]>[0] = {}) => {
  const schema = z.union([
    z.iso.date(),
    z.iso.datetime(),
    z.iso.datetime({ local: true }),
  ]);

  return schema
    .meta({ examples })
    .transform((str) => new Date(str))
    .pipe(z.date())
    .brand(ezDateInBrand as symbol)
    .meta(rest);
};
