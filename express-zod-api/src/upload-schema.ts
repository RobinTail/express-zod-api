import type { UploadedFile } from "express-fileupload";
import { z } from "zod";
import { isObject } from "./common-helpers";

export const ezUploadBrand = Symbol("Upload");

/** @internal */
export const isObjectOfUploadShape = (subject: unknown) =>
  isObject(subject) &&
  "name" in subject &&
  "encoding" in subject &&
  "mimetype" in subject &&
  "data" in subject &&
  "tempFilePath" in subject &&
  "truncated" in subject &&
  "size" in subject &&
  "md5" in subject &&
  "mv" in subject;

export const upload = () =>
  z
    .custom<UploadedFile>(
      (subject) =>
        isObjectOfUploadShape(subject) &&
        typeof subject.name === "string" &&
        typeof subject.encoding === "string" &&
        typeof subject.mimetype === "string" &&
        Buffer.isBuffer(subject.data) &&
        typeof subject.tempFilePath === "string" &&
        typeof subject.truncated === "boolean" &&
        typeof subject.size === "number" &&
        typeof subject.md5 === "string" &&
        typeof subject.mv === "function",
      {
        error: ({ input }) => ({
          message: `Expected file upload, received ${typeof input}`,
        }),
      },
    )
    .brand(ezUploadBrand as symbol);
