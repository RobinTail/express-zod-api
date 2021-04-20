import {NextHandleFunction} from 'connect';
import * as winston from 'winston';
import {ResultHandler} from './result-handler';

export const loggerLevels = {
  silent: true,
  warn: true,
  debug: true,
};

export interface LoggerConfig {
  level: keyof typeof loggerLevels;
  color: boolean;
}

export interface ConfigType {
  server: {
    // port or socket
    listen: number | string;
    // enable cross-origin resource sharing
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    cors: boolean;
    // custom JSON parser, default: express.json()
    jsonParser?: NextHandleFunction,
    // custom handler for errors and output, default: defaultResultHandler()
    resultHandler?: ResultHandler;
  },
  // logger configuration or your custom winston logger
  logger: LoggerConfig | winston.Logger;
}
