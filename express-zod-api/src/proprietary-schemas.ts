import { buffer, type ezBufferBrand } from "./buffer-schema.ts";
import { dateIn, type ezDateInBrand } from "./date-in-schema.ts";
import { dateOut, type ezDateOutBrand } from "./date-out-schema.ts";
import { form, type ezFormBrand } from "./form-schema.ts";
import { raw, type ezRawBrand } from "./raw-schema.ts";
import { upload, type ezUploadBrand } from "./upload-schema.ts";

export const ez = { dateIn, dateOut, form, upload, raw, buffer };

export type ProprietaryBrand =
  | typeof ezFormBrand
  | typeof ezDateInBrand
  | typeof ezDateOutBrand
  | typeof ezUploadBrand
  | typeof ezRawBrand
  | typeof ezBufferBrand;
