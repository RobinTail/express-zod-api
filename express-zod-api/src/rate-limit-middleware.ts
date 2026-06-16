import createHttpError from "http-errors";
import type {
  Options,
  AugmentedRequest,
  rateLimit as RateLimitFn,
} from "express-rate-limit";
import { ExpressMiddleware } from "./middleware";
import { loadPeer } from "./peer-helpers";

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
      next(createHttpError(429, optionsUsed.message));
    },
  });
  return new ExpressMiddleware(limiter, {
    provider: (req: AugmentedRequest) => ({
      rateLimit: req[options?.requestPropertyName ?? "rateLimit"],
    }),
  });
};
