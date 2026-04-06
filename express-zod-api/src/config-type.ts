import type compression from "compression";
import type { IRouter, Request, RequestHandler } from "express";
import type fileUpload from "express-fileupload";
import type { ServerOptions } from "node:https";
import type { BuiltinLoggerConfig } from "./builtin-logger";
import type { AbstractEndpoint } from "./endpoint";
import type { AbstractLogger, ActualLogger } from "./logger-helpers";
import type { Method } from "./method";
import type { AbstractResultHandler } from "./result-handler";
import type { ListenOptions } from "node:net";
import type { GetLogger } from "./server-helpers";

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

type ChildLoggerProvider = (params: {
  request: Request;
  parent: ActualLogger;
}) => ActualLogger | Promise<ActualLogger>;

type LogAccess = (request: Request, logger: ActualLogger) => void;

export interface CommonConfig {
  /**
   * @desc Enables cross-origin resource sharing.
   * @link https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
   * @desc You can override the default CORS headers by setting up a provider function here.
   */
  cors: boolean | HeadersProvider;
  /**
   * @desc Controls how to respond to a request to an existing endpoint with an invalid HTTP method.
   * @example true — respond with status code 405 and "Allow" header containing a list of valid methods
   * @example false — respond with status code 404 (Not found)
   * @default true
   */
  hintAllowedMethods?: boolean;
  /**
   * @desc Controls how to treat Routing keys matching HTTP methods ("get", "post") and having Endpoint assigned.
   * @example true — treat such keys as HTTP methods complementing their parent paths
   *          { users: { get: ... }} becomes GET /users
   * @example false — treat such keys as nested path segments regardless of the name
   *          { users: { get: ... }} remains /users/get
   * @default true
   */
  recognizeMethodDependentRoutes?: boolean;
  /**
   * @desc The ResultHandler to use for handling routing, parsing and upload errors
   * @default defaultResultHandler
   * @see defaultResultHandler
   */
  errorHandler?: AbstractResultHandler;
  /**
   * @desc Built-in logger configuration or an instance of any compatible logger.
   * @example { level: "debug", color: true }
   * @default { level: NODE_ENV === "production" ? "warn" : "debug", color: isSupported(), depth: 2 }
   * */
  logger?: Partial<BuiltinLoggerConfig> | AbstractLogger;
  /**
   * @desc A child logger returned by this function can override the logger in all handlers for each request
   * @example ({ parent }) => parent.child({ requestId: uuid() })
   * */
  childLoggerProvider?: ChildLoggerProvider;
  /**
   * @desc The function for producing access logs
   * @default ({ method, path }, logger) => logger.debug(`${method}: ${path}`)
   * @example null — disables the feature
   * */
  accessLogger?: null | LogAccess;
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
}

type BeforeUpload = (params: {
  request: Request;
  logger: ActualLogger;
}) => void | Promise<void>;

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
   * @example ({ request }) => { throw createHttpError(403, "Not authorized"); }
   * */
  beforeUpload?: BeforeUpload;
};

type CompressionOptions = Pick<
  compression.CompressionOptions,
  "threshold" | "level" | "strategy" | "chunkSize" | "memLevel"
>;

interface GracefulOptions {
  /**
   * @desc Time given to drain ongoing requests before closing the server.
   * @default 1000
   * */
  timeout?: number;
  /**
   * @desc Process event (Signal) that triggers the graceful shutdown.
   * @see Signals
   * @default [SIGINT, SIGTERM]
   * */
  events?: string[];
  /** @desc The hook to call after the server was closed, but before terminating the process. */
  beforeExit?: () => void | Promise<void>;
}

type ServerHook = (params: {
  app: IRouter;
  /** @desc Returns child logger for the given request (if configured) or the configured logger otherwise */
  getLogger: GetLogger;
}) => void | Promise<void>;

export interface HttpConfig {
  /** @desc Port, UNIX socket or custom options. */
  listen: number | string | ListenOptions;
}

interface HttpsConfig extends HttpConfig {
  /** @desc At least "cert" and "key" options required. */
  options: ServerOptions;
}

export interface ServerConfig extends CommonConfig {
  /** @desc HTTP server configuration. */
  http?: HttpConfig;
  /** @desc HTTPS server configuration. */
  https?: HttpsConfig;
  /**
   * @desc Custom JSON parser.
   * @default express.json()
   * @link https://expressjs.com/en/5x/api.html#express.json
   * */
  jsonParser?: RequestHandler;
  /**
   * @desc Enable or configure uploads handling.
   * @requires express-fileupload
   * */
  upload?: boolean | UploadOptions;
  /**
   * @desc Enable or configure response compression.
   * @requires compression
   */
  compression?: boolean | CompressionOptions;
  /**
   * @desc Configure or customize the parser for request query string
   * @example "simple" // for "node:querystring" module, array elements must be repeated: ?a=1&a=2
   * @example "extended" // for "qs" module, supports nested objects and arrays with brackets: ?a[]=1&a[]=2
   * @example (query) => qs.parse(query, {comma: true}) // for comma-separated arrays: ?a=1,2,3
   * @default "simple"
   * @link https://expressjs.com/en/5x/api.html#req.query
   */
  queryParser?: "simple" | "extended" | ((query: string) => object);
  /**
   * @desc Custom raw parser (assigns Buffer to request body)
   * @default express.raw()
   * @link https://expressjs.com/en/5x/api.html#express.raw
   * */
  rawParser?: RequestHandler;
  /**
   * @desc Custom parser for URL Encoded requests used for submitting HTML forms
   * @default express.urlencoded()
   * @link https://expressjs.com/en/5x/api.html#express.urlencoded
   * */
  formParser?: RequestHandler;
  /**
   * @desc A code to execute before processing the Routing of your API (and before parsing).
   * @desc This can be a good place for express middlewares establishing their own routes.
   * @desc It can help to avoid making a DIY solution based on the attachRouting() approach.
   * @example ({ app }) => { app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument)); }
   * */
  beforeRouting?: ServerHook;
  /**
   * @desc A code to execute after processing the Routing of your API, but before error handling.
   * @see beforeRouting
   * */
  afterRouting?: ServerHook;
  /**
   * @desc Rejects new connections and attempts to finish ongoing ones in the specified time before exit.
   * */
  gracefulShutdown?: boolean | GracefulOptions;
}

export interface AppConfig extends CommonConfig {
  /** @desc Your custom express app or express router instead. */
  app: IRouter;
}

export function createConfig(config: ServerConfig): ServerConfig;
export function createConfig(config: AppConfig): AppConfig;
export function createConfig(config: AppConfig | ServerConfig) {
  return config;
}
