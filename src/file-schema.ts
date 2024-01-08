import { z } from "zod";
import { proprietary } from "./metadata";
import { base64Regex, bufferSchema } from "./schema-helpers";

export const ezFileKind = "File";

// @todo remove this in v17
const wrap = <T extends z.ZodTypeAny>(
  schema: T,
): ReturnType<typeof proprietary<T>> & Narrowings =>
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  Object.entries(narrowings).reduce(
    (agg, [method, handler]) =>
      Object.defineProperty(agg, method, { get: () => handler }),
    proprietary(ezFileKind, schema),
  ) as ReturnType<typeof proprietary<T>> & Narrowings;

const narrowings = {
  buffer: () => wrap(bufferSchema),
  string: () => wrap(z.string()),
  binary: () => wrap(bufferSchema.or(z.string())),
  base64: () =>
    wrap(z.string().regex(base64Regex, "Does not match base64 encoding")),
};

type Narrowings = typeof narrowings;
type Narrowing = keyof Narrowings;

export function file(): ReturnType<Narrowings["string"]>;
export function file<K extends Narrowing>(type: K): ReturnType<Narrowings[K]>;
export function file<K extends Narrowing>(type?: K) {
  return narrowings[type || "string"]();
}
