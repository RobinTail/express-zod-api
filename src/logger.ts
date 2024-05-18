import { inspect } from "node:util";
import { isObject } from "./common-helpers";
import { Ansis, blue, green, hex, red } from "ansis";

/**
 * @desc Using module augmentation approach you can set the type of the actual logger used
 * @example declare module "express-zod-api" { interface LoggerOverrides extends winston.Logger {} }
 * @link https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation
 * */
export interface LoggerOverrides {}

/** @desc You can use any logger compatible with this type. */
export type AbstractLogger = Record<
  "info" | "debug" | "warn" | "error",
  (message: string, meta?: any) => any
> &
  LoggerOverrides;

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
}

const severity: Record<keyof AbstractLogger, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

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
      output.push(
        inspect(meta, {
          colors: this.config.color,
          depth: this.config.depth,
          breakLength: this.config.level === "debug" ? 80 : Infinity,
          compact: this.config.level === "debug" ? 3 : true,
        }),
      );
    }
    console.log(output.join(" "));
  }

  debug(message: string, meta?: unknown) {
    this.print("debug", message, meta);
  }

  info(message: string, meta?: unknown) {
    this.print("info", message, meta);
  }

  warn(message: string, meta?: unknown) {
    this.print("warn", message, meta);
  }

  error(message: string, meta?: unknown) {
    this.print("error", message, meta);
  }
}

/**
 * @desc Alias for "new BuiltinLogger()"
 * @deprecated use new BuiltinLogger()
 * @todo remove in v20
 * */
export const createLogger = (config: BuiltinLoggerConfig) =>
  new BuiltinLogger(config);
