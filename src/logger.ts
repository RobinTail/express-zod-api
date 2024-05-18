import { inspect } from "node:util";
import { FlatObject, isObject } from "./common-helpers";
import { Ansis, blue, cyanBright, green, hex, red } from "ansis";

/** @desc You can use any logger compatible with this type. */
export type AbstractLogger = Record<
  "info" | "debug" | "warn" | "error",
  (message: string, meta?: any) => any
>;

/**
 * @desc Using module augmentation approach you can set the type of the actual logger used
 * @example declare module "express-zod-api" { interface LoggerOverrides extends winston.Logger {} }
 * @link https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation
 * */
export interface LoggerOverrides {}

export type ActualLogger = AbstractLogger & LoggerOverrides;

interface Context extends FlatObject {
  requestId?: string;
}

export interface BuiltinLoggerConfig {
  /**
   * @desc The minimal severity to log or "silent" to disable logging
   * @example "debug" also enables pretty output for inspected entities
   * */
  level: "silent" | "warn" | "info" | "debug";
  /**
   * @desc Enables colors on printed severity and inspected entities
   * @default Ansis::isSupported()
   * */
  color?: boolean;
  /**
   * @desc Control how deeply entities should be inspected
   * @default 2
   * @example null
   * @example Infinity
   * */
  depth?: number | null;
  /**
   * @desc Context: the metadata applicable for each logged entry, used by .child() method
   * @see childLoggerProvider
   * */
  ctx?: Context;
}

const severity: Record<keyof AbstractLogger, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** @todo isLoggerInstance */
export const isActualLogger = (subject: unknown): subject is AbstractLogger =>
  isObject(subject) &&
  Object.keys(severity).some((method) => method in subject);

/** @desc Built-in console logger with optional colorful inspections */
export class BuiltinLogger implements AbstractLogger {
  protected readonly styles: Record<keyof AbstractLogger, Ansis> = {
    debug: blue,
    info: green,
    warn: hex("#FFA500"),
    error: red,
  };

  /** @example new BuiltinLogger({ level: "debug", color: true, depth: 4 }) */
  public constructor(protected config: BuiltinLoggerConfig) {}

  protected prettyPrint(subject: unknown) {
    return inspect(subject, {
      colors: this.config.color,
      depth: this.config.depth,
      breakLength: this.config.level === "debug" ? 80 : Infinity,
      compact: this.config.level === "debug" ? 3 : true,
    });
  }

  protected print(method: keyof AbstractLogger, message: string, meta?: any) {
    if (
      this.config.level === "silent" ||
      severity[method] < severity[this.config.level]
    ) {
      return;
    }
    const output: string[] = [
      new Date().toISOString(),
      this.config.color ? `${this.styles[method](method)}:` : `${method}:`,
      message,
    ];
    if (meta !== undefined) {
      output.push(this.prettyPrint(meta));
    }
    if (this.config.ctx) {
      const { requestId, ...rest } = this.config.ctx;
      if (requestId) {
        output.splice(1, 0, cyanBright(requestId));
      }
      if (Object.keys(rest).length > 0) {
        output.push(this.prettyPrint(rest));
      }
    }
    console.log(output.join(" "));
  }

  public debug(message: string, meta?: unknown) {
    this.print("debug", message, meta);
  }

  public info(message: string, meta?: unknown) {
    this.print("info", message, meta);
  }

  public warn(message: string, meta?: unknown) {
    this.print("warn", message, meta);
  }

  public error(message: string, meta?: unknown) {
    this.print("error", message, meta);
  }

  public child(ctx: Context) {
    return new BuiltinLogger({ ...this.config, ctx });
  }
}

/**
 * @desc Alias for "new BuiltinLogger()"
 * @deprecated use new BuiltinLogger()
 * @todo remove in v20
 * */
export const createLogger = (config: BuiltinLoggerConfig) =>
  new BuiltinLogger(config);
