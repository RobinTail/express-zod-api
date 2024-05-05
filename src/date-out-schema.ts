import { z } from "zod";
import { isValidDate } from "./schema-helpers";

export const ezDateOutBrand = Symbol.for("DateOut");

export const dateOut = () =>
  z
    .date()
    .refine(isValidDate)
    .transform((date) => date.toISOString())
    .brand(ezDateOutBrand);

export type DateOutSchema = ReturnType<typeof dateOut>;
