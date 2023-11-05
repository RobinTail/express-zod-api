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

const zodRawKind = "ZodRaw";

export interface ZodRawDef extends ZodTypeDef {
  typeName: typeof zodRawKind;
}

const isBuffer = (subject: unknown): subject is Buffer =>
  Buffer.isBuffer(subject);

// @todo consider reusing existing ZodFile schema instead
export class ZodRaw extends ZodType<Buffer, ZodRawDef> {
  _parse(input: ParseInput): ParseReturnType<Buffer> {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object || !isBuffer(ctx.data)) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.custom,
        message: `Expected raw data (Buffer), received ${ctx.parsedType}`,
      });
      return INVALID;
    }

    return OK(ctx.data);
  }

  static create = () =>
    new ZodRaw({
      typeName: zodRawKind,
    });
}
