import { z } from "zod";
import { actionFactory } from "../factories";

/** @desc The action demonstrates the optional nature of the output schema due to the lack of acknowledgement */
export const onLog = actionFactory.build({
  input: z.tuple([z.unknown()]),
  handler: async ({ input, logger }) => {
    logger.info("logged", input);
  },
});
