import { z } from "zod";
import { ez } from "../../src";
import { createHash } from "node:crypto";
import { taggedEndpointsFactory } from "../factories";
import createHttpError from "http-errors";

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
    if (avatar.truncated) {
      throw createHttpError(413, "The file is too large");
    }
    return {
      name: avatar.name,
      size: avatar.size,
      mime: avatar.mimetype,
      hash: createHash("sha1").update(avatar.data).digest("hex"),
      otherInputs: rest,
    };
  },
});
