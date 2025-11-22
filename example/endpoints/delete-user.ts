import createHttpError from "http-errors";
import assert from "node:assert/strict";
import { z } from "zod";
import { noContentFactory } from "../factories";

/** @desc The endpoint demonstrates no content response established by its factory */
export const deleteUserEndpoint = noContentFactory.buildVoid({
  method: "delete",
  tag: "users",
  input: z.object({
    id: z
      .string()
      .regex(/\d+/)
      .transform((id) => parseInt(id, 10))
      .describe("numeric string"),
  }),
  handler: async ({ input: { id } }) => {
    assert(id <= 100, createHttpError(404, "User not found"));
  },
});
