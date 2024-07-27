import { last } from "ramda";
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
const timeUnits = [
  { name: "picosecond", ms: 1e-9 }, // missing in ECMA
  { name: "nanosecond", ms: 1e-6 },
  { name: "microsecond", ms: 1e-3 }, // missing in Node 18
  { name: "millisecond", ms: 1 },
  { name: "second", ms: 1e3 },
  { name: "minute", ms: 6e4 },
];

/** @todo consider Intl.NumberFormat() when Node 18 dropped (microsecond unit is missing) */
export const formatDuration = (durationMs: number) => {
  const unit =
    timeUnits.find(({ ms }) => durationMs / ms < 1e3) || last(timeUnits)!;
  const converted = Math.round(durationMs / unit.ms);
  const truncated = Math.round(converted);
  return `${truncated} ${unit.name}${truncated > 1 ? "s" : ""}`;
};
