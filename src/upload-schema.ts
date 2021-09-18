import {UploadedFile} from 'express-fileupload';
import {
  ParseContext,
  ParseReturnType,
  ZodIssueCode,
  ZodParsedType,
  ZodType,
  INVALID,
  OK, ZodString,
} from 'zod';

const zodUploadKind = 'ZodUpload';

// @todo move this to helpers, DNRY

// obtaining the private helper type from Zod
type ErrMessage = Exclude<Parameters<typeof ZodString.prototype.email>[0], undefined>;

// the copy of the private Zod errorUtil.errToObj
const errToObj = (message: ErrMessage | undefined) => typeof message === 'string' ? {message} : message || {};


declare type ZodUploadCheck = {
  kind: 'single';
  message?: string;
} | {
  kind: 'multiple';
  message?: string;
};

export interface ZodUploadDef {
  checks: ZodUploadCheck[];
  typeName: typeof zodUploadKind;
}

const isUploadedFile = (data: any): data is UploadedFile =>
  typeof data === 'object' && data !== null &&
  'name' in data && 'encoding' in data && 'mimetype' in data && 'data' in data && 'tempFilePath' in data &&
  'truncated' in data && 'size' in data && 'md5' in data && 'mv' in data &&
  typeof data.name === 'string' && typeof data.mimetype === 'string' && typeof data.data === 'object' &&
  typeof data.tempFilePath === 'string' && typeof data.truncated === 'boolean' && typeof data.size === 'number' &&
  typeof data.md5 === 'string' && typeof data.mv === 'function';

const isMultipleUploadedFiles = (data: any): data is UploadedFile[] =>
  Array.isArray(data) && data.every((item) => isUploadedFile(item));

export class ZodUpload<T extends UploadedFile | UploadedFile[] = UploadedFile> extends ZodType<T, ZodUploadDef> {
  _parse(
    ctx: ParseContext,
    data: any,
    parsedType: ZodParsedType
  ): ParseReturnType<T> {
    if (
      parsedType !== ZodParsedType.object && parsedType !== ZodParsedType.array &&
      (isUploadedFile(data) || isMultipleUploadedFiles(data))
    ) {
      ctx.addIssue(data, {
        code: ZodIssueCode.custom,
        message: `Expected file upload, received ${parsedType}`
      });
      return INVALID;
    }

    let invalid = false;

    for (const check of this._def.checks) {
      if (
        (check.kind === 'single' && isMultipleUploadedFiles(data)) ||
        (check.kind === 'multiple' && isUploadedFile(data))
      ) {
        invalid = true;
        ctx.addIssue(data, {
          code: ZodIssueCode.custom,
          message: check.message
        });
      }
    }

    return invalid ? INVALID : OK(data);
  }

  single = (message?: ErrMessage) =>
    new ZodUpload<UploadedFile>({
      ...this._def,
      checks: [
        { kind: 'single', ...errToObj(message) },
      ],
    });

  multiple = (message?: ErrMessage) =>
    new ZodUpload<UploadedFile[]>({
      ...this._def,
      checks: [
        { kind: 'multiple', ...errToObj(message) },
      ],
    });

  get isSingle() {
    return !!this._def.checks.find((check) => check.kind === 'single');
  }

  get isMultiple() {
    return !!this._def.checks.find((check) => check.kind === 'multiple');
  }


  static create = () => new ZodUpload({
    checks: [{kind: 'single', message: 'Please upload only single file'}],
    typeName: zodUploadKind
  });
}
