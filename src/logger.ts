import { inspect } from "node:util";
import { isObject } from "./common-helpers";
import { mapObjIndexed } from "ramda";
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

export const isBuiltinLoggerConfig = (
  subject: unknown,
): subject is BuiltinLoggerConfig =>
  isObject(subject) &&
  "level" in subject &&
  ("color" in subject ? typeof subject.color === "boolean" : true) &&
  ("depth" in subject
    ? typeof subject.depth === "number" || subject.depth === null
    : true) &&
  typeof subject.level === "string" &&
  ["silent", "warn", "info", "debug"].includes(subject.level) &&
  !Object.values(subject).some((prop) => typeof prop === "function");

/**
 * @desc Creates the built-in console logger with optional colorful inspections
 * @example createLogger({ level: "debug", color: true, depth: 4 })
 * */
export const createLogger = ({
  level,
  color = new Ansis().isSupported(),
  depth = 2,
}: BuiltinLoggerConfig): AbstractLogger => {
  const styles: Record<keyof AbstractLogger, Ansis> = {
    debug: blue,
    info: green,
    warn: hex("#FFA500"),
    error: red,
  };

  const isDebug = level === "debug";
  const minSeverity = level === "silent" ? 100 : severity[level];

  const print = (method: keyof AbstractLogger, message: string, meta?: any) => {
    if (severity[method] < minSeverity) {
      return;
    }
    const output: string[] = [
      new Date().toISOString(),
      color ? `${styles[method](method)}:` : `${method}:`,
      message,
    ];
    if (meta !== undefined) {
      output.push(
        inspect(meta, {
          colors: color,
          depth,
          breakLength: isDebug ? 80 : Infinity,
          compact: isDebug ? 3 : true,
        }),
      );
    }
    console.log(output.join(" "));
  };

  return mapObjIndexed(
    ({}, method) =>
      (message: string, meta?: any) =>
        print(method, message, meta),
    severity,
  );
};
