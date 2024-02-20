import { inspect } from "node:util";
import type { Format } from "logform";
import type Winston from "winston";
import type Transport from "winston-transport";
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
  const prettyPrint = (value: unknown) =>
    inspect(value, false, 1, config.color);

  const getOutputFormat = (isPretty?: boolean) =>
    printf(({ timestamp, message, level, durationMs, ...rest }) => {
      if (typeof message === "object") {
        rest[Symbol.for("splat")] = [message];
        message = "[No message]";
      }
      const details = [];
      if (durationMs) {
        details.push("duration:", `${durationMs}ms`);
      }
      const serializer = isPretty ? prettyPrint : JSON.stringify;
      const splat = rest?.[Symbol.for("splat")];
      if (Array.isArray(splat)) {
        details.push(...splat.map((entry) => serializer(entry)));
      }
      return [timestamp, `${level}:`, message, ...details].join(" ");
    });

  const formats: Format[] = [useTimestamp()];

  const consoleOutputOptions: Transport.TransportStreamOptions = {
    handleExceptions: true,
  };

  if (config.color) {
    formats.push(colorize());
  }

  switch (config.level) {
    case "debug":
      consoleOutputOptions.level = "debug";
      formats.push(getOutputFormat(true));
      break;
    case "silent":
    case "warn":
    default:
      consoleOutputOptions.level = "warn";
      formats.push(getOutputFormat());
  }

  consoleOutputOptions.format = combine(...formats);

  return create({
    silent: config.level === "silent",
    levels: npm.levels,
    transports: [new transports.Console(consoleOutputOptions)],
    exitOnError: false,
  });
};
