import { z } from "../../src/index.js";
import { fileStreamingEndpointsFactory } from "../factories.js";

export const streamAvatarEndpoint = fileStreamingEndpointsFactory.build({
  methods: ["get"],
  input: z.object({
    userId: z
      .string()
      .regex(/\d+/)
      .transform((str) => parseInt(str, 10)),
  }),
  output: z.object({
    filename: z.string(),
  }),
  handler: async () => ({ filename: "logo.svg" }),
});
