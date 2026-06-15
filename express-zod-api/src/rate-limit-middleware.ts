import createHttpError from "http-errors";
import type { Request, Response } from "express";
import type {
  Options,
  RateLimitInfo,
  AugmentedRequest,
  rateLimit as RateLimitFn,
} from "express-rate-limit";
import { ExpressMiddleware } from "./middleware";
import { loadPeer } from "./peer-helpers";

export const createRateLimitMiddleware = (
  config?: Partial<Options>,
): ExpressMiddleware<Request, Response, { rateLimit: RateLimitInfo }> => {
  const rateLimit = loadPeer<typeof RateLimitFn>("express-rate-limit");
  const handler = rateLimit({
    ...config,
    handler: (_req, _res, next, optionsUsed) => {
      next(createHttpError(429, optionsUsed.message));
    },
  });
  return new ExpressMiddleware(handler, {
    provider: (req: AugmentedRequest) =>
      ({ rateLimit: req.rateLimit }) as { rateLimit: RateLimitInfo },
  });
};
