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
export { createCookieMiddleware } from "./cookie-middleware";
export { createCacheMiddleware } from "./cache-middleware";
export { createRateLimitMiddleware } from "./rate-limit-middleware";
export {
  ResultHandler,
  defaultResultHandler,
  arrayResultHandler,
} from "./result-handler";
export { createApiResponse } from "./api-response";
export { ServeStatic } from "./serve-static";
export { createServer, attachRouting } from "./server";
export {
  DocumentationError, // @todo remove in v30
  RoutingError,
  OutputValidationError,
  InputValidationError,
  MissingPeerError,
} from "./errors";
export { testEndpoint, testMiddleware } from "./testing";
export { EventStreamFactory } from "./sse";

export { ez } from "./proprietary-schemas";

// Types and interfaces that can be used for user convenience
export type { Method } from "./method";
export type { Routing } from "./routing";

// Interfaces exposed for augmentation
export type { LoggerOverrides } from "./logger-helpers";
export type { TagOverrides } from "./common-helpers";

// Fixes TS2742 during the build: inferred types need ParsedQs from qs
import type {} from "qs"; // for attachRouting, makeRequestMock, testEndpoint, testMiddleware
