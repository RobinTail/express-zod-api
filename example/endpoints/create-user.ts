import createHttpError from "http-errors";
import assert from "node:assert/strict";
import { z } from "zod";
import { statusDependingFactory } from "../factories.ts";

/** @desc depending on the thrown error, the custom result handler of the factory responds slightly differently */
export const createUserEndpoint = statusDependingFactory.build({
  method: "post",
  tag: "users",
  input: z.object({
    name: z.string().nonempty(),
  }),
  output: z.object({
    id: z.number().int().positive(),
  }),
  handler: async ({ input: { name } }) => {
    assert(name !== "Gimme Jimmy", createHttpError(500, "That went wrong"));
    assert(
      name !== "James McGill",
      createHttpError(409, "That one already exists", { id: 16 }),
    );
    return { id: 16 };
  },
});
