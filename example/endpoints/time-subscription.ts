import { z } from "zod";
import { setTimeout } from "node:timers/promises";
import { eventsFactory } from "../factories.ts";

/** @desc The endpoint demonstrates emitting server-sent events (SSE) */
export const subscriptionEndpoint = eventsFactory.buildVoid({
  tag: "subscriptions",
  input: z.object({
    trigger: z
      .string()
      .optional()
      .deprecated()
      .describe("for testing error response"),
  }),
  handler: async ({ input: { trigger }, ctx: { emit, isClosed }, logger }) => {
    if (trigger === "failure") throw new Error("Intentional failure");
    while (!isClosed()) {
      logger.debug("emitting");
      emit("time", Date.now());
      await setTimeout(1000);
    }
    logger.debug("closed");
  },
});
