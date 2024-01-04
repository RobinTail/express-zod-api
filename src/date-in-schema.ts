import {
  INVALID,
  ParseInput,
  ParseReturnType,
  ZodIssueCode,
  ZodParsedType,
  ZodType,
  ZodTypeDef,
  addIssueToContext,
} from "zod";
import { isValidDate } from "./schema-helpers";

// simple regex for ISO date, supports the following formats:
// 2021-01-01T00:00:00.000Z
// 2021-01-01T00:00:00.0Z
// 2021-01-01T00:00:00Z
// 2021-01-01T00:00:00
// 2021-01-01
export const isoDateRegex =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?)?Z?$/;

const zodDateInKind = "ZodDateIn";

export interface ZodDateInDef extends ZodTypeDef {
  typeName: typeof zodDateInKind;
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

    if (!isoDateRegex.test(ctx.data as string)) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_string,
        validation: "regex",
      });
      status.dirty();
    }

    const date = new Date(ctx.data);

    if (!isValidDate(date)) {
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
    });
}
