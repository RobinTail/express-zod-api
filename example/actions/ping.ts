import { z } from "zod";
import { actionFactory } from "../factories";

export const onPing = actionFactory.build({
  input: z.tuple([z.unknown()]),
  output: z.tuple([z.literal("pong"), z.unknown()]),
  handler: async ({ input: [msg] }) => ["pong" as const, msg],
});
