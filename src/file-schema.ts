import { z } from "zod";
import { proprietary } from "./metadata";
import { base64Regex, bufferSchema } from "./schema-helpers";

export const ezFileKind = "File";

// @todo remove this in v17
const wrap = <T extends z.ZodTypeAny>(
  schema: T,
): ReturnType<typeof proprietary<T>> & Variants =>
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  Object.entries(variants).reduce(
    (agg, [method, handler]) =>
      Object.defineProperty(agg, method, { get: () => handler }),
    proprietary(ezFileKind, schema),
  ) as ReturnType<typeof proprietary<T>> & Variants;

const variants = {
  /** @deprecated use ez.file("buffer") instead */
  buffer: () => wrap(bufferSchema),
  /** @deprecated use ez.file("string") instead */
  string: () => wrap(z.string()),
  /** @deprecated use ez.file("binary") instead */
  binary: () => wrap(bufferSchema.or(z.string())),
  /** @deprecated use ez.file("base64") instead */
  base64: () =>
    wrap(z.string().regex(base64Regex, "Does not match base64 encoding")),
};

type Variants = typeof variants;
type Variant = keyof Variants;

export function file(): ReturnType<Variants["string"]>;
export function file<K extends Variant>(variant: K): ReturnType<Variants[K]>;
export function file<K extends Variant>(variant?: K) {
  return variants[variant || "string"]();
}
