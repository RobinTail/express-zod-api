import { z } from "zod/v4";

export const ezDateInBrand = Symbol("DateIn");

export const dateIn = (meta: Parameters<z.ZodString["meta"]>[0] = {}) => {
  const schema = z.union([
    z.iso.date(),
    z.iso.datetime(),
    z.iso.datetime({ local: true }),
  ]) as unknown as z.ZodUnion<[z.ZodString, z.ZodString, z.ZodString]>; // this fixes DTS build for ez export

  return schema
    .meta(meta)
    .transform((str) => new Date(str))
    .pipe(z.date())
    .brand(ezDateInBrand as symbol);
};

export type DateInSchema = ReturnType<typeof dateIn>;
