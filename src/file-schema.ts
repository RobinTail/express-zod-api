import { z } from "zod";
import { metaProp, withMeta } from "./metadata";
import { bufferSchema } from "./schema-helpers";

export const zodFileKind = "ZodFile";

const base64Regex =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

type Narrowing = "string" | "buffer" | "base64" | "binary";

/** @todo remove in v17 */
interface DeprecatedMethods extends Record<Narrowing, () => z.ZodType> {
  /** @deprecated use ez.file("buffer") instead */
  buffer: () => z.ZodType<Buffer>;
  /** @deprecated use ez.file("string") instead */
  string: () => z.ZodString;
  /** @deprecated use ez.file("base64") instead */
  base64: () => z.ZodString;
  /** @deprecated use ez.file("binary") instead */
  binary: () => z.ZodUnion<[z.ZodType<Buffer>, z.ZodString]>;
}

export const file = (type?: Narrowing) => {
  const justString = z.string();
  const base64String = justString.regex(base64Regex, {
    message: "Does not match base64 encoding",
  });
  const schema = withMeta(
    type === "buffer"
      ? bufferSchema
      : type === "base64"
        ? base64String
        : type === "binary"
          ? bufferSchema.or(justString)
          : justString,
  );
  schema._def[metaProp].proprietaryKind = zodFileKind;
  /** @todo remove this hack in v17 */
  (schema as any).buffer = () => file("buffer");
  (schema as any).string = () => file("string");
  (schema as any).base64 = () => file("base64");
  (schema as any).binary = () => file("binary");
  return schema as typeof schema & DeprecatedMethods;
};

/** Shorthand for z.object({ raw: ez.file("buffer") }) */
export const raw = () => z.object({ raw: file("buffer") });
