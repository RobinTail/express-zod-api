import createHttpError from "http-errors";
import type {
  Options,
  AugmentedRequest,
  rateLimit as RateLimitFn,
  RateLimitInfo,
  RateLimitRequestHandler,
} from "express-rate-limit";
import { ExpressMiddleware } from "./middleware";
import { loadPeer } from "./peer-helpers";

/** @desc The HTTP status code returned by the rate limiter. */
const defaultStatusCode = 429;

/**
 * @desc Creates an ExpressMiddleware that enforces rate limits using express-rate-limit.
 * @requires express-rate-limit
 * @param options — Partial options passed to the express-rate-limit constructor.
 * @example createRateLimitMiddleware({ windowMs: 60000, max: 100 })
 * @modifies ResultHandler.negative.statusCode — overrides or narrows down to 429
 */
export const createRateLimitMiddleware = (options?: Partial<Options>) => {
  const rateLimit = loadPeer<typeof RateLimitFn>("express-rate-limit");
  const limiter = rateLimit({
    statusCode: defaultStatusCode,
    ...options,
    handler: (_req, _res, next, optionsUsed) => {
      next(createHttpError(optionsUsed.statusCode, optionsUsed.message));
    },
  });
  const { getKey, resetKey } = limiter;
  const limiterApi: Pick<RateLimitRequestHandler, "getKey" | "resetKey"> = {
    getKey,
    resetKey,
  };
  return new ExpressMiddleware(limiter, {
    statusCode: options?.statusCode ?? defaultStatusCode,
    provider: (req: AugmentedRequest) => ({
      rateLimit: {
        ...limiterApi,
        ...req[options?.requestPropertyName ?? "rateLimit"],
      } as RateLimitInfo & typeof limiterApi,
    }),
  });
};
