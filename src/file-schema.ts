import { z } from "zod";
import { metaProp, withMeta } from "./metadata";
import { bufferSchema } from "./schema-helpers";

export const zodFileKind = "ZodFile";

const base64Regex =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export const file = (
  ...features: Array<"string" | "buffer" | "base64" | "binary">
) => {
  const justString = z.string();
  const schema = withMeta(
    features.includes("buffer")
      ? bufferSchema
      : features.includes("base64")
        ? justString.regex(base64Regex, {
            message: "Does not match base64 encoding",
          })
        : justString,
  );
  schema._def[metaProp].proprietaryKind = zodFileKind;
  return schema;
};

/** Shorthand for z.object({ raw: z.file().buffer() }) */
export const raw = () => z.object({ raw: file("buffer") });
