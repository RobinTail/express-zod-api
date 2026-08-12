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
const errorCode = 429;

/**
 * @desc Creates an ExpressMiddleware that enforces rate limits using express-rate-limit.
 * @requires express-rate-limit
 * @param options — Partial options passed to the express-rate-limit constructor.
 * @example createRateLimitMiddleware({ windowMs: 60000, max: 100 })
 */
export const createRateLimitMiddleware = (options?: Partial<Options>) => {
  const rateLimit = loadPeer<typeof RateLimitFn>("express-rate-limit");
  const limiter = rateLimit({
    ...options,
    handler: (_req, _res, next, optionsUsed) => {
      next(createHttpError(errorCode, optionsUsed.message));
    },
  });
  const { getKey, resetKey } = limiter;
  const limiterApi: Pick<RateLimitRequestHandler, "getKey" | "resetKey"> = {
    getKey,
    resetKey,
  };
  return new ExpressMiddleware(limiter, {
    statusCode: errorCode, // see the limiter
    provider: (req: AugmentedRequest) => ({
      rateLimit: {
        ...limiterApi,
        ...req[options?.requestPropertyName ?? "rateLimit"],
      } as RateLimitInfo & typeof limiterApi,
    }),
  });
};
