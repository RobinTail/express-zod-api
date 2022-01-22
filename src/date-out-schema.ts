import {
  addIssueToContext,
  INVALID,
  ParseInput,
  ParseReturnType,
  ZodIssueCode,
  ZodParsedType,
  ZodType,
  ZodTypeDef,
} from "zod";

const zodDateOutKind = "ZodDateOut";

export interface ZodDateOutDef extends ZodTypeDef {
  typeName: typeof zodDateOutKind;
  transformer: (date: Date) => string;
}

export class ZodDateOut extends ZodType<string, ZodDateOutDef, Date> {
  _parse(input: ParseInput): ParseReturnType<string> {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.date) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx.parsedType,
      });
      return INVALID;
    }

    try {
      return { status: status.value, value: this._def.transformer(ctx.data) };
    } catch (e) {
      if (e instanceof Error) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.custom,
          message: e.message,
        });
      }
      return INVALID;
    }
  }

  static create = (transform?: ZodDateOutDef["transformer"]) =>
    new ZodDateOut({
      typeName: zodDateOutKind,
      transformer: transform || ((date) => date.toISOString()),
    });
}
