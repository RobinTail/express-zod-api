import { z } from "zod";
import { ez } from "../../src";
import { taggedEndpointsFactory } from "../factories";

export const rawAcceptingEndpoint = taggedEndpointsFactory.build({
  method: "post",
  tag: "files",
  input: ez
    .raw() // requires to enable rawParser option in server config
    .extend({}), // additional inputs, route params for example, if needed
  output: z.object({ length: z.number().int().nonnegative() }),
  handler: async ({ input: { raw } }) => ({
    length: raw.length, // input.raw is populated automatically when rawParser is set in config
  }),
});
