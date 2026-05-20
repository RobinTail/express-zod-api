import { cookieAssistedFactory } from "../factories.ts";
import { z } from "zod";
import { randomUUID, scrypt } from "node:crypto";
import createHttpError from "http-errors";
import assert from "node:assert/strict";
import { promisify } from "node:util";

/** @desc The endpoint demonstrates setting a cookie */
export const loginEndpoint = cookieAssistedFactory.build({
  method: "post",
  tag: "cookies",
  input: z.object({
    username: z.string().trim().nonempty(),
    password: z.string().trim().nonempty(),
  }),
  output: z.object({ message: z.string() }),
  handler: async ({ input: { username, password }, ctx: { setCookie } }) => {
    const key = await promisify<string, string, number, Buffer>(scrypt)(
      password,
      "kinda salt",
      16,
    );
    assert(
      username === "admin" &&
        key.toString("hex") === "79ad19b8c03bc92a2f25ed865400264e",
      createHttpError(401, "Invalid credentials"),
    );
    setCookie("session", { token: randomUUID() });
    return { message: "Logged in" };
  },
});
