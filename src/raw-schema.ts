import { z } from "zod";
import { file } from "./file-schema";
import { proprietary } from "./metadata";

export const zodRawKind = "ZodRaw";

/** Shorthand for z.object({ raw: ez.file("buffer") }) */
export const raw = () =>
  proprietary(zodRawKind, z.object({ raw: file("buffer") }));
