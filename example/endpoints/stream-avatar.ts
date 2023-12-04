import { z } from "zod";
import { fileStreamingEndpointsFactory } from "../factories";

export const streamAvatarEndpoint = fileStreamingEndpointsFactory.build({
  method: "get",
  shortDescription: "Streams a file content.",
  tags: ["users", "files"],
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
