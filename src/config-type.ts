import {NextHandleFunction} from 'connect';
import {Express} from 'express';
import {Logger} from 'winston';
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

export type ConfigType = ({
  // server configuration
  server: {
    // port or socket
    listen: number | string;
    // custom JSON parser, default: express.json()
    jsonParser?: NextHandleFunction,
  },
} | { // or your custom express app
  app: Express
}) & {
  // enable cross-origin resource sharing
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
  cors: boolean;
  // custom handler for errors and output, default: defaultResultHandler()
  resultHandler?: ResultHandler;
  // logger configuration or your custom winston logger
  logger: LoggerConfig | Logger;
}
