import { inspect } from "node:util";
import type { Format, TransformableInfo } from "logform";
import winston from "winston";
import type Transport from "winston-transport";
import { LoggerConfig } from "./config-type";

const { combine, colorize, timestamp: useTimestamp, printf } = winston.format;

export const createLogger = (loggerConfig: LoggerConfig): winston.Logger => {
  const prettyPrint = (meta: Omit<TransformableInfo, "level" | "message">) => {
    const {
      [Symbol.for("level")]: noLevel,
      [Symbol.for("message")]: noMessage,
      [Symbol.for("splat")]: noSplat,
      ...rest
    } = meta;
    return inspect(rest, false, 1, loggerConfig.color);
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

  if (loggerConfig.color) {
    formats.push(colorize());
  }

  switch (loggerConfig.level) {
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

  return winston.createLogger({
    silent: loggerConfig.level === "silent",
    levels: winston.config.npm.levels,
    transports: [new winston.transports.Console(consoleOutputOptions)],
    exitOnError: false,
  });
};
