import { dateIn, type ezDateInBrand } from "./date-in-schema.ts";
import { dateOut, type ezDateOutBrand } from "./date-out-schema.ts";
import { file, type ezFileBrand } from "./file-schema.ts";
import { raw, type ezRawBrand } from "./raw-schema.ts";
import { upload, type ezUploadBrand } from "./upload-schema.ts";

export const ez = { dateIn, dateOut, file, upload, raw };

export type ProprietaryBrand =
  | typeof ezFileBrand
  | typeof ezDateInBrand
  | typeof ezDateOutBrand
  | typeof ezUploadBrand
  | typeof ezRawBrand;
