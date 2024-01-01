import createHttpError from "http-errors";
import assert from "node:assert/strict";
import { z } from "zod";
import { statusDependingFactory } from "../factories";

export const createUserEndpoint = statusDependingFactory.build({
  method: "post",
  tag: "users",
  input: z.object({
    name: z.string().min(1),
  }),
  output: z.object({
    id: z.number().int().positive(),
  }),
  handler: async ({ input: { name } }) => {
    assert.notEqual(
      name,
      "Gimme Jimmy",
      createHttpError(500, "That went wrong"),
    );
    assert.notEqual(
      name,
      "James McGill",
      createHttpError(409, "That one already exists", { id: 16 }),
    );
    return {
      id: 16,
    };
  },
});
