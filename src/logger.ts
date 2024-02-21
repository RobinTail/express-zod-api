import { inspect } from "node:util";
import type Winston from "winston";
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

export interface SimplifiedWinstonConfig {
  level: "silent" | "warn" | "debug";
  color?: boolean;
}

export const isSimplifiedWinstonConfig = (
  subject: unknown,
): subject is SimplifiedWinstonConfig =>
  isObject(subject) &&
  "level" in subject &&
  ("color" in subject ? typeof subject.color === "boolean" : true) &&
  typeof subject.level === "string" &&
  ["silent", "warn", "debug"].includes(subject.level);

/**
 * @desc a helper for creating a winston logger easier
 * @requires winston
 * @example createLogger({ winston, level: "debug", color: true })
 * */
export const createLogger = ({
  winston: {
    createLogger: create,
    transports,
    format: { printf, timestamp: useTimestamp, colorize, combine },
    config: { npm },
  },
  ...config
}: SimplifiedWinstonConfig & {
  winston: typeof Winston;
}): Winston.Logger => {
  const isSilent = config.level === "silent";

  const prettyPrint = (value: unknown) =>
    inspect(value, { colors: config.color, depth: 1 });

  const customFormat = printf(
    ({ timestamp, message, level, durationMs, ...rest }) => {
      if (typeof message === "object") {
        rest[Symbol.for("splat")] = [message];
        message = "[No message]";
      }
      const details = [];
      if (durationMs) {
        details.push("duration:", `${durationMs}ms`);
      }
      const splat = rest?.[Symbol.for("splat")];
      if (Array.isArray(splat)) {
        details.push(...splat.map(prettyPrint));
      }
      return [timestamp, `${level}:`, message, ...details].join(" ");
    },
  );

  return create({
    silent: isSilent,
    levels: npm.levels,
    exitOnError: false,
    transports: [
      new transports.Console({
        level: isSilent ? "warn" : config.level,
        handleExceptions: true,
        format: combine(
          useTimestamp(),
          ...(config.color ? [colorize()] : []),
          customFormat,
        ),
      }),
    ],
  });
};
