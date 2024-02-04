import { z } from "zod";
import { caseFactory } from "../factories";

export const onLog = caseFactory.build({
  input: z.tuple([z.unknown()]),
  handler: async ({ input, logger }) => {
    logger.info("logged", input);
  },
});
