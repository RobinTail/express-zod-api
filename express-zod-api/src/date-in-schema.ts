import { z } from "zod";
import { isValidDate } from "./schema-helpers";

export const ezDateInBrand = Symbol("DateIn");

export const dateIn = () => {
  const schema = z.union([
    z.string().date(),
    z.string().datetime(),
    z.string().datetime({ local: true }),
  ]);

  return schema
    .transform((str) => new Date(str))
    .pipe(z.date().refine(isValidDate)) // @todo isValidDate no longer needed
    .brand(ezDateInBrand as symbol);
};

export type DateInSchema = ReturnType<typeof dateIn>;
