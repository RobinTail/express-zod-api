import { z } from "zod";
import { caseFactory } from "../factories";

export const onPing = caseFactory.build({
  input: z.tuple([z.unknown()]),
  output: z.tuple([z.literal("pong"), z.unknown()]),
  handler: async ({ input: [msg] }) => ["pong" as const, msg],
});
