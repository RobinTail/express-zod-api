import { z } from "zod/v4";

export const ezDateOutBrand = Symbol("DateOut");

export const dateOut = () =>
  z
    .date()
    .transform((date) => date.toISOString())
    .brand(ezDateOutBrand as symbol);

export type DateOutSchema = ReturnType<typeof dateOut>;
