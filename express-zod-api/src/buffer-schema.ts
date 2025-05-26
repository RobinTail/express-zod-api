import { z } from "zod/v4";

export const bufferSchema = z.custom<Buffer>(
  (subject) => Buffer.isBuffer(subject),
  { error: "Expected Buffer" },
);
