import createHttpError from "http-errors";
import assert from "node:assert/strict";
import { z } from "zod/v4";
import { ez } from "express-zod-api";
import { keyAndTokenAuthenticatedEndpointsFactory } from "../factories";

/**
 * Examples on branded schemas have also to be branded
 * @see https://zod.dev/api?id=branded-types
 * @todo remove if fixed:
 * @see https://github.com/colinhacks/zod/issues/4441
 * */
const createdAtSchema = ez.dateOut();
const createdAt = createdAtSchema.example(
  createdAtSchema.parse(new Date("2021-12-31")),
);

export const updateUserEndpoint =
  keyAndTokenAuthenticatedEndpointsFactory.build({
    tag: "users",
    description: "Changes the user record. Example user update endpoint.",
    input: z.object({
      // id is the route path param of /v1/user/:id
      id: z
        .string()
        .example("12") // before transformation
        .transform((value) => parseInt(value, 10))
        .refine((value) => value >= 0, "should be greater than or equal to 0"),
      name: z.string().nonempty().example("John Doe"),
      birthday: ez.dateIn({ examples: ["1963-04-21"] }),
    }),
    output: z.object({
      name: z.string().example("John Doe"),
      createdAt,
    }),
    handler: async ({
      input: { id, name },
      options: { authorized }, // comes from authMiddleware
      logger,
    }) => {
      logger.debug(`${authorized} is changing user #${id}`);
      assert(id <= 100, createHttpError(404, "User not found"));
      return {
        createdAt: new Date("2022-01-22"),
        name,
      };
    },
  });
