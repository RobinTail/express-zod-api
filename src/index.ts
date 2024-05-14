import "./zod-plugin";

export { createConfig } from "./config-type";
export { AbstractEndpoint } from "./endpoint";
export {
  EndpointsFactory,
  defaultEndpointsFactory,
  arrayEndpointsFactory,
} from "./endpoints-factory";
export {
  getExamples,
  getMessageFromError,
  getStatusCodeFromError,
} from "./common-helpers";
export { createLogger } from "./logger";
export { createMiddleware } from "./middleware";
export {
  createResultHandler,
  defaultResultHandler,
  arrayResultHandler,
} from "./result-handler";
export { DependsOnMethod } from "./depends-on-method";
export { ServeStatic } from "./serve-static";
export { createServer, attachRouting } from "./server";
export { Documentation } from "./documentation";
export {
  DocumentationError,
  RoutingError,
  OutputValidationError,
  InputValidationError,
  MissingPeerError,
} from "./errors";
export { testEndpoint } from "./testing";
export { Integration } from "./integration";

export { ez } from "./proprietary-schemas";

// Convenience types
export type { Depicter } from "./documentation-helpers";
export type { Producer } from "./zts-helpers";

// Issues 952, 1182, 1269: Insufficient exports for consumer's declaration
export type { MockOverrides } from "./testing";
export type { Routing } from "./routing";
export type { LoggerOverrides } from "./logger";
export type { FlatObject } from "./common-helpers";
export type { Method } from "./method";
export type { IOSchema } from "./io-schema";
export type { CommonConfig, AppConfig, ServerConfig } from "./config-type";
export type { MiddlewareDefinition } from "./middleware";
export type { ResultHandlerDefinition } from "./result-handler";
export type { ApiResponse } from "./api-response";
export type {
  BasicSecurity,
  BearerSecurity,
  CookieSecurity,
  CustomHeaderSecurity,
  InputSecurity,
  OAuth2Security,
  OpenIdSecurity,
} from "./security";
