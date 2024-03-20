import ctx, { ForegroundColor } from "chalk";
import { inspect } from "node:util";
import { isObject } from "./common-helpers";

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

const colors: Record<keyof AbstractLogger, typeof ForegroundColor> = {
  debug: "blue",
  info: "green",
  warn: "yellow",
  error: "red",
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
  const chalk = new ctx.Instance({ level: color ? 1 : 0 });

  const print = (method: keyof AbstractLogger, message: string, meta?: any) => {
    if (severity[method] < minSeverity) {
      return;
    }
    console.log(
      [
        new Date().toISOString(),
        `${color ? chalk[colors[method]](method) : method}:`,
        message,
      ]
        .concat(
          meta === undefined
            ? []
            : inspect(meta, {
                colors: color,
                depth,
                breakLength: isDebug ? 80 : Infinity,
                compact: isDebug ? 3 : true,
              }),
        )
        .join(" "),
    );
  };

  return {
    info: (message: string, meta?: any) => print("info", message, meta),
    debug: (message: string, meta?: any) => print("debug", message, meta),
    warn: (message: string, meta?: any) => print("warn", message, meta),
    error: (message: string, meta?: any) => print("error", message, meta),
  };
};
