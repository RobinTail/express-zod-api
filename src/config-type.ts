import { CompressionOptions } from "compression";
import { IRouter, Request, RequestHandler } from "express";
import { Options as FileUploadOptions } from "express-fileupload";
import { ServerOptions } from "node:https";
import { BuiltinLoggerConfig } from "./builtin-logger";
import { AbstractEndpoint } from "./endpoint";
import { AbstractLogger, ActualLogger } from "./logger-helpers";
import { Method } from "./method";
import { AbstractResultHandler } from "./result-handler";
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
  logger: ActualLogger;
}) => Headers | Promise<Headers>;

export type TagsConfig<TAG extends string> = Record<
  TAG,
  string | { description: string; url?: string }
>;

type ChildLoggerProvider = (params: {
  request: Request;
  parent: ActualLogger;
}) => ActualLogger | Promise<ActualLogger>;

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
  errorHandler?: AbstractResultHandler;
  /**
   * @desc Built-in logger configuration or an instance of any compatible logger.
   * @example { level: "debug", color: true }
   * */
  logger: BuiltinLoggerConfig | AbstractLogger;
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
}

type BeforeUpload = (params: {
  request: Request;
  logger: ActualLogger;
}) => void | Promise<void>;

type UploadOptions = Pick<
  FileUploadOptions,
  | "createParentPath"
  | "uriDecodeFileNames"
  | "safeFileNames"
  | "preserveExtension"
  | "useTempFiles"
  | "tempFileDir"
  | "debug"
  | "uploadTimeout"
  | "limits"
> & {
  /**
   * @desc The error to throw when the file exceeds the configured fileSize limit (handled by errorHandler).
   * @see limits
   * @override limitHandler
   * @example createHttpError(413, "The file is too large")
   * */
  limitError?: Error;
  /**
   * @desc A handler to execute before uploading — it can be used for restrictions by throwing an error.
   * @default undefined
   * @example ({ request }) => { throw createHttpError(403, "Not authorized"); }
   * */
  beforeUpload?: BeforeUpload;
};

type CompresorOptions = Pick<
  CompressionOptions,
  "threshold" | "level" | "strategy" | "chunkSize" | "memLevel"
>;

type BeforeRouting = (params: { app: IRouter; logger: ActualLogger }) => void;

export interface ServerConfig<TAG extends string = string>
  extends CommonConfig<TAG> {
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
     * @default undefined
     * */
    upload?: boolean | UploadOptions;
    /**
     * @desc Enable or configure response compression.
     * @default undefined
     */
    compression?: boolean | CompresorOptions;
    /**
     * @desc Custom raw parser (assigns Buffer to request body)
     * @default express.raw()
     * @link https://expressjs.com/en/4x/api.html#express.raw
     * */
    rawParser?: RequestHandler;
    /**
     * @desc A code to execute before processing the Routing of your API (and before parsing).
     * @desc This can be a good place for express middlewares establishing their own routes.
     * @desc It can help to avoid making a DIY solution based on the attachRouting() approach.
     * @default undefined
     * @example ({ app }) => { app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument)); }
     * */
    beforeRouting?: BeforeRouting;
  };
  /** @desc Enables HTTPS server as well. */
  https?: {
    /** @desc At least "cert" and "key" options required. */
    options: ServerOptions;
    /** @desc Port, UNIX socket or custom options. */
    listen: number | string | ListenOptions;
  };
}

export interface AppConfig<TAG extends string = string>
  extends CommonConfig<TAG> {
  /** @desc Your custom express app or express router instead. */
  app: IRouter;
}

export function createConfig<TAG extends string>(
  config: ServerConfig<TAG>,
): ServerConfig<TAG>;
export function createConfig<TAG extends string>(
  config: AppConfig<TAG>,
): AppConfig<TAG>;
export function createConfig(config: AppConfig | ServerConfig) {
  return config;
}
