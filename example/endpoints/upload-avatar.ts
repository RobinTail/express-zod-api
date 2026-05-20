import { z } from "zod";
import { ez } from "express-zod-api";
import { createHash } from "node:crypto";
import { cookieAuthenticatedFactory } from "../factories.ts";

/** @desc The endpoint demonstrates handling a file upload and cookie as an input source */
export const uploadAvatarEndpoint = cookieAuthenticatedFactory.build({
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
  handler: async ({ input: { avatar, ...rest }, ctx: { session } }) => {
    if (!session.token) throw new Error("Unauthorized");
    return {
      name: avatar.name,
      size: avatar.size,
      mime: avatar.mimetype,
      hash: createHash("sha1").update(avatar.data).digest("hex"),
      otherInputs: rest,
    };
  },
});
