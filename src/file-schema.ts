import {
  ParseReturnType,
  ZodIssueCode,
  ZodParsedType,
  ZodType,
  INVALID,
  ZodTypeDef,
  addIssueToContext,
} from "zod";
import { ParseInput } from "zod/lib/helpers/parseUtil";
import { ErrMessage, errToObj } from "./helpers";

const zodFileKind = "ZodFile";

declare type ZodFileCheck =
  | {
      kind: "binary";
      message?: string;
    }
  | {
      kind: "base64";
      message?: string;
    };

export interface ZodFileDef extends ZodTypeDef {
  checks: ZodFileCheck[];
  typeName: typeof zodFileKind;
}

const base64Regex =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export class ZodFile extends ZodType<string, ZodFileDef> {
  _parse(input: ParseInput): ParseReturnType<string> {
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
      if (check.kind === "base64") {
        if (!base64Regex.test(ctx.data)) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.custom,
            message: check.message,
          });
          status.dirty();
        }
      }
    }

    return { status: status.value, value: ctx.data };
  }

  binary = (message?: ErrMessage) =>
    new ZodFile({
      ...this._def,
      checks: [...this._def.checks, { kind: "binary", ...errToObj(message) }],
    });

  base64 = (message?: ErrMessage) =>
    new ZodFile({
      ...this._def,
      checks: [...this._def.checks, { kind: "base64", ...errToObj(message) }],
    });

  get isBinary() {
    return !!this._def.checks.find((check) => check.kind === "binary");
  }

  get isBase64() {
    return !!this._def.checks.find((check) => check.kind === "base64");
  }

  static create = () =>
    new ZodFile({
      checks: [],
      typeName: zodFileKind,
    });
}
