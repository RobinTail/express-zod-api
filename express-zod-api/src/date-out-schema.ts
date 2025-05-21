import { z } from "zod/v4";

export const ezDateOutBrand = Symbol("DateOut");

export const dateOut = (meta: Parameters<z.ZodString["meta"]>[0] = {}) =>
  z
    .date()
    .transform((date) => date.toISOString())
    .meta(meta)
    .brand(ezDateOutBrand as symbol);

export type DateOutSchema = ReturnType<typeof dateOut>;
