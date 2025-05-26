import { z } from "zod";
import { file } from "./file-schema";

export const ezRawBrand = Symbol("Raw");

const base = z.object({ raw: file("buffer") });

export function raw(): z.ZodBranded<typeof base, symbol>;
export function raw<S extends z.ZodRawShape>(
  extra: S,
): z.ZodBranded<ReturnType<typeof base.extend<S>>, symbol>;
export function raw(extra?: z.ZodRawShape) {
  return (extra ? base.extend(extra) : base).brand(ezRawBrand);
}

export type RawSchema = ReturnType<typeof raw>;
