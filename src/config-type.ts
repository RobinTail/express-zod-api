import compression from "compression";
import { NextHandleFunction } from "connect";
import { Express, Request } from "express";
import fileUpload from "express-fileupload";
import { ServerOptions } from "node:https";
import { Logger } from "winston";
import { AbstractEndpoint } from "./endpoint";
import { Method } from "./method";
import { AnyResultHandler } from "./result-handler";

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
  /** @desc Server configuration. */
  server: {
    /** @desc Port or socket. */
    listen: number | string;
    /**
     * @desc Custom JSON parser.
     * @default express.json()
     * */
    jsonParser?: NextHandleFunction;
    /**
     * @desc Enable or configure uploads handling.
     * @default false
     * */
    upload?: boolean | UploadOptions;
    /**
     * @desc Enable or configure response compression.
     * @default false
     */
    compression?: boolean | CompressionOptions;
  };
  /** @desc Enables HTTPS server as well. */
  https?: {
    /** @desc At least "cert" and "key" options required. */
    options: ServerOptions;
    /** @desc Port or socket. */
    listen: number | string;
  };
}

export interface AppConfig {
  /** @desc Your custom express app instead. */
  app: Express;
}

export type InputSource = keyof Pick<
  Request,
  "query" | "body" | "files" | "params" | "headers"
>;
export type InputSources = Record<Method, InputSource[]>;

type Headers = Record<string, string>;
type HeadersProvider = (params: {
  /** @desc The default headers to be overridden. */
  defaultHeaders: Headers;
  request: Request;
  endpoint: AbstractEndpoint;
  logger: Logger;
}) => Headers | Promise<Headers>;

export type TagsConfig<TAG extends string> = Record<
  TAG,
  string | { description: string; url?: string }
>;

export interface CommonConfig<TAG extends string = string> {
  /**
   * @desc Enables cross-origin resource sharing.
   * @link https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
   * @desc You can override the default CORS headers by setting up a provider function here.
   */
  cors: boolean | HeadersProvider;
  /**
   * @desc Custom ResultHandlerDefinition for common errors.
   * @default defaultResultHandler
   * @see defaultResultHandler
   */
  errorHandler?: AnyResultHandler;
  /** @desc Logger configuration or your custom winston logger. */
  logger: LoggerConfig | Logger;
  /**
   * @desc You can disable the startup logo.
   * @default true
   */
  startupLogo?: boolean;
  /**
   * @desc Which properties of request are combined into the input for endpoints and middlewares.
   * @desc The order matters: priority from lowest to highest
   * @default defaultInputSources
   * @see defaultInputSources
   */
  inputSources?: Partial<InputSources>;
  /**
   * @desc Optional endpoints tagging configuration.
   * @example: { users: "Everything about the users" }
   */
  tags?: TagsConfig<TAG>;
}

export const createConfig = <
  TAG extends string,
  T extends (ServerConfig | AppConfig) & CommonConfig<TAG>,
>(
  config: T,
): T => config;
