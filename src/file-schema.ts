import { z } from "zod";
import { proprietary } from "./metadata";
import { base64Regex, bufferSchema } from "./schema-helpers";

export const zodFileKind = "ZodFile";

type Narrowing = "string" | "buffer" | "base64" | "binary";

/** @todo remove in v17 */
const deprecatedMethods = {
  /* eslint-disable @typescript-eslint/no-use-before-define */
  buffer: () => file("buffer"),
  string: () => file("string"),
  base64: () => file("base64"),
  binary: () => file("binary"),
};

export function file(
  type?: "string" | "base64",
): z.ZodString & typeof deprecatedMethods;

export function file(
  type: "binary",
): z.ZodUnion<[z.ZodType<Buffer>, z.ZodString]> & typeof deprecatedMethods;

export function file(
  type: "buffer",
): z.ZodType<Buffer> & typeof deprecatedMethods;

export function file(
  type?: Narrowing,
): (
  | z.ZodString
  | z.ZodType<Buffer>
  | z.ZodUnion<[z.ZodType<Buffer>, z.ZodString]>
) &
  typeof deprecatedMethods {
  const schema = proprietary(
    zodFileKind,
    type === "buffer"
      ? bufferSchema
      : type === "base64"
        ? z.string().regex(base64Regex, "Does not match base64 encoding")
        : type === "binary"
          ? bufferSchema.or(z.string())
          : z.string(),
  );
  /** @todo remove this hack in v17 */
  for (const [method, handler] of Object.entries(deprecatedMethods)) {
    (schema as any)[method] = handler;
  }
  return schema as typeof schema & typeof deprecatedMethods;
}

/** Shorthand for z.object({ raw: ez.file("buffer") }) */
export const raw = () => z.object({ raw: file("buffer") });
