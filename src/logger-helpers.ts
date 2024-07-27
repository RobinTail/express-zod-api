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
  { name: "picosecond", maxMs: 1e-6, div: 1e-9 }, // missing in ECMA
  { name: "nanosecond", maxMs: 1e-3, div: 1e-6 },
  { name: "microsecond", maxMs: 1, div: 1e-3 }, // missing in Node 18
  { name: "millisecond", maxMs: 1e3, div: 1 },
  { name: "second", maxMs: 6e4, div: 1e3 },
  { name: "minute", maxMs: Infinity, div: 6e4 },
];

/** @todo consider Intl units when Node 18 dropped (microsecond unit is missing, picosecond is not in list) */
export const formatDuration = (durationMs: number) => {
  const unit =
    timeUnits.find(({ maxMs }) => durationMs < maxMs) || last(timeUnits)!;
  const converted = durationMs / unit.div;
  const formatted = Intl.NumberFormat(undefined, {
    useGrouping: false,
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: durationMs >= 1e3 ? 2 : 0,
  }).format(converted);
  return `${formatted} ${unit.name}${converted > 1 ? "s" : ""}`;
};
