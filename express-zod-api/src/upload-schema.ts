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
} from "zod";

const zodUploadKind = "ZodUpload";

export interface ZodUploadDef extends ZodTypeDef {
  typeName: typeof zodUploadKind;
}

const isUploadedFile = (data: unknown): data is UploadedFile =>
  typeof data === "object" &&
  data !== null &&
  "name" in data &&
  "encoding" in data &&
  "mimetype" in data &&
  "data" in data &&
  "tempFilePath" in data &&
  "truncated" in data &&
  "size" in data &&
  "md5" in data &&
  "mv" in data &&
  typeof data.name === "string" &&
  typeof data.mimetype === "string" &&
  typeof data.data === "object" &&
  typeof data.tempFilePath === "string" &&
  typeof data.truncated === "boolean" &&
  typeof data.size === "number" &&
  typeof data.md5 === "string" &&
  typeof data.mv === "function";

export class ZodUpload extends ZodType<UploadedFile, ZodUploadDef> {
  _parse(input: ParseInput): ParseReturnType<UploadedFile> {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object || !isUploadedFile(ctx.data)) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.custom,
        message: `Expected file upload, received ${ctx.parsedType}`,
      });
      return INVALID;
    }

    return OK(ctx.data);
  }

  static create = () =>
    new ZodUpload({
      typeName: zodUploadKind,
    });
}
