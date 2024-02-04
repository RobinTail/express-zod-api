import { z } from "zod";
import { actionFactory } from "../factories";

/** @desc The action demonstrates no acknowledgement and constraints on emission awareness */
export const onSubscribe = actionFactory.build({
  input: z.tuple([]).rest(z.unknown()),
  handler: async ({ logger, emit, isConnected }) => {
    logger.info("Subscribed");
    while (true) {
      emit("time", new Date());
      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            clearTimeout(timer);
            (isConnected() ? resolve : reject)();
          }, 1000);
        });
      } catch {
        break;
      }
    }
    logger.info("Unsubscribed by disconnecting");
  },
});
