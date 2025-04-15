import { z } from "zod";

export const ezDateInBrand = Symbol("DateIn");

export const dateIn = () => {
  const schema = z.union([
    z.string().date(),
    z.string().datetime(),
    z.string().datetime({ local: true }),
  ]);

  return schema
    .transform((str) => new Date(str))
    .pipe(z.date())
    .brand(ezDateInBrand as symbol);
};

export type DateInSchema = ReturnType<typeof dateIn>;
