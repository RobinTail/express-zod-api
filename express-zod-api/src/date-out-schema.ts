import { z } from "zod";

export const ezDateOutBrand = Symbol("DateOut");

export const dateOut = (meta: Parameters<z.ZodString["meta"]>[0] = {}) =>
  z
    .date()
    .transform((date) => date.toISOString())
    .brand(ezDateOutBrand as symbol)
    .meta(meta);
