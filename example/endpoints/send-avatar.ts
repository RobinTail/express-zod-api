import { z } from "zod/v4";
import { fileSendingEndpointsFactory } from "../factories";
import { readFile } from "node:fs/promises";

export const sendAvatarEndpoint = fileSendingEndpointsFactory.build({
  shortDescription: "Sends a file content.",
  tag: ["files", "users"],
  input: z.object({
    userId: z
      .string()
      .regex(/\d+/)
      .transform((str) => parseInt(str, 10)),
  }),
  output: z.object({
    data: z.string(),
  }),
  handler: async () => {
    const data = await readFile("assets/logo.svg", "utf-8");
    return { data };
  },
});
