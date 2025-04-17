import { z } from "zod";
import type { $ZodShape } from "@zod/core";
import { file } from "./file-schema";

export const ezRawBrand = Symbol("Raw");

const base = z.object({ raw: file("buffer") });

const extended = <S extends $ZodShape>(extra: S) =>
  base.extend(extra).brand(ezRawBrand as symbol);

/** Shorthand for z.object({ raw: ez.file("buffer") }) */
export function raw(): ReturnType<typeof base.brand<symbol>>;
export function raw<S extends $ZodShape>(
  extra: S,
): ReturnType<typeof extended<S>>;
export function raw(extra?: $ZodShape) {
  return extra ? extended(extra) : base.brand(ezRawBrand as symbol);
}

export type RawSchema = ReturnType<typeof raw>;
