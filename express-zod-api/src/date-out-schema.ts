import { z } from "zod";

export const ezDateOutBrand = Symbol("DateOut");

export const dateOut = () =>
  z
    .date()
    .transform((date) => date.toISOString())
    .brand(ezDateOutBrand as symbol);

export type DateOutSchema = ReturnType<typeof dateOut>;
