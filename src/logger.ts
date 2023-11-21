import { inspect } from "node:util";
import type { Format, TransformableInfo } from "logform";
import type Winston from "winston";
import type Transport from "winston-transport";
import { loadPeer } from "./common-helpers";

/** @desc You can use any logger compatible with this type. */
export type AbstractLogger = Record<
  "info" | "debug" | "warn" | "error",
  (message: string, meta?: any) => any
>;

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
  const winston = await loadPeer<typeof Winston>("winston");

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
    winston.format.printf(
      ({ timestamp, message, level, durationMs, ...meta }) => {
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
      },
    );

  const formats: Format[] = [winston.format.timestamp()];

  const consoleOutputOptions: Transport.TransportStreamOptions = {
    handleExceptions: true,
  };

  if (config.color) {
    formats.push(winston.format.colorize());
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

  consoleOutputOptions.format = winston.format.combine(...formats);

  return winston.createLogger({
    silent: config.level === "silent",
    levels: winston.config.npm.levels,
    transports: [new winston.transports.Console(consoleOutputOptions)],
    exitOnError: false,
  });
};
