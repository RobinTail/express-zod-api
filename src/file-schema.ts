import {
  ParseContext,
  ParseReturnType,
  ZodIssueCode,
  ZodParsedType,
  ZodType,
  INVALID,
  OK
} from 'zod';
import {ErrMessage, errToObj} from './helpers';

const zodFileKind = 'ZodFile';

declare type ZodFileCheck = {
  kind: 'binary';
  message?: string;
} | {
  kind: 'base64';
  message?: string;
};

export interface ZodFileDef {
  checks: ZodFileCheck[];
  typeName: typeof zodFileKind;
}

const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export class ZodFile extends ZodType<string, ZodFileDef> {
  _parse(
    ctx: ParseContext,
    data: any,
    parsedType: ZodParsedType
  ): ParseReturnType<string> {
    if (parsedType !== ZodParsedType.string) {
      ctx.addIssue(data, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: parsedType,
      });
      return INVALID;
    }
    let invalid = false;

    for (const check of this._def.checks) {
      if (check.kind === 'base64') {
        if (!base64Regex.test(data)) {
          invalid = true;
          ctx.addIssue(data, {
            code: ZodIssueCode.custom,
            message: check.message,
          });
        }
      }
    }

    return invalid ? INVALID : OK(data);
  }

  binary = (message?: ErrMessage) =>
    new ZodFile({
      ...this._def,
      checks: [
        ...this._def.checks,
        { kind: 'binary', ...errToObj(message) },
      ],
    });

  base64 = (message?: ErrMessage) =>
    new ZodFile({
      ...this._def,
      checks: [
        ...this._def.checks,
        { kind: 'base64', ...errToObj(message) },
      ],
    });

  get isBinary() {
    return !!this._def.checks.find((check) => check.kind === 'binary');
  }

  get isBase64() {
    return !!this._def.checks.find((check) => check.kind === 'base64');
  }

  static create = () => new ZodFile({
    checks: [],
    typeName: zodFileKind
  });
}
