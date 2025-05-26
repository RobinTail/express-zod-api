import { z } from "zod/v4";

export const ezDownloadBrand = Symbol("Download");

const bufferSchema = z.custom<Buffer>((subject) => Buffer.isBuffer(subject), {
  message: "Expected Buffer",
});

const variants = {
  buffer: () => bufferSchema.brand(ezDownloadBrand as symbol),
  string: () => z.string().brand(ezDownloadBrand as symbol),
  binary: () => bufferSchema.or(z.string()).brand(ezDownloadBrand as symbol),
  base64: () => z.base64().brand(ezDownloadBrand as symbol),
};

type Variants = typeof variants;
type Variant = keyof Variants;

export function download(): ReturnType<Variants["string"]>;
export function download<K extends Variant>(
  variant: K,
): ReturnType<Variants[K]>;
export function download<K extends Variant>(variant?: K) {
  return variants[variant || "string"]();
}

export type DownloadSchema = ReturnType<typeof download>;
