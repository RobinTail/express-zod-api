import { inspect } from "node:util";
import type { Format, TransformableInfo } from "logform";
import type Winston from "winston";
import type Transport from "winston-transport";

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
  typeof subject === "object" &&
  subject !== null &&
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
  const prettyPrint = (meta: Omit<TransformableInfo, "level" | "message">) => {
    const {
      [Symbol.for("level")]: noLevel,
      [Symbol.for("message")]: noMessage,
      [Symbol.for("splat")]: noSplat,
      ...rest
    } = meta;
    return inspect(rest, false, 1, config.color);
  };

  const getOutputFormat = (isPretty?: boolean) =>
    printf(({ timestamp, message, level, durationMs, ...meta }) => {
      if (typeof message === "object") {
        meta = { ...meta, ...(message as object) };
        message = "[No message]";
      }
      const hasMetaProps = Object.keys(meta).length > 0;
      const details = [];
      if (durationMs) {
        details.push("duration:", `${durationMs}ms`);
      }
      if (hasMetaProps) {
        details.push(isPretty ? prettyPrint(meta) : JSON.stringify(meta));
      } else {
        details.push(...(meta?.[Symbol.for("splat")] || []));
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
