import { z } from "zod";
import { actionsFactory } from "../factories";

/** @desc The action demonstrates acknowledgements by replying "pong" to "ping" event with an echo of payload */
export const onPing = actionsFactory.build({
  input: z.tuple([]).rest(z.unknown()),
  output: z.tuple([z.literal("pong")]).rest(z.unknown()),
  handler: async ({ input }) => ["pong" as const, ...input],
});
