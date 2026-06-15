import createHttpError from "http-errors";
import type { Request, Response } from "express";
import type {
  Options,
  RateLimitInfo,
  RateLimitRequestHandler,
  AugmentedRequest,
} from "express-rate-limit";
import { ExpressMiddleware } from "./middleware";
import { loadPeer } from "./peer-helpers";

export const createRateLimitMiddleware = async (
  config?: Partial<Options>,
): Promise<
  ExpressMiddleware<Request, Response, { rateLimit: RateLimitInfo }>
> => {
  const rateLimit =
    await loadPeer<
      (passedOptions?: Partial<Options>) => RateLimitRequestHandler
    >("express-rate-limit");
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
