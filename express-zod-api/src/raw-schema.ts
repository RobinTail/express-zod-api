import { z } from "zod/v4";
import type { $ZodShape } from "zod/v4/core";
import { buffer } from "./buffer-schema";

export const ezRawBrand = Symbol("Raw");

const base = z.object({ raw: buffer() });
type Base = ReturnType<typeof base.brand<symbol>>;

const extended = <S extends $ZodShape>(extra: S) =>
  base.extend(extra).brand(ezRawBrand as symbol);

export function raw(): Base;
export function raw<S extends $ZodShape>(
  extra: S,
): ReturnType<typeof extended<S>>;
export function raw(extra?: $ZodShape) {
  return extra ? extended(extra) : base.brand(ezRawBrand as symbol);
}

export type RawSchema = Base;
