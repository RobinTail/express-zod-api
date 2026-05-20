import { cookieAssistedFactory } from "../factories.ts";
import { z } from "zod";
import { randomUUID, hash } from "node:crypto";

/** @desc The endpoint demonstrates setting a cookie */
export const loginEndpoint = cookieAssistedFactory.build({
  method: "post",
  tag: "cookies",
  input: z.object({
    username: z.string().optional(),
    password: z.string().optional(),
  }),
  output: z.object({ success: z.boolean(), message: z.string() }),
  handler: async ({ input: { username, password }, ctx: { setCookie } }) => {
    if (
      username === "admin" &&
      password &&
      hash("sha1", password) === "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3"
    ) {
      setCookie("session", { token: randomUUID() });
      return { success: true, message: "Logged in" };
    }
    return {
      success: false,
      message: "Invalid session/credentials",
    };
  },
});
