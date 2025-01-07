import { z } from "zod";
import { isValidDate } from "./schema-helpers.ts";

export const ezDateOutBrand = Symbol("DateOut");

export const dateOut = () =>
  z
    .date()
    .refine(isValidDate)
    .transform((date) => date.toISOString())
    .brand(ezDateOutBrand as symbol);

export type DateOutSchema = ReturnType<typeof dateOut>;
