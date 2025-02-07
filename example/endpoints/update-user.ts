import createHttpError from "http-errors";
import assert from "node:assert/strict";
import { z } from "zod";
import { ez } from "express-zod-api";
import { keyAndTokenAuthenticatedEndpointsFactory } from "../factories";

export const updateUserEndpoint =
  keyAndTokenAuthenticatedEndpointsFactory.build({
    tag: "users",
    description: "Changes the user record. Example user update endpoint.",
    input: z.object({
      // id is the route path param of /v1/user/:id
      id: z
        .string()
        .transform((value) => parseInt(value, 10))
        .refine((value) => value >= 0, "should be greater than or equal to 0")
        .example("12"),
      name: z.string().nonempty().example("John Doe"),
      birthday: ez.dateIn().example("1963-04-21"),
    }),
    output: z.object({
      name: z.string().example("John Doe"),
      createdAt: ez.dateOut().example(new Date("2021-12-31")),
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
