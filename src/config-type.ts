import compression from "compression";
import { NextHandleFunction } from "connect";
import { Express, Request } from "express";
import fileUpload from "express-fileupload";
import { ServerOptions } from "node:https";
import { Logger } from "winston";
import { AbstractEndpoint } from "./endpoint";
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
    compression?: boolean | CompressionOptions; // enable or configure response compression
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

export type InputSource = keyof Pick<
  Request,
  "query" | "body" | "files" | "params"
>;
export type InputSources = Record<Method, InputSource[]>;

type Headers = Record<string, string>;
type HeadersProvider = (params: {
  defaultHeaders: Headers; // the default headers to be overridden
  request: Request;
  endpoint: AbstractEndpoint;
  logger: Logger;
}) => Headers | Promise<Headers>;

export type TagsConfig<TAG extends string> = Record<
  TAG,
  string | { description: string; url?: string }
>;

export interface CommonConfig<TAG extends string = string> {
  // enable cross-origin resource sharing
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
  // you can override the default CORS headers by setting up a provider function here
  cors: boolean | HeadersProvider;
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
  // put: [body, params], patch: [body, params], delete: [query, params] }
  inputSources?: Partial<InputSources>;
  // optional endpoints tagging configuration, example: { users: "Everything about the users" }
  tags?: TagsConfig<TAG>;
}

export const createConfig = <
  TAG extends string,
  T extends (ServerConfig | AppConfig) & CommonConfig<TAG>,
>(
  config: T,
): T => config;
