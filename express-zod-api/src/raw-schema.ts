import { z } from "zod";
import { file } from "./file-schema.ts";

export const ezRawBrand = Symbol("Raw");

/** Shorthand for z.object({ raw: ez.file("buffer") }) */
export const raw = <S extends z.ZodRawShape>(extra: S = {} as S) =>
  z
    .object({ raw: file("buffer") })
    .extend(extra)
    .brand(ezRawBrand as symbol);

export type RawSchema = ReturnType<typeof raw>;
