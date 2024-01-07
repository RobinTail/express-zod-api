import { dateIn, ezDateInKind } from "./date-in-schema";
import { dateOut, ezDateOutKind } from "./date-out-schema";
import { ezFileKind, file } from "./file-schema";
import { ezRawKind, raw } from "./raw-schema";
import { ezUploadKind, upload } from "./upload-schema";

export const ez = { dateIn, dateOut, file, upload, raw };

export type ProprietaryKinds =
  | typeof ezFileKind
  | typeof ezDateInKind
  | typeof ezDateOutKind
  | typeof ezUploadKind
  | typeof ezRawKind;
