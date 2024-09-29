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

/** @link https://tc39.es/ecma402/#table-sanctioned-single-unit-identifiers */
const makeNumberFormat = (unit: string, fraction = 0) =>
  Intl.NumberFormat(undefined, {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: fraction,
    style: "unit",
    unitDisplay: "long",
    unit,
  });

// creating them once increases the performance significantly
const picoFormat = makeNumberFormat("nanosecond", 3);
const nanoFormat = makeNumberFormat("nanosecond");
const microFormat = makeNumberFormat("microsecond");
const milliFormat = makeNumberFormat("millisecond");
const secondsFormat = makeNumberFormat("second", 2);
const minutesFormat = makeNumberFormat("minute", 2);

// not using R.cond for performance optimization
export const formatDuration = (ms: number) => {
  if (ms < 1e-6) return picoFormat.format(ms / 1e-6);
  if (ms < 1e-3) return nanoFormat.format(ms / 1e-6);
  if (ms < 1) return microFormat.format(ms / 1e-3);
  if (ms < 1e3) return milliFormat.format(ms);
  if (ms < 6e4) return secondsFormat.format(ms / 1e3);
  return minutesFormat.format(ms / 6e4);
};
