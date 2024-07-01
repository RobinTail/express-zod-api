import { dateIn, type ezDateInBrand } from "./date-in-schema";
import { dateOut, type ezDateOutBrand } from "./date-out-schema";
import { file, type ezFileBrand } from "./file-schema";
import { raw, type ezRawBrand } from "./raw-schema";
import { upload, type ezUploadBrand } from "./upload-schema";

export const ez = { dateIn, dateOut, file, upload, raw };

export type ProprietaryBrand =
  | typeof ezFileBrand
  | typeof ezDateInBrand
  | typeof ezDateOutBrand
  | typeof ezUploadBrand
  | typeof ezRawBrand;
