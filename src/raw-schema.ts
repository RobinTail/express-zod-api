import { z } from "zod";
import { file } from "./file-schema";

export const ezRawBrand = Symbol.for("Raw");

/** Shorthand for z.object({ raw: ez.file("buffer") }) */
export const raw = <S extends z.ZodRawShape>(extra: S = {} as S) =>
  z
    .object({ raw: file("buffer") })
    .extend(extra)
    .brand(ezRawBrand);

export type RawSchema = ReturnType<typeof raw>;
