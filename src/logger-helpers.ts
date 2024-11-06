import { memoizeWith } from "ramda";
import { isObject } from "./common-helpers";

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

/** @link https://tc39.es/ecma402/#table-sanctioned-single-unit-identifiers */
type TimeUnit =
  | "nanosecond"
  | "microsecond"
  | "millisecond"
  | "second"
  | "minute";

const _makeNumberFormat = (unit: TimeUnit, fraction = 0) =>
  Intl.NumberFormat(undefined, {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: fraction,
    style: "unit",
    unitDisplay: "long",
    unit,
  });
export const makeNumberFormat = memoizeWith(
  (unit, fraction) => `${unit}${fraction}`,
  _makeNumberFormat,
);
