import type { UploadedFile } from "express-fileupload";
import { z } from "zod";
import { proprietary } from "./metadata";

export const ezUploadKind = "Upload";

export const upload = () =>
  proprietary(
    ezUploadKind,
    z.custom<UploadedFile>(
      (subject) =>
        typeof subject === "object" &&
        subject !== null &&
        "name" in subject &&
        "encoding" in subject &&
        "mimetype" in subject &&
        "data" in subject &&
        "tempFilePath" in subject &&
        "truncated" in subject &&
        "size" in subject &&
        "md5" in subject &&
        "mv" in subject &&
        typeof subject.name === "string" &&
        typeof subject.encoding === "string" &&
        typeof subject.mimetype === "string" &&
        Buffer.isBuffer(subject.data) &&
        typeof subject.tempFilePath === "string" &&
        typeof subject.truncated === "boolean" &&
        typeof subject.size === "number" &&
        typeof subject.md5 === "string" &&
        typeof subject.mv === "function",
      (input) => ({
        message: `Expected file upload, received ${typeof input}`,
      }),
    ),
  );
