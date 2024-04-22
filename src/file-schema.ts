import { z } from "zod";
import { proprietary } from "./metadata";

export const ezFileKind = "File";

const bufferSchema = z.custom<Buffer>((subject) => Buffer.isBuffer(subject), {
  message: "Expected Buffer",
});

const variants = {
  buffer: () => proprietary(ezFileKind, bufferSchema),
  string: () => proprietary(ezFileKind, z.string()),
  binary: () => proprietary(ezFileKind, bufferSchema.or(z.string())),
  base64: () => {
    const base = z.string();
    return proprietary(ezFileKind, base.base64());
  },
};

type Variants = typeof variants;
type Variant = keyof Variants;

export function file(): ReturnType<Variants["string"]>;
export function file<K extends Variant>(variant: K): ReturnType<Variants[K]>;
export function file<K extends Variant>(variant?: K) {
  return variants[variant || "string"]();
}
