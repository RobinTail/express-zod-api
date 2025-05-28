import "./zod-plugin";

export { createConfig } from "./config-type";
export {
  EndpointsFactory,
  defaultEndpointsFactory,
  arrayEndpointsFactory,
} from "./endpoints-factory";
export { getMessageFromError } from "./common-helpers";
export { ensureHttpError } from "./result-helpers";
export { BuiltinLogger } from "./builtin-logger";
export { Middleware } from "./middleware";
export {
  ResultHandler,
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
export { testEndpoint, testMiddleware } from "./testing";
export { Integration } from "./integration";
export { EventStreamFactory } from "./sse";

export { ez } from "./proprietary-schemas";

// Convenience types
export type { Depicter } from "./documentation-helpers";
export type { Producer } from "./zts-helpers";

// Interfaces exposed for augmentation
export type { LoggerOverrides } from "./logger-helpers";
export type { TagOverrides } from "./common-helpers";

// Issues 952, 1182, 1269: Insufficient exports for consumer's declaration
import type {} from "qs"; // fixes TS2742 for attachRouting
export type { Routing } from "./routing";
export type { FlatObject } from "./common-helpers";
export type { Method } from "./method";
export type { IOSchema } from "./io-schema";
export type { CommonConfig, AppConfig, ServerConfig } from "./config-type";
export type { ApiResponse } from "./api-response";
export type {
  BasicSecurity,
  BearerSecurity,
  CookieSecurity,
  HeaderSecurity,
  InputSecurity,
  OAuth2Security,
  OpenIdSecurity,
} from "./security";
