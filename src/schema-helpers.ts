import { z } from "zod";

export const isValidDate = (date: Date): boolean => !isNaN(date.getTime());

export const bufferSchema = z.custom<Buffer>(
  (subject) => Buffer.isBuffer(subject),
  { message: "Expected Buffer" },
);
