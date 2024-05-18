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

export class BuiltinLogger implements AbstractLogger {
  protected isDebug: boolean;
  protected minSeverity: number;
  protected hasColor: boolean;
  protected depth: number | null;
  protected readonly styles: Record<keyof AbstractLogger, Ansis> = {
    debug: blue,
    info: green,
    warn: hex("#FFA500"),
    error: red,
  };

  constructor({
    level,
    color = new Ansis().isSupported(),
    depth = 2,
  }: BuiltinLoggerConfig) {
    this.hasColor = color;
    this.depth = depth;
    this.isDebug = level === "debug";
    this.minSeverity = level === "silent" ? Infinity : severity[level];
  }

  protected print(method: keyof AbstractLogger, message: string, meta?: any) {
    if (severity[method] < this.minSeverity) {
      return;
    }
    const output: string[] = [
      new Date().toISOString(),
      this.hasColor ? `${this.styles[method](method)}:` : `${method}:`,
      message,
    ];
    if (meta !== undefined) {
      output.push(
        inspect(meta, {
          colors: this.hasColor,
          depth: this.depth,
          breakLength: this.isDebug ? 80 : Infinity,
          compact: this.isDebug ? 3 : true,
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
 * @desc Creates the built-in console logger with optional colorful inspections
 * @example createLogger({ level: "debug", color: true, depth: 4 })
 * */
export const createLogger = (config: BuiltinLoggerConfig) =>
  new BuiltinLogger(config);
