import { inspect } from 'util';

import { Format } from 'logform';
import { LEVEL, MESSAGE, SPLAT } from 'triple-beam';
import * as winston from 'winston';
import * as Transport from 'winston-transport';
import {config} from '../config';

const { combine, colorize, timestamp: useTimestamp, printf } = winston.format;

function prettyPrint(meta: any) {
  delete meta[LEVEL];
  delete meta[MESSAGE];
  delete meta[SPLAT];
  return inspect(meta, false, 1, config.logger.color);
}

function getOutputFormat(isPretty?: boolean) {
  return printf(
    ({ timestamp, message, level, durationMs, ...meta }) =>
      `${timestamp} ${level}: ${message}` +
      (durationMs === undefined ? '' : ` duration: ${durationMs}ms`) +
      (Object.keys(meta).length === 0
        ? ''
        : ' ' + (isPretty ? prettyPrint(meta) : JSON.stringify(meta))),
  );
}

const formats: Format[] = [useTimestamp()];

const consoleOutputOptions: Transport.TransportStreamOptions = {
  handleExceptions: true,
};

if (config.logger.color) {
  formats.push(colorize());
}

switch (config.logger.level) {
  case 'silent':
    consoleOutputOptions.silent = true;
    formats.push(getOutputFormat());
    break;
  case 'warn':
    consoleOutputOptions.level = 'warn';
    formats.push(getOutputFormat());
    break;
  case 'debug': // all levels output
  default:
    consoleOutputOptions.level = 'debug';
    formats.push(getOutputFormat(true));
}

consoleOutputOptions.format = combine(...formats);

export const logger = winston.createLogger({
  levels: winston.config.npm.levels,
  transports: [new winston.transports.Console(consoleOutputOptions)],
  exitOnError: false,
});
