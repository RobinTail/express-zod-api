import { z } from "zod";
import { ez } from "../../src";
import { createHash } from "node:crypto";
import { taggedEndpointsFactory } from "../factories";

export const uploadAvatarEndpoint = taggedEndpointsFactory.build({
  method: "post",
  tag: "files",
  description: "Handles a file upload.",
  input: z
    .object({
      avatar: ez
        .upload()
        .refine(
          (file) => file.mimetype.match(/image\/.+/),
          "Should be an image",
        ),
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
