import { z } from "zod";
import { ZodDateIn } from "./date-in-schema";
import { ZodDateOut } from "./date-out-schema";
import { ZodFile } from "./file-schema";
import { getUploadSchema } from "./upload-schema";

export const file = ZodFile.create;
export const upload = getUploadSchema;
export const dateIn = ZodDateIn.create;
export const dateOut = ZodDateOut.create;

/** Shorthand for z.object({ raw: z.file().buffer() }) */
export const raw = () => z.object({ raw: ZodFile.create().buffer() });
