import { isObject } from "./common-helpers";

/** @desc You can use any logger compatible with this type. */
export type AbstractLogger = Record<
  "info" | "debug" | "warn" | "error",
  (message: string, meta?: any) => any // eslint-disable-line @typescript-eslint/no-explicit-any
>;

/**
 * @desc Using module augmentation approach you can set the type of the actual logger used
 * @example declare module "express-zod-api" { interface LoggerOverrides extends winston.Logger {} }
 * @link https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation
 * */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LoggerOverrides {}

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
