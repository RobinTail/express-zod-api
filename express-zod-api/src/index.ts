import "@express-zod-api/zod-plugin"; // side effects here
export { createConfig } from "./config-type.ts";
export {
  EndpointsFactory,
  defaultEndpointsFactory,
  arrayEndpointsFactory,
} from "./endpoints-factory.ts";
export { getMessageFromError } from "./common-helpers.ts";
export { ensureHttpError } from "./result-helpers.ts";
export { BuiltinLogger } from "./builtin-logger.ts";
export { Middleware } from "./middleware.ts";
export {
  ResultHandler,
  defaultResultHandler,
  arrayResultHandler,
} from "./result-handler.ts";
export { DependsOnMethod } from "./depends-on-method.ts";
export { ServeStatic } from "./serve-static.ts";
export { createServer, attachRouting } from "./server.ts";
export { Documentation } from "./documentation.ts";
export {
  DocumentationError,
  RoutingError,
  OutputValidationError,
  InputValidationError,
  MissingPeerError,
} from "./errors.ts";
export { testEndpoint, testMiddleware } from "./testing.ts";
export { Integration } from "./integration.ts";
export { EventStreamFactory } from "./sse.ts";

export { ez } from "./proprietary-schemas.ts";

// Convenience types
export type { Depicter } from "./documentation-helpers.ts";
export type { Producer } from "./zts-helpers.ts";

// Interfaces exposed for augmentation
export type { LoggerOverrides } from "./logger-helpers.ts";
export type { TagOverrides } from "./common-helpers.ts";

// Issues 952, 1182, 1269: Insufficient exports for consumer's declaration
import type {} from "qs"; // fixes TS2742 for attachRouting
export type { Routing } from "./routing.ts";
export type { FlatObject } from "./common-helpers.ts";
export type { Method } from "./method.ts";
export type { IOSchema } from "./io-schema.ts";
export type { CommonConfig, AppConfig, ServerConfig } from "./config-type.ts";
export type { ApiResponse } from "./api-response.ts";
export type {
  BasicSecurity,
  BearerSecurity,
  CookieSecurity,
  HeaderSecurity,
  InputSecurity,
  OAuth2Security,
  OpenIdSecurity,
} from "./security.ts";
