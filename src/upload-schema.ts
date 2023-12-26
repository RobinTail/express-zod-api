import type { UploadedFile } from "express-fileupload";
import {
  INVALID,
  OK,
  ParseInput,
  ParseReturnType,
  ZodIssueCode,
  ZodParsedType,
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
  _parse(input: ParseInput): ParseReturnType<UploadedFile> {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType === ZodParsedType.object && isUploadedFile(ctx.data)) {
      return OK(ctx.data);
    }
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
