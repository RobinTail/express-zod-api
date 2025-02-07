import { z } from "zod";
import { defaultEndpointsFactory, ez } from "express-zod-api";
import { createHash } from "node:crypto";

export const uploadAvatarEndpoint = defaultEndpointsFactory.build({
  method: "post",
  tag: "files",
  description: "Handles a file upload.",
  input: z
    .object({
      avatar: ez.upload(),
    })
    .passthrough(),
  output: z.object({
    name: z.string(),
    size: z.number().int().nonnegative(),
    mime: z.string(),
    hash: z.string(),
    otherInputs: z.record(z.any()),
  }),
  handler: async ({ input: { avatar, ...rest } }) => {
    return {
      name: avatar.name,
      size: avatar.size,
      mime: avatar.mimetype,
      hash: createHash("sha1").update(avatar.data).digest("hex"),
      otherInputs: rest,
    };
  },
});
