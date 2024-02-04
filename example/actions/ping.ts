import { z } from "zod";
import { actionFactory } from "../factories";

/** @desc The action demonstrates acknowledgements by replying "pong" to "ping" event with an echo of payload */
export const onPing = actionFactory.build({
  input: z.tuple([z.unknown()]),
  output: z.tuple([z.literal("pong"), z.unknown()]),
  handler: async ({ input: [msg] }) => ["pong" as const, msg],
});
