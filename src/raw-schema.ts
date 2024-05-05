import { z } from "zod";
import { file } from "./file-schema";

export const ezRawKind = Symbol.for("Raw");

/** Shorthand for z.object({ raw: ez.file("buffer") }) */
export const raw = (extra?: z.ZodRawShape) =>
  z
    .object({ raw: file("buffer") })
    .extend(extra || {})
    .brand(ezRawKind);

export type RawSchema = ReturnType<typeof raw>;
