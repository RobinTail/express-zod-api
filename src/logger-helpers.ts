import { cond, gt, T } from "ramda";
import { isObject } from "./common-helpers";

/** @desc You can use any logger compatible with this type. */
export type AbstractLogger = Record<
  "info" | "debug" | "warn" | "error",
  (message: string, meta?: any) => any // eslint-disable-line @typescript-eslint/no-explicit-any -- for compatibility
>;

/**
 * @desc Using module augmentation approach you can set the type of the actual logger used
 * @example declare module "express-zod-api" { interface LoggerOverrides extends winston.Logger {} }
 * @link https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation
 * */
export interface LoggerOverrides {} // eslint-disable-line @typescript-eslint/no-empty-object-type -- for augmentation

export type ActualLogger = AbstractLogger & LoggerOverrides;

export const severity: Record<keyof AbstractLogger, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export const isLoggerInstance = (subject: unknown): subject is AbstractLogger =>
  isObject(subject) &&
  Object.keys(severity).some((method) => method in subject);

const convert = cond<[number], [string, number]>([
  [gt(1e-6), (v) => ["picosecond", v / 1e-9]],
  [gt(1e-3), (v) => ["nanosecond", v / 1e-6]],
  [gt(1), (v) => ["microsecond", v / 1e-3]],
  [gt(1e3), (v) => ["millisecond", v]],
  [gt(6e4), (v) => ["second", v / 1e3]],
  [T, (v) => ["minute", v / 6e4]],
]);

/**
 * @todo consider Intl units when Node 18 dropped (microsecond unit is missing, picosecond is not in list)
 * @link https://tc39.es/ecma402/#table-sanctioned-single-unit-identifiers
 * */
export const formatDuration = (durationMs: number) => {
  const [unit, converted] = convert(durationMs);
  const formatted = Intl.NumberFormat(undefined, {
    useGrouping: false,
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: durationMs > 1e3 ? 2 : 0,
  }).format(converted);
  return `${formatted} ${unit}${converted > 1 ? "s" : ""}`;
};
