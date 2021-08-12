import {NextHandleFunction} from 'connect';
import {Express} from 'express';
import {Logger} from 'winston';
import {ResultHandlerDefinition} from './result-handler';

export const loggerLevels = {
  silent: true,
  warn: true,
  debug: true,
};

export interface LoggerConfig {
  level: keyof typeof loggerLevels;
  color: boolean;
}

export interface ServerConfig { // server configuration
  server: {
    // port or socket
    listen: number | string;
    // custom JSON parser, default: express.json()
    jsonParser?: NextHandleFunction;
  },
}

export interface AppConfig { // or your custom express app
  app: Express
}

export interface CommonConfig {
  // enable cross-origin resource sharing
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
  cors: boolean;
  // custom ResultHandlerDefinition for common errors,
  // default: defaultResultHandler()
  errorHandler?: ResultHandlerDefinition<any, any>;
  // logger configuration or your custom winston logger
  logger: LoggerConfig | Logger;
}

export const createConfig = <T extends (ServerConfig | AppConfig) & CommonConfig>(config: T): T => config;

/**
 * @deprecated
 * @see createConfig()
 * */
export type ConfigType = (ServerConfig | AppConfig) & CommonConfig;
