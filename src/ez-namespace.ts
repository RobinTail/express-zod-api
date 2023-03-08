import { ZodDateIn, ZodDateInDef } from "./date-in-schema";
import { ZodDateOut, ZodDateOutDef } from "./date-out-schema";
import { ZodFile, ZodFileDef } from "./file-schema";
import { ZodUpload, ZodUploadDef } from "./upload-schema";

export namespace ez {
  export const file = ZodFile.create;
  export const upload = ZodUpload.create;
  export const dateIn = ZodDateIn.create;
  export const dateOut = ZodDateOut.create;
}

export type ProprietaryKinds =
  | ZodFileDef["typeName"]
  | ZodUploadDef["typeName"]
  | ZodDateInDef["typeName"]
  | ZodDateOutDef["typeName"];
