import { z } from "zod";
import { unstable_createEventStream } from "../../src/sse";
import { setTimeout } from "node:timers/promises";

export const subscriptionEndpoint = unstable_createEventStream({
  events: { time: z.number().int().positive() },
  handler: async ({ options: { emit, isClosed }, logger }) => {
    while (!isClosed()) {
      logger.debug("emitting");
      emit("time", Date.now());
      await setTimeout(1000);
    }
    logger.debug("closed");
  },
});
