import { z } from "zod";
import { sseFactory } from "../factories";
import { setTimeout } from "node:timers/promises";

export const subscriptionEndpoint = sseFactory.build({
  output: z.object({}),
  handler: async ({ options: { emit, isClosed }, logger }) => {
    while (!isClosed()) {
      logger.debug("emitting");
      emit("time", Date.now());
      await setTimeout(1000);
    }
    logger.debug("closed");
    return {};
  },
});
