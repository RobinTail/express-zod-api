import { z } from "zod";

export const isValidDate = (date: Date): boolean => !isNaN(date.getTime());

export const bufferSchema = z.custom<Buffer>(
  (subject) => Buffer.isBuffer(subject),
  { message: "Expected Buffer" },
);

export const base64Regex =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/**
 * @example 2021-01-01T00:00:00.000Z
 * @example 2021-01-01T00:00:00.0Z
 * @example 2021-01-01T00:00:00Z
 * @example 2021-01-01T00:00:00
 * @example 2021-01-01
 */
export const isoDateRegex =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?)?Z?$/;
