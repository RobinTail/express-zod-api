import createHttpError from "http-errors";
import assert from "node:assert/strict";
import { z } from "zod";
import { Method, createMiddleware, withMeta } from "../src";

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
    assert.equal(key, "123", createHttpError(401, "Invalid key"));
    assert.equal(
      request.headers.token,
      "456",
      createHttpError(401, "Invalid token"),
    );
    return { token: request.headers.token };
  },
});

export const methodProviderMiddleware = createMiddleware({
  input: z.object({}),
  middleware: async ({ request }) => ({
    method: request.method.toLowerCase() as Method,
  }),
});
