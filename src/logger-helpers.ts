import { Ansis, blue, green, hex, red, cyanBright } from "ansis";
import { isObject } from "./common-helpers";

export const styles = {
  debug: blue,
  info: green,
  warn: hex("#FFA500"),
  error: red,
  ctx: cyanBright,
} satisfies Record<string, Ansis>;

const severity = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
} satisfies Record<string, number>;

export type Severity = keyof typeof severity;

/** @desc You can use any logger compatible with this type. */
export type AbstractLogger = Record<
  Severity,
  (message: string, meta?: any) => any // eslint-disable-line @typescript-eslint/no-explicit-any -- for compatibility
>;

/**
 * @desc Using module augmentation approach you can set the type of the actual logger used
 * @example declare module "express-zod-api" { interface LoggerOverrides extends winston.Logger {} }
 * @link https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation
 * */
export interface LoggerOverrides {} // eslint-disable-line @typescript-eslint/no-empty-object-type -- for augmentation

export type ActualLogger = AbstractLogger & LoggerOverrides;

export const isLoggerInstance = (subject: unknown): subject is AbstractLogger =>
  isObject(subject) &&
  Object.keys(severity).some((method) => method in subject);

export const isSeverity = (subject: PropertyKey): subject is Severity =>
  subject in severity;

export const isHidden = (subject: Severity, gate: Severity) =>
  severity[subject] < severity[gate];

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

// not using R.cond for performance optimization
const pickTimeUnit = (ms: number): [string, number, Intl.NumberFormat] => {
  if (ms < 1e-6) return ["picosecond", ms / 1e-9, intFormat];
  if (ms < 1e-3) return ["nanosecond", ms / 1e-6, intFormat];
  if (ms < 1) return ["microsecond", ms / 1e-3, intFormat];
  if (ms < 1e3) return ["millisecond", ms, intFormat];
  if (ms < 6e4) return ["second", ms / 1e3, floatFormat];
  return ["minute", ms / 6e4, floatFormat];
};

export const formatDuration = (durationMs: number) => {
  const [unit, converted, formatter] = pickTimeUnit(durationMs);
  return `${formatter.format(converted)} ${unit}${converted > 1 ? "s" : ""}`;
};
