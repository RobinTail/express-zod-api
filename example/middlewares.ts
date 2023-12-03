import createHttpError from "http-errors";
import { z } from "zod";
import { Method, createMiddleware, withMeta } from "express-zod-api";

export const authMiddleware = createMiddleware({
  security: {
    and: [
      { type: "input", name: "key" },
      { type: "header", name: "token" },
    ],
  },
  input: withMeta(
    z.object({
      key: z.string().min(1),
    }),
  ).example({
    key: "1234-5678-90",
  }),
  middleware: async ({ input: { key }, request, logger }) => {
    logger.debug("Checking the key and token...");
    if (key !== "123") {
      throw createHttpError(401, "Invalid key");
    }
    if (request.headers.token !== "456") {
      throw createHttpError(401, "Invalid token");
    }
    return { token: request.headers.token };
  },
});

export const methodProviderMiddleware = createMiddleware({
  input: z.object({}),
  middleware: async ({ request }) => ({
    method: request.method.toLowerCase() as Method,
  }),
});
