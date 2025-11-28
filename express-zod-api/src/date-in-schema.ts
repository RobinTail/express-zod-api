import { z } from "zod";

export const ezDateInBrand = Symbol("DateIn");

export interface DateInParams extends Omit<
  Parameters<z.ZodString["meta"]>[0],
  "examples"
> {
  examples?: string[];
}

export const dateIn = ({ examples, ...rest }: DateInParams = {}) => {
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
