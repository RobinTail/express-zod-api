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
declare type ZodDateInCheck = {
  kind: "iso";
  message?: string;
};

export interface ZodDateInDef extends ZodTypeDef {
  typeName: typeof zodDateInKind;
  checks: ZodDateInCheck[];
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

    for (const check of this._def.checks) {
      if (check.kind === "iso") {
        if (!isoDateRegex.test(ctx.data)) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.custom,
            message: check.message,
          });
          status.dirty();
        }
      }
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

  static create = () =>
    new ZodDateIn({
      typeName: zodDateInKind,
      checks: [{ kind: "iso", message: "Invalid date format" }], // @todo optional?
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

  static create = () =>
    new ZodDateOut({
      typeName: zodDateOutKind,
      transformer: (date) => date.toISOString(),
    });
}
