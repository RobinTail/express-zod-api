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

/**
 * @todo consider Intl units when Node 18 dropped (microsecond unit is missing, picosecond is not in list)
 * @link https://tc39.es/ecma402/#table-sanctioned-single-unit-identifiers
 * */
const makeNumberFormat = (fraction = 0) =>
  Intl.NumberFormat(undefined, {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: fraction,
  });

// creating them once increases the performance significantly
const intFormat = makeNumberFormat();
const floatFormat = makeNumberFormat(2);

const pickTimeUnit = cond<[number], [string, number, Intl.NumberFormat]>([
  [gt(1e-6), (ms) => ["picosecond", ms / 1e-9, intFormat]],
  [gt(1e-3), (ms) => ["nanosecond", ms / 1e-6, intFormat]],
  [gt(1), (ms) => ["microsecond", ms / 1e-3, intFormat]],
  [gt(1e3), (ms) => ["millisecond", ms, intFormat]],
  [gt(6e4), (ms) => ["second", ms / 1e3, floatFormat]],
  [T, (ms) => ["minute", ms / 6e4, floatFormat]],
]);

export const formatDuration = (durationMs: number) => {
  const [unit, converted, formatter] = pickTimeUnit(durationMs);
  return `${formatter.format(converted)} ${unit}${converted > 1 ? "s" : ""}`;
};
