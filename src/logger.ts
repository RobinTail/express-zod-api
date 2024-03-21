import { inspect } from "node:util";
import { isObject } from "./common-helpers";
import { keys } from "ramda";

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

export interface LoggerConfig {
  /**
   * @desc The minimal severity to log or "silent" to disable logging
   * @example "debug" also enables pretty output for inspected entities
   * */
  level: "silent" | "warn" | "debug";
  /**
   * @desc Enables colors on printed severity and inspected entities
   * @default false
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

const esc = "\x1b";
const defaultColor = `${esc}[39m`;
const ansi: Record<keyof AbstractLogger, string> = {
  debug: `${esc}[34m`,
  info: `${esc}[32m`,
  warn: `${esc}[33m`,
  error: `${esc}[31m`,
};

export const isLoggerConfig = (subject: unknown): subject is LoggerConfig =>
  isObject(subject) &&
  "level" in subject &&
  ("color" in subject ? typeof subject.color === "boolean" : true) &&
  ("depth" in subject
    ? typeof subject.depth === "number" || subject.depth === null
    : true) &&
  typeof subject.level === "string" &&
  ["silent", "warn", "debug"].includes(subject.level) &&
  Object.values(subject).find((prop) => typeof prop === "function") ===
    undefined;

/**
 * @desc Creates a basic console logger with optional colorful inspections
 * @example createLogger({ level: "debug", color: true, depth: 4 })
 * */
export const createLogger = ({
  level,
  color = false,
  depth = 2,
}: LoggerConfig): AbstractLogger => {
  const isDebug = level === "debug";
  const minSeverity = level === "silent" ? 100 : severity[level];

  const print = (method: keyof AbstractLogger, message: string, meta?: any) => {
    if (severity[method] < minSeverity) {
      return;
    }
    const output: string[] = [new Date().toISOString()];
    if (color) {
      output.push(`${ansi[method]}${method}${defaultColor}:`);
    } else {
      output.push(`${method}:`);
    }
    output.push(message);
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

  return keys(severity).reduce(
    (agg, method) =>
      Object.assign(agg, {
        [method]: (message: string, meta?: any) => print(method, message, meta),
      }),
    {} as AbstractLogger,
  );
};
