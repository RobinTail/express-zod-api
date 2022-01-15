import compression from "compression";
import { NextHandleFunction } from "connect";
import { Express, Request } from "express";
import fileUpload from "express-fileupload";
import { ServerOptions } from "https";
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

type CompressionOptions = Pick<
  compression.CompressionOptions,
  "threshold" | "level" | "strategy" | "chunkSize" | "memLevel"
>;

export interface ServerConfig {
  server: {
    // server configuration
    listen: number | string; // port or socket
    jsonParser?: NextHandleFunction; // custom JSON parser, default: express.json()
    upload?: boolean | UploadOptions; // enable or configure uploads handling
    gzip?: boolean | CompressionOptions; // enable or configure response compression
  };
  https?: {
    // enables HTTPS server as well
    options: ServerOptions; // at least "cert" and "key" options required
    listen: number | string; // port or socket
  };
}

export interface AppConfig {
  app: Express; // or your custom express app
}

type InputSource = keyof Pick<Request, "query" | "body" | "files" | "params">;
export type InputSources = Record<Method, InputSource[]>;

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
  // the order matters: priority from lowest to highest
  // default: { get: [query, params], post: [body, params, files],
  // put: [body, params], patch: [body, params], delete: [body, query, params] }
  inputSources?: Partial<InputSources>;
}

export const createConfig = <
  T extends (ServerConfig | AppConfig) & CommonConfig
>(
  config: T
): T => config;
