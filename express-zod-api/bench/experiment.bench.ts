import { bench } from "vitest";
import type { UploadedFile } from "express-fileupload";
import { isObjectOfUploadShape } from "../src/upload-schema";
import { z } from "zod";

describe("Experiment for upload schema", () => {
  const current = () =>
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
    );

  const featured = () =>
    z.custom<UploadedFile>(
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
    );

  bench("current", () => {
    const one = current();
    one.safeParse({});
  });

  bench("featured", () => {
    const one = featured();
    one.safeParse({});
  });
});
