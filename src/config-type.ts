import compression from "compression";
import { Express, Request, RequestHandler } from "express";
import fileUpload from "express-fileupload";
import { ServerOptions } from "node:https";
import { Logger } from "winston";
import { AbstractEndpoint } from "./endpoint";
import { Method } from "./method";
import { AnyResultHandlerDefinition } from "./result-handler";
import { ListenOptions } from "node:net";

export interface LoggerConfig {
  level: "silent" | "warn" | "debug";
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
    /** @desc Port, UNIX socket or custom options. */
    listen: number | string | ListenOptions;
    /**
     * @desc Custom JSON parser.
     * @default express.json()
     * @link https://expressjs.com/en/4x/api.html#express.json
     * */
    jsonParser?: RequestHandler;
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
    /**
     * @desc Enables parsing certain request types as raw binary data.
     * @desc When enabled, use z.raw() as input schema and input.raw in Endpoint's handler
     * @default undefined
     * @example express.raw()
     * @link https://expressjs.com/en/4x/api.html#express.raw
     * */
    rawParser?: RequestHandler;
  };
  /** @desc Enables HTTPS server as well. */
  https?: {
    /** @desc At least "cert" and "key" options required. */
    options: ServerOptions;
    /** @desc Port, UNIX socket or custom options. */
    listen: number | string | ListenOptions;
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
  errorHandler?: AnyResultHandlerDefinition;
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
