import {inspect} from 'util';
import {Format} from 'logform';
import {LEVEL, MESSAGE, SPLAT} from 'triple-beam';
import * as winston from 'winston';
import * as Transport from 'winston-transport';
import {ConfigType} from './config-type';

const {combine, colorize, timestamp: useTimestamp, printf} = winston.format;

export function createLogger(config: ConfigType): winston.Logger {
  const prettyPrint = (meta: any) => {
    delete meta[LEVEL];
    delete meta[MESSAGE];
    delete meta[SPLAT];
    return inspect(meta, false, 1, config.logger.color);
  };

  const getOutputFormat = (isPretty?: boolean) => printf(
    ({timestamp, message, level, durationMs, ...meta}) =>
      `${timestamp} ${level}: ${message}` +
      (durationMs === undefined ? '' : ` duration: ${durationMs}ms`) +
      (Object.keys(meta).length === 0
        ? ''
        : ' ' + (isPretty ? prettyPrint(meta) : JSON.stringify(meta))),
  );

  const formats: Format[] = [useTimestamp()];

  const consoleOutputOptions: Transport.TransportStreamOptions = {
    handleExceptions: true,
  };

  if (config.logger.color) {
    formats.push(colorize());
  }

  switch (config.logger.level) {
    case 'debug':
      consoleOutputOptions.level = 'debug';
      formats.push(getOutputFormat(true));
      break;
    case 'silent':
    case 'warn':
    default:
      consoleOutputOptions.level = 'warn';
      formats.push(getOutputFormat());
  }

  consoleOutputOptions.format = combine(...formats);

  return winston.createLogger({
    silent: config.logger.level === 'silent',
    levels: winston.config.npm.levels,
    transports: [new winston.transports.Console(consoleOutputOptions)],
    exitOnError: false,
  });
}
