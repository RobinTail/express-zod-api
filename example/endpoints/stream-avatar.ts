import { z } from "zod";
import { fileStreamingEndpointsFactory } from "../factories.ts";

export const streamAvatarEndpoint = fileStreamingEndpointsFactory.build({
  shortDescription: "Streams a file content.",
  tag: ["users", "files"],
  input: z.object({
    userId: z
      .string()
      .regex(/\d+/)
      .transform((str) => parseInt(str, 10)),
  }),
  output: z.object({
    filename: z.string(),
  }),
  handler: async () => ({ filename: "assets/logo.svg" }),
});
