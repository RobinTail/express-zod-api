import { ZodDate } from "zod";
import { ZodFile } from "./file-schema";
import { ZodUpload } from "./upload-schema";

export * from "zod";
export const file = ZodFile.create;
export const upload = ZodUpload.create;

/** @deprecated Please use z.dateIn() or z.dateOut() */
export const date = ZodDate.create;

export { dateIn, dateOut } from "./date-io-schema";
