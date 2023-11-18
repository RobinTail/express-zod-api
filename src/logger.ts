import { inspect } from "node:util";
import type { Format, TransformableInfo } from "logform";
import type * as Winston from "winston";
import type Transport from "winston-transport";

/**
 * @desc a helper to for creating a winston logger
 * @requires winston
 * @example createLogger({ winston, level: "debug", color: true })
 * */
export const createLogger = ({
  winston,
  ...config
}: {
  winston: typeof Winston;
  level: "silent" | "warn" | "debug";
  color: boolean;
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
