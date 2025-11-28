import { z } from "zod";

export const ezDateOutBrand = Symbol("DateOut");

export interface DateOutParams extends Omit<
  Parameters<z.ZodString["meta"]>[0],
  "examples"
> {
  examples?: string[];
}

export const dateOut = (meta: DateOutParams = {}) =>
  z
    .date()
    .transform((date) => date.toISOString())
    .brand(ezDateOutBrand as symbol)
    .meta(meta);
