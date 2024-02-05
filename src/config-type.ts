import type compression from "compression";
import { IRouter, Request, RequestHandler } from "express";
import type fileUpload from "express-fileupload";
import { ServerOptions } from "node:https";
import { EmissionMap } from "./emission";
import { AbstractEndpoint } from "./endpoint";
import { AbstractLogger, SimplifiedWinstonConfig } from "./logger";
import { Method } from "./method";
import { AnyResultHandlerDefinition } from "./result-handler";
import { ListenOptions } from "node:net";

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
  logger: AbstractLogger;
}) => Headers | Promise<Headers>;

export type TagsConfig<TAG extends string> = Record<
  TAG,
  string | { description: string; url?: string }
>;

export interface SocketsConfig<E extends EmissionMap> {
  timeout: number;
  emission: E;
}

type ChildLoggerProvider = (params: {
  request: Request;
  parent: AbstractLogger;
}) => AbstractLogger | Promise<AbstractLogger>;

export interface CommonConfig<
  TAG extends string = string,
  EMI extends EmissionMap = EmissionMap,
> {
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
  /**
   * @desc Logger configuration (winston) or instance of any other logger.
   * @example { level: "debug", color: true }
   * */
  logger: SimplifiedWinstonConfig | AbstractLogger;
  /**
   * @desc A child logger returned by this function can override the logger in all handlers for each request
   * @example ({ parent }) => parent.child({ requestId: uuid() })
   * */
  childLoggerProvider?: ChildLoggerProvider;
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
  sockets?: SocketsConfig<EMI>;
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

export interface ServerConfig<
  TAG extends string = string,
  EMI extends EmissionMap = EmissionMap,
> extends CommonConfig<TAG, EMI> {
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
     * @requires express-fileupload
     * */
    upload?: boolean | UploadOptions;
    /**
     * @desc Enable or configure response compression.
     * @default false
     * @requires compression
     */
    compression?: boolean | CompressionOptions;
    /**
     * @desc Enables parsing certain request payloads into raw Buffers (application/octet-stream by default)
     * @desc When enabled, use ez.raw() as input schema to get input.raw in Endpoint's handler
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

export interface AppConfig<
  TAG extends string = string,
  EMI extends EmissionMap = EmissionMap,
> extends CommonConfig<TAG, EMI> {
  /** @desc Your custom express app or express router instead. */
  app: IRouter;
}

export function createConfig<TAG extends string, EMI extends EmissionMap>(
  config: ServerConfig<TAG, EMI>,
): ServerConfig<TAG, EMI>;
export function createConfig<TAG extends string, EMI extends EmissionMap>(
  config: AppConfig<TAG, EMI>,
): AppConfig<TAG, EMI>;
export function createConfig(config: AppConfig | ServerConfig) {
  return config;
}
