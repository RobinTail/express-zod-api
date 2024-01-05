import { z } from "zod";
export { dateIn } from "./date-in-schema";
export { dateOut } from "./date-out-schema";
import { ZodFile } from "./file-schema";
export { upload } from "./upload-schema";

export const file = ZodFile.create;

/** Shorthand for z.object({ raw: z.file().buffer() }) */
export const raw = () => z.object({ raw: ZodFile.create().buffer() });
