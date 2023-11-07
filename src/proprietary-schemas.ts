import { z } from "zod";
import { ZodDateIn } from "./date-in-schema";
import { ZodDateOut } from "./date-out-schema";
import { ZodFile } from "./file-schema";
import { ZodUpload } from "./upload-schema";

export const file = ZodFile.create;
export const upload = ZodUpload.create;
export const dateIn = ZodDateIn.create;
export const dateOut = ZodDateOut.create;

/** Shorthand for z.object({ raw: z.file().buffer() }) */
export const raw = () => z.object({ raw: ZodFile.create().buffer() });
