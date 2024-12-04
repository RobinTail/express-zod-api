import { z } from "zod";
import { sseFactory } from "../factories";

export const subscriptionEndpoint = sseFactory.build({
  output: z.object({}),
  handler: async () => ({}),
});
