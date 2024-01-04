// obtaining the private helper type from Zod
import { z } from "zod";

export type ErrMessage = Exclude<
  Parameters<typeof z.ZodString.prototype.email>[0],
  undefined
>;

// the copy of the private Zod errorUtil.errToObj
export const errToObj = (message: ErrMessage | undefined) =>
  typeof message === "string" ? { message } : message || {};

export const isValidDate = (date: Date): boolean => !isNaN(date.getTime());

export const bufferSchema = z.custom<Buffer>((subject) =>
  Buffer.isBuffer(subject),
);
