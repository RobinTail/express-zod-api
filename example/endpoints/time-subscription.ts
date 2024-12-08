import { z } from "zod";
import { unstable_createEventStream } from "../../src";
import { setTimeout } from "node:timers/promises";

export const subscriptionEndpoint = unstable_createEventStream({
  input: z.object({
    trigger: z.string().optional(),
  }),
  events: { time: z.number().int().positive() },
  handler: async ({
    input: { trigger },
    options: { emit, isClosed },
    logger,
  }) => {
    if (trigger === "failure") throw new Error("Intentional failure");
    while (!isClosed()) {
      logger.debug("emitting");
      emit("time", Date.now());
      await setTimeout(1000);
    }
    logger.debug("closed");
  },
});
