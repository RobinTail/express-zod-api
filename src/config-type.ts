import {NextHandleFunction} from 'connect';
import * as express from 'express';
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

export interface ServerConfig {
  // port or socket
  listen: number | string;
  // custom JSON parser, default: express.json()
  jsonParser?: NextHandleFunction,
}

export interface ConfigType<T extends ServerConfig | express.Express> {
  // server configuration or your custom express app
  server: T,
  // enable cross-origin resource sharing
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
  cors: boolean;
  // custom handler for errors and output, default: defaultResultHandler()
  resultHandler?: ResultHandler;
  // logger configuration or your custom winston logger
  logger: LoggerConfig | winston.Logger;
}
