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

const uploadedFileSchema = z.object({
  name: z.string(),
  encoding: z.string(),
  mimetype: z.string(),
  data: z.any().refine((subject) => Buffer.isBuffer(subject)),
  tempFilePath: z.string(),
  truncated: z.boolean(),
  size: z.number(),
  md5: z.string(),
  mv: z.function(),
});

const isUploadedFile = (data: unknown): data is UploadedFile =>
  uploadedFileSchema.safeParse(data).success;

export class ZodUpload extends ZodType<UploadedFile, ZodUploadDef> {
  override _parse(input: ParseInput): ParseReturnType<UploadedFile> {
    if (isUploadedFile(input.data)) {
      return OK(input.data);
    }
    const { ctx } = this._processInputParams(input);
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
