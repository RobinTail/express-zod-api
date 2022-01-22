import { z, createHttpError, withMeta } from "../../src";
import { keyAndTokenAuthenticatedEndpointsFactory } from "../factories";

export const updateUserEndpoint =
  keyAndTokenAuthenticatedEndpointsFactory.build({
    method: "post",
    description: "example user update endpoint",
    input: withMeta(
      z.object({
        // id is the route path param of /v1/user/:id
        id: z
          .string()
          .transform((value) => parseInt(value, 10))
          .refine(
            (value) => value >= 0,
            "should be greater than or equal to 0"
          ),
        name: z.string().nonempty(),
        birthday: z.dateIn(),
      })
    ).example({
      id: "12",
      name: "John Doe",
      birthday: "1963-04-21",
    }),
    output: withMeta(
      z.object({
        name: z.string(),
        changedAt: z.dateOut(),
      })
    ).example({
      name: "John Doe",
      changedAt: new Date("2021-12-31"),
    }),
    handler: async ({
      input: { id, name, key },
      options: { token },
      logger,
    }) => {
      logger.debug(`id, key and token: ${id}, ${key}, ${token}`);
      if (id > 100) {
        throw createHttpError(404, "User not found");
      }
      return {
        changedAt: new Date("2022-01-22"),
        name,
      };
    },
  });
