import { z } from "zod";

export const ezFileBrand = Symbol("File");

const bufferSchema = z.custom<Buffer>((subject) => Buffer.isBuffer(subject), {
  message: "Expected Buffer",
});

const variants = {
  buffer: () => bufferSchema.brand(ezFileBrand as symbol),
  string: () => z.string().brand(ezFileBrand as symbol),
  binary: () => bufferSchema.or(z.string()).brand(ezFileBrand as symbol),
  base64: () => z.base64().brand(ezFileBrand as symbol),
};

type Variants = typeof variants;
type Variant = keyof Variants;

export function file(): ReturnType<Variants["string"]>;
export function file<K extends Variant>(variant: K): ReturnType<Variants[K]>;
export function file<K extends Variant>(variant?: K) {
  return variants[variant || "string"]();
}

export type FileSchema = ReturnType<typeof file>;
