import {UploadedFile} from 'express-fileupload';
import {
  ParseContext,
  ParseReturnType,
  ZodIssueCode,
  ZodParsedType,
  ZodType,
  INVALID,
  OK
} from 'zod';

const zodUploadKind = 'ZodUpload';

export interface ZodUploadDef {
  typeName: typeof zodUploadKind;
}

const isUploadedFile = (data: any): data is UploadedFile =>
  typeof data === 'object' && data !== null &&
  'name' in data && 'encoding' in data && 'mimetype' in data && 'data' in data && 'tempFilePath' in data &&
  'truncated' in data && 'size' in data && 'md5' in data && 'mv' in data &&
  typeof data.name === 'string' && typeof data.mimetype === 'string' && typeof data.data === 'object' &&
  typeof data.tempFilePath === 'string' && typeof data.truncated === 'boolean' && typeof data.size === 'number' &&
  typeof data.md5 === 'string' && typeof data.mv === 'function';

export class ZodUpload extends ZodType<UploadedFile, ZodUploadDef> {
  _parse(
    ctx: ParseContext,
    data: any,
    parsedType: ZodParsedType
  ): ParseReturnType<UploadedFile> {
    if (parsedType !== ZodParsedType.object || !isUploadedFile(data)) {
      ctx.addIssue(data, {
        code: ZodIssueCode.custom,
        message: `Expected file upload, received ${parsedType}`
      });
      return INVALID;
    }

    return OK(data);
  }

  static create = () => new ZodUpload({
    typeName: zodUploadKind
  });
}
