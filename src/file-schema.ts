import { z } from "zod";

export const ezFileBrand = Symbol.for("File");

const bufferSchema = z.custom<Buffer>((subject) => Buffer.isBuffer(subject), {
  message: "Expected Buffer",
});

const variants = {
  buffer: () => bufferSchema.brand(ezFileBrand),
  string: () => z.string().brand(ezFileBrand),
  binary: () => bufferSchema.or(z.string()).brand(ezFileBrand),
  base64: () => z.string().base64().brand(ezFileBrand),
};

type Variants = typeof variants;
type Variant = keyof Variants;

export function file(): ReturnType<Variants["string"]>;
export function file<K extends Variant>(variant: K): ReturnType<Variants[K]>;
export function file<K extends Variant>(variant?: K) {
  return variants[variant || "string"]();
}

export type FileSchema = ReturnType<typeof file>;
