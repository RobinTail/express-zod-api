import { z } from "zod";
import { proprietary } from "./metadata";
import { base64Regex, bufferSchema } from "./schema-helpers";

export const ezFileKind = "File";

const variants = {
  buffer: () => proprietary(ezFileKind, bufferSchema),
  string: () => proprietary(ezFileKind, z.string()),
  binary: () => proprietary(ezFileKind, bufferSchema.or(z.string())),
  base64: () =>
    proprietary(
      ezFileKind,
      z.string().regex(base64Regex, "Does not match base64 encoding"),
    ),
};

type Variants = typeof variants;
type Variant = keyof Variants;

export function file(): ReturnType<Variants["string"]>;
export function file<K extends Variant>(variant: K): ReturnType<Variants[K]>;
export function file<K extends Variant>(variant?: K) {
  return variants[variant || "string"]();
}
