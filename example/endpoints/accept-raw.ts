import { z } from "zod";
import { ez } from "../../src";
import { taggedEndpointsFactory } from "../factories";

export const rawAcceptingEndpoint = taggedEndpointsFactory.build({
  method: "post",
  tag: "files",
  input: ez.raw(), // requires to enable raw option in server config
  output: z.object({ length: z.number() }),
  handler: async ({ input: { raw } }) => ({
    length: raw.length,
  }),
});
