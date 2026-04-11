import { z } from "zod";
import { brandProperty } from "./metadata.ts";

export const ezDateOutBrand = Symbol("DateOut");

export interface DateOutParams extends Omit<
  Parameters<z.ZodString["meta"]>[0],
  "examples"
> {
  examples?: string[];
}

export const dateOut = (meta: DateOutParams = {}) =>
  z
    .date()
    .transform((date) => date.toISOString())
    .meta({ ...meta, [brandProperty]: ezDateOutBrand });
