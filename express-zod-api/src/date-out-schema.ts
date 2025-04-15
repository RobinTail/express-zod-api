import { z } from "zod";
import { isValidDate } from "./schema-helpers";

export const ezDateOutBrand = Symbol("DateOut");

export const dateOut = () =>
  z
    .date()
    .refine(isValidDate) // @todo looks line this is no longer required
    .transform((date) => date.toISOString())
    .brand(ezDateOutBrand as symbol);

export type DateOutSchema = ReturnType<typeof dateOut>;
