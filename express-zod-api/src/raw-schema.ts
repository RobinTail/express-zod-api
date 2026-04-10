import { z } from "zod";
import { buffer } from "./buffer-schema";
import { brandProperty } from "./brand";

export const ezRawBrand = Symbol("Raw");

const base = z.object({ raw: buffer() });
type Base = z.ZodObject<{ raw: z.ZodType<Buffer> }>;

const extended = <S extends z.core.$ZodShape>(extra: S) =>
  base.extend(extra).meta({ [brandProperty]: ezRawBrand });

export function raw(): Base;
export function raw<S extends z.core.$ZodShape>(
  extra: S,
): ReturnType<typeof extended<S>>;
export function raw(extra?: z.core.$ZodShape) {
  return extra ? extended(extra) : base.meta({ [brandProperty]: ezRawBrand });
}

export type RawSchema = Base;
