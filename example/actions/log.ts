import { z } from "zod";
import { actionFactory } from "../factories";

export const onLog = actionFactory.build({
  input: z.tuple([z.unknown()]),
  handler: async ({ input, logger }) => {
    logger.info("logged", input);
  },
});
