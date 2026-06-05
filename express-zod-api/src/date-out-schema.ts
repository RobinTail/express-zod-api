import { z } from "zod";
import { brandProperty } from "./metadata";

export const ezDateOutBrand = Symbol("DateOut");

export interface DateOutParams extends z.core.GlobalMeta {
  examples?: string[];
}

export const dateOut = (meta: DateOutParams = {}) =>
  z
    .date()
    .transform((date) => date.toISOString())
    .pipe(z.iso.datetime())
    .meta({ ...meta, [brandProperty]: ezDateOutBrand });
