import { inspect } from "node:util";
import type { Format, TransformableInfo } from "logform";
import type Winston from "winston";
import type Transport from "winston-transport";
import { loadPeer } from "./peer-helpers";

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
  color: boolean;
}

export const isSimplifiedWinstonConfig = (
  subject: unknown,
): subject is SimplifiedWinstonConfig =>
  typeof subject === "object" &&
  subject !== null &&
  "level" in subject &&
  "color" in subject &&
  typeof subject.color === "boolean" &&
  typeof subject.level === "string" &&
  ["silent", "warn", "debug"].includes(subject.level);

/**
 * @desc an internal helper for creating a winston logger easier
 * @requires winston
 * @example await createLogger({ level: "debug", color: true })
 * */
export const createWinstonLogger = async (
  config: SimplifiedWinstonConfig,
): Promise<Winston.Logger> => {
  const {
    createLogger,
    transports,
    format: { printf, timestamp: useTimestamp, colorize, combine },
    config: { npm },
  } = await loadPeer<typeof Winston>("winston");

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
      return (
        `${timestamp} ${level}: ${message}` +
        (durationMs === undefined ? "" : ` duration: ${durationMs}ms`) +
        (Object.keys(meta).length === 0
          ? ""
          : " " + (isPretty ? prettyPrint(meta) : JSON.stringify(meta)))
      );
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

  return createLogger({
    silent: config.level === "silent",
    levels: npm.levels,
    transports: [new transports.Console(consoleOutputOptions)],
    exitOnError: false,
  });
};
