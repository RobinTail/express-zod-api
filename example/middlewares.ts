import createHttpError from "http-errors";
import assert from "node:assert/strict";
import { z } from "zod/v4";
import { Method, Middleware } from "express-zod-api";

export const authMiddleware = new Middleware({
  security: {
    and: [
      { type: "input", name: "key" },
      { type: "header", name: "token" },
    ],
  },
  input: z.object({
    key: z.string().nonempty().example("1234-5678-90"),
    token: z.string().nonempty().example("1234567890"),
  }),
  handler: async ({ input: { key, token }, logger }) => {
    logger.debug(`Key and token: ${key}, ${token}`);
    assert.equal(key, "123", createHttpError(401, "Invalid key"));
    assert.equal(token, "456", createHttpError(401, "Invalid token"));
    return { authorized: "Jane Doe" };
  },
});

export const methodProviderMiddleware = new Middleware({
  handler: async ({ request }) => ({
    method: request.method.toLowerCase() as Method,
  }),
});
