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
import { ErrMessage, errToObj } from "./common-helpers";

const zodFileKind = "ZodFile";

export interface ZodFileDef extends ZodTypeDef {
  typeName: typeof zodFileKind;
  encoding?: "binary" | "base64";
  message?: string;
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

    if (this._def.encoding === "base64") {
      if (!base64Regex.test(ctx.data)) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.custom,
          message: this._def.message || "Does not match base64 encoding",
        });
        status.dirty();
      }
    }

    return { status: status.value, value: ctx.data };
  }

  binary = (message?: ErrMessage) =>
    new ZodFile({
      ...this._def,
      ...errToObj(message),
      encoding: "binary",
    });

  base64 = (message?: ErrMessage) =>
    new ZodFile({
      ...this._def,
      ...errToObj(message),
      encoding: "base64",
    });

  get isBinary() {
    return this._def.encoding === "binary";
  }

  get isBase64() {
    return this._def.encoding === "base64";
  }

  static create = () => new ZodFile({ typeName: zodFileKind });
}
