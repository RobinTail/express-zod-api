import { buffer, type ezBufferBrand } from "./buffer-schema";
import { dateIn, type ezDateInBrand } from "./date-in-schema";
import { dateOut, type ezDateOutBrand } from "./date-out-schema";
import { form, type ezFormBrand } from "./form-schema";
import { file, type ezFileBrand } from "./file-schema";
import { raw, type ezRawBrand } from "./raw-schema";
import { upload, type ezUploadBrand } from "./upload-schema";

export const ez = { dateIn, dateOut, form, file, upload, raw, buffer };

export type ProprietaryBrand =
  | typeof ezFormBrand
  | typeof ezFileBrand
  | typeof ezDateInBrand
  | typeof ezDateOutBrand
  | typeof ezUploadBrand
  | typeof ezRawBrand
  | typeof ezBufferBrand;
