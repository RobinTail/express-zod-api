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
import { isValidDate } from "./common-helpers";

const zodDateOutKind = "ZodDateOut";

export interface ZodDateOutDef extends ZodTypeDef {
  typeName: typeof zodDateOutKind;
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

    if (!isValidDate(ctx.data)) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_date,
      });
      return INVALID;
    }

    return { status: status.value, value: (ctx.data as Date).toISOString() };
  }

  static create = () =>
    new ZodDateOut({
      typeName: zodDateOutKind,
    });
}
