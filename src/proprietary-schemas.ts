import { dateIn, ezDateInBrand } from "./date-in-schema";
import { dateOut, ezDateOutBrand } from "./date-out-schema";
import { ezFileBrand, file } from "./file-schema";
import { ezRawBrand, raw } from "./raw-schema";
import { ezUploadBrand, upload } from "./upload-schema";

export const ez = { dateIn, dateOut, file, upload, raw };

export type ProprietaryBrand =
  | typeof ezFileBrand
  | typeof ezDateInBrand
  | typeof ezDateOutBrand
  | typeof ezUploadBrand
  | typeof ezRawBrand;
