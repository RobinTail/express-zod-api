import { z } from "zod";
import { ZodDateIn } from "./date-in-schema";
import { ZodDateOut } from "./date-out-schema";
import { ZodFile } from "./file-schema";
import { metaProp, withMeta } from "./metadata";
import { getUploadSchema, zodUploadKind } from "./upload-schema";

export const file = ZodFile.create;
// @todo reconsider location
export const upload = () => {
  const schema = withMeta(getUploadSchema());
  schema._def[metaProp].proprietaryKind = zodUploadKind;
  return schema;
};
export const dateIn = ZodDateIn.create;
export const dateOut = ZodDateOut.create;

/** Shorthand for z.object({ raw: z.file().buffer() }) */
export const raw = () => z.object({ raw: ZodFile.create().buffer() });
