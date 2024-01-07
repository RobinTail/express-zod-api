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
import { ErrMessage, errToObj } from "./schema-helpers";

const zodFileKind = "ZodFile";

export interface ZodFileDef<T extends string | Buffer = string | Buffer>
  extends ZodTypeDef {
  typeName: typeof zodFileKind;
  type: T;
  encoding?: "binary" | "base64";
  message?: string;
}

const base64Regex =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export class ZodFile<
  T extends string | Buffer = string | Buffer,
> extends ZodType<T, ZodFileDef<T>, T> {
  _parse(input: ParseInput): ParseReturnType<T> {
    const { status, ctx } = this._processInputParams(input);

    const isParsedString =
      ctx.parsedType === ZodParsedType.string && typeof ctx.data === "string";

    if (this.isString && !isParsedString) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx.parsedType,
      });
      return INVALID;
    }

    const isParsedBuffer =
      ctx.parsedType === ZodParsedType.object && Buffer.isBuffer(ctx.data);

    if (this.isBuffer && !isParsedBuffer) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType,
        message: "Expected Buffer",
      });
      return INVALID;
    }

    if (isParsedString && this.isBase64 && !base64Regex.test(ctx.data)) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.custom,
        message: this._def.message || "Does not match base64 encoding",
      });
      status.dirty();
    }

    return { status: status.value, value: ctx.data as T };
  }

  string = (message?: ErrMessage) =>
    new ZodFile<string>({ ...this._def, ...errToObj(message), type: "" });

  buffer = (message?: ErrMessage) =>
    new ZodFile({
      ...this._def,
      ...errToObj(message),
      type: Buffer.from([]),
    });

  binary = (message?: ErrMessage) =>
    new ZodFile<T>({
      ...this._def,
      ...errToObj(message),
      encoding: "binary",
    });

  base64 = (message?: ErrMessage) =>
    new ZodFile<T>({
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

  get isString() {
    return typeof this._def.type === "string";
  }

  get isBuffer() {
    return Buffer.isBuffer(this._def.type);
  }

  static create = () =>
    new ZodFile<string>({ typeName: zodFileKind, type: "" });
}
