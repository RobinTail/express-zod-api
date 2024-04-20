import { z } from "zod";
import { proprietary } from "./metadata";

export const ezFileKind = "File";

const bufferSchema = z.custom<Buffer>((subject) => Buffer.isBuffer(subject), {
  message: "Expected Buffer",
});

/** @todo remove after min zod v3.23 (v19) */
const base64Regex =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const variants = {
  buffer: () => proprietary(ezFileKind, bufferSchema),
  string: () => proprietary(ezFileKind, z.string()),
  binary: () => proprietary(ezFileKind, bufferSchema.or(z.string())),
  base64: () => {
    const base = z.string();
    const hasBase64Method = typeof base.base64 === "function";
    return proprietary(
      ezFileKind,
      hasBase64Method
        ? base.base64()
        : base.regex(base64Regex, "Does not match base64 encoding"), // @todo remove after min zod v3.23 (v19)
    );
  },
};

type Variants = typeof variants;
type Variant = keyof Variants;

export function file(): ReturnType<Variants["string"]>;
export function file<K extends Variant>(variant: K): ReturnType<Variants[K]>;
export function file<K extends Variant>(variant?: K) {
  return variants[variant || "string"]();
}
