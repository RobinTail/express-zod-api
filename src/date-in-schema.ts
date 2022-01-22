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

// simple regex for ISO date, supports the following formats:
// 2021-01-01T00:00:00.000Z
// 2021-01-01T00:00:00Z
// 2021-01-01T00:00:00
// 2021-01-01
const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?)?Z?$/;

const zodDateInKind = "ZodDateIn";

export interface ZodDateInDef extends ZodTypeDef {
  typeName: typeof zodDateInKind;
  check: (str: string) => boolean;
  checkErrorMessage: string;
}
export class ZodDateIn extends ZodType<Date, ZodDateInDef, string> {
  _parse(input: ParseInput): ParseReturnType<Date> {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.string) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx.parsedType,
      });
      return INVALID;
    }

    if (!this._def.check(ctx.data)) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.custom,
        message: this._def.checkErrorMessage,
      });
      status.dirty();
    }

    const date = new Date(ctx.data);

    if (isNaN(date.getTime())) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_date,
      });
      return INVALID;
    }

    return { status: status.value, value: date };
  }

  static create = (check?: ZodDateInDef["check"], message?: string) =>
    new ZodDateIn({
      typeName: zodDateInKind,
      check: check || ((str) => isoDateRegex.test(str)),
      checkErrorMessage: message || "Invalid date format",
    });
}
