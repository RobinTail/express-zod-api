import type { UploadedFile } from "express-fileupload";
import { z } from "zod";
import { bufferSchema } from "./schema-helpers";

export const zodUploadKind = "ZodUpload";

// @todo simplify all that
export const getUploadSchema = () =>
  z.custom<UploadedFile>(
    (subject) =>
      z
        .object({
          name: z.string(),
          encoding: z.string(),
          mimetype: z.string(),
          data: bufferSchema,
          tempFilePath: z.string(),
          truncated: z.boolean(),
          size: z.number(),
          md5: z.string(),
          mv: z.function(),
        })
        .safeParse(subject).success,
    (input) => ({ message: `Expected file upload, received ${typeof input}` }),
  );
