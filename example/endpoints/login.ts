import { cookieAssistedFactory } from "../factories.ts";
import { z } from "zod";
import { randomUUID, hash } from "node:crypto";
import createHttpError from "http-errors";
import assert from "node:assert/strict";

/** @desc The endpoint demonstrates setting a cookie */
export const loginEndpoint = cookieAssistedFactory.build({
  method: "post",
  tag: "cookies",
  input: z.object({
    username: z.string().optional(),
    password: z.string().optional(),
  }),
  output: z.object({ message: z.string() }),
  handler: async ({ input: { username, password }, ctx: { setCookie } }) => {
    assert(
      username === "admin" &&
        password &&
        hash("sha1", password) === "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3",
      createHttpError(401, "Invalid credentials"),
    );
    setCookie("session", { token: randomUUID() });
    return { message: "Logged in" };
  },
});
