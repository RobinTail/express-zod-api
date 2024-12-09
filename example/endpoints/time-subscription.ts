import { z } from "zod";
import { setTimeout } from "node:timers/promises";
import { eventsFactory } from "../factories";

export const subscriptionEndpoint = eventsFactory.buildVoid({
  tag: "subscriptions",
  input: z.object({
    trigger: z.string().optional(),
  }),
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
