import { z } from "zod";

export const ezFileKind = Symbol.for("File");

const bufferSchema = z.custom<Buffer>((subject) => Buffer.isBuffer(subject), {
  message: "Expected Buffer",
});

const variants = {
  buffer: () => bufferSchema.brand(ezFileKind),
  string: () => z.string().brand(ezFileKind),
  binary: () => bufferSchema.or(z.string()).brand(ezFileKind),
  base64: () => z.string().base64().brand(ezFileKind),
};

type Variants = typeof variants;
type Variant = keyof Variants;

export function file(): ReturnType<Variants["string"]>;
export function file<K extends Variant>(variant: K): ReturnType<Variants[K]>;
export function file<K extends Variant>(variant?: K) {
  return variants[variant || "string"]();
}
