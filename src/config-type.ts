import { NextHandleFunction } from "connect";
import { Express, Request } from "express";
import fileUpload from "express-fileupload";
import { Logger } from "winston";
import { Method } from "./method";
import { ResultHandlerDefinition } from "./result-handler";

export const loggerLevels = {
  silent: true,
  warn: true,
  debug: true,
};

export interface LoggerConfig {
  level: keyof typeof loggerLevels;
  color: boolean;
}

type UploadOptions = Pick<
  fileUpload.Options,
  | "createParentPath"
  | "uriDecodeFileNames"
  | "safeFileNames"
  | "preserveExtension"
  | "useTempFiles"
  | "tempFileDir"
  | "debug"
  | "uploadTimeout"
>;

export interface ServerConfig {
  server: {
    // server configuration
    listen: number | string; // port or socket
    jsonParser?: NextHandleFunction; // custom JSON parser, default: express.json()
    upload?: boolean | UploadOptions;
  };
}

export interface AppConfig {
  app: Express; // or your custom express app
}

export type InputSources = Record<
  Method,
  Array<keyof Pick<Request, "query" | "body" | "files" | "params">>
>;

export interface CommonConfig {
  // enable cross-origin resource sharing
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
  cors: boolean;
  // custom ResultHandlerDefinition for common errors,
  // default: defaultResultHandler()
  errorHandler?: ResultHandlerDefinition<any, any>;
  // logger configuration or your custom winston logger
  logger: LoggerConfig | Logger;
  // you can disable the startup logo, default: true
  startupLogo?: boolean;
  // what request properties are combined into input for endpoints and middlewares
  // default: { get: ['query'], post: ['body', 'files'],
  // put: ['body'], patch: ['body'], delete: ['query', 'body'] }
  inputSources?: Partial<InputSources>;
}

export const createConfig = <
  T extends (ServerConfig | AppConfig) & CommonConfig
>(
  config: T
): T => config;

/**
 * @since v2.3.1
 * @deprecated
 * @see createConfig()
 * @todo remove in v3
 * */
export type ConfigType = (ServerConfig | AppConfig) & CommonConfig;
