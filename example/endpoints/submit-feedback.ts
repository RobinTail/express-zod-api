import { defaultEndpointsFactory, ez } from "express-zod-api";
import { z } from "zod/v4";

export const submitFeedbackEndpoint = defaultEndpointsFactory.build({
  method: "post",
  tag: "forms",
  input: ez.form({
    name: z.string().min(1),
    email: z.email(),
    message: z.string().min(1),
  }),
  output: z.object({
    crc: z.int().positive(),
  }),
  handler: async ({ input: { name, email, message } }) => ({
    crc: [name, email, message].reduce((acc, { length }) => acc + length, 0),
  }),
});
