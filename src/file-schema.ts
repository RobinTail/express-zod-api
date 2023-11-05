import {
  INVALID,
  IssueData,
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
  #makeEncodingIssue(): IssueData {
    return {
      code: ZodIssueCode.custom,
      message:
        this._def.message || `Does not match ${this._def.encoding} encoding`,
    };
  }

  _parse(input: ParseInput): ParseReturnType<T> {
    const { status, ctx } = this._processInputParams(input);
    if (
      ctx.parsedType === ZodParsedType.string &&
      typeof ctx.data === "string"
    ) {
      if (this._def.encoding === "base64") {
        if (!base64Regex.test(ctx.data)) {
          addIssueToContext(ctx, this.#makeEncodingIssue());
          status.dirty();
        }
      }
      return { status: status.value, value: ctx.data as T };
    }

    if (ctx.parsedType === ZodParsedType.object && Buffer.isBuffer(ctx.data)) {
      if (this._def.encoding && !Buffer.isEncoding(this._def.encoding)) {
        addIssueToContext(ctx, this.#makeEncodingIssue());
        status.dirty();
      }
      return { status: status.value, value: ctx.data as T };
    }

    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.string,
      received: ctx.parsedType,
    });
    return INVALID;
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
    new ZodFile<string | Buffer>({ typeName: zodFileKind, type: "" });
}
