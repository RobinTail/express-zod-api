import type { UploadedFile } from "express-fileupload";
import {
  INVALID,
  OK,
  ParseInput,
  ParseReturnType,
  ZodIssueCode,
  ZodType,
  ZodTypeDef,
  addIssueToContext,
  z,
} from "zod";

const zodUploadKind = "ZodUpload";

export interface ZodUploadDef extends ZodTypeDef {
  typeName: typeof zodUploadKind;
}

const bufferSchema = z.custom<Buffer>((subject) => Buffer.isBuffer(subject));
const uploadedFileSchema = z.object({
  name: z.string(),
  encoding: z.string(),
  mimetype: z.string(),
  data: bufferSchema,
  tempFilePath: z.string(),
  truncated: z.boolean(),
  size: z.number(),
  md5: z.string(),
  mv: z.function(),
});

export class ZodUpload extends ZodType<UploadedFile, ZodUploadDef> {
  override _parse(input: ParseInput): ParseReturnType<UploadedFile> {
    if (uploadedFileSchema.safeParse(input.data).success) {
      return OK(input.data);
    }
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.custom,
      message: `Expected file upload, received ${ctx.parsedType}`,
    });
    return INVALID;
  }

  static create = () =>
    new ZodUpload({
      typeName: zodUploadKind,
    });
}
