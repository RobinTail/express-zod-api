import { z } from "zod/v4";
import { defaultEndpointsFactory, ez } from "express-zod-api";

export const rawAcceptingEndpoint = defaultEndpointsFactory.build({
  method: "post",
  tag: "files",
  input: ez.raw({
    /* the place for additional inputs, like route params, if needed */
  }),
  output: z.object({ length: z.int().nonnegative() }),
  handler: async ({ input: { raw } }) => ({
    length: raw.length, // input.raw is populated automatically by the corresponding parser
  }),
});
