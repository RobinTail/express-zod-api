import createHttpError from "http-errors";
import assert from "node:assert/strict";
import { z } from "zod";
import { Method, Middleware } from "../src";

export const authMiddleware = new Middleware({
  security: {
    and: [
      { type: "input", name: "key" },
      { type: "header", name: "token" },
    ],
  },
  input: z
    .object({
      key: z.string().nonempty(),
    })
    .example({
      key: "1234-5678-90",
    }),
  handler: async ({ input: { key }, request, logger }) => {
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

export const methodProviderMiddleware = new Middleware({
  handler: async ({ request }) => ({
    method: request.method.toLowerCase() as Method,
  }),
});
