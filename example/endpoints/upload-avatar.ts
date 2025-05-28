import { z } from "zod/v4";
import { defaultEndpointsFactory, ez } from "express-zod-api";
import { createHash } from "node:crypto";

export const uploadAvatarEndpoint = defaultEndpointsFactory.build({
  method: "post",
  tag: "files",
  description: "Handles a file upload.",
  input: z.looseObject({
    avatar: ez.upload(),
  }),
  output: z.object({
    name: z.string(),
    size: z.int().nonnegative(),
    mime: z.string(),
    hash: z.string(),
    otherInputs: z.record(z.string(), z.any()),
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
