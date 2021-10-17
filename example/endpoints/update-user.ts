import { z, createHttpError, withMeta } from "../../src";
import { keyAndTokenAuthenticatedEndpointsFactory } from "../factories";

export const updateUserEndpoint =
  keyAndTokenAuthenticatedEndpointsFactory.build({
    method: "post",
    description: "example user update endpoint",
    input: withMeta(
      z.object({
        // id is the URL param
        id: z
          .string()
          .transform((value) => parseInt(value, 10))
          .refine(
            (value) => value >= 0,
            "should be greater than or equal to 0"
          ),
        name: z.string().nonempty(),
      })
    ).example({
      id: "12",
      name: "John Doe",
    }),
    output: withMeta(
      z.object({
        name: z.string(),
        timestamp: z.number().int().nonnegative(),
      })
    ).example({
      name: "John Doe",
      timestamp: 1235698995125,
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
        timestamp: Date.now(),
        name,
      };
    },
  });
