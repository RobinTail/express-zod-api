import type { UploadedFile } from "express-fileupload";
import { bench, describe } from "vitest";
import { z } from "zod";
import { ez } from "../../src";
import { proprietary } from "../../src/metadata";
import { bufferSchema } from "../../src/schema-helpers";
import { ezUploadKind } from "../../src/upload-schema";

describe("Experiment", () => {
  const originalFn = () =>
    proprietary(
      ezUploadKind,
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
        (input) => ({
          message: `Expected file upload, received ${typeof input}`,
        }),
      ),
    );

  bench(
    "original",
    () => {
      originalFn().safeParse({
        name: "test",
        encoding: "test",
        mimetype: "test",
        data: "test",
        tempFilePath: "test",
        truncated: false,
        size: 100,
        md5: "test",
      });
    },
    { time: 5000 },
  );

  bench(
    "featured",
    () => {
      ez.upload().safeParse({
        name: "test",
        encoding: "test",
        mimetype: "test",
        data: "test",
        tempFilePath: "test",
        truncated: false,
        size: 100,
        md5: "test",
      });
    },
    { time: 5000 },
  );
});
