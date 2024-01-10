import { z } from "zod";
import { file } from "./file-schema";
import { proprietary } from "./metadata";

export const ezRawKind = "Raw";

/** Shorthand for z.object({ raw: ez.file("buffer") }) */
export const raw = () =>
  proprietary(ezRawKind, z.object({ raw: file("buffer") }));

export type RawSchema = ReturnType<typeof raw>;
