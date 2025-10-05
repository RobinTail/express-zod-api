import { z } from "zod";
import { buffer } from "./buffer-schema.ts";

export const ezRawBrand = Symbol("Raw");

const base = z.object({ raw: buffer() });
type Base = ReturnType<typeof base.brand<symbol>>;

const extended = <S extends z.core.$ZodShape>(extra: S) =>
  base.extend(extra).brand(ezRawBrand as symbol);

export function raw(): Base;
export function raw<S extends z.core.$ZodShape>(
  extra: S,
): ReturnType<typeof extended<S>>;
export function raw(extra?: z.core.$ZodShape) {
  return extra ? extended(extra) : base.brand(ezRawBrand as symbol);
}

export type RawSchema = Base;
