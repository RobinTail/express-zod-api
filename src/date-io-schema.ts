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
  refinement: (str: string) => boolean;
  invalidFormatMessage: string;
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

    if (!this._def.refinement(ctx.data)) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.custom,
        message: this._def.invalidFormatMessage,
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

  // @todo add params
  static create = () =>
    new ZodDateIn({
      typeName: zodDateInKind,
      refinement: (str) => isoDateRegex.test(str),
      invalidFormatMessage: "Invalid date format",
    });
}

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

  // @todo add params
  static create = () =>
    new ZodDateOut({
      typeName: zodDateOutKind,
      transformer: (date) => date.toISOString(),
    });
}
