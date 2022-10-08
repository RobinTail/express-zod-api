import { z, createHttpError } from "../../src";
import { taggedEndpointsFactory } from "../factories";
import { methodProviderMiddleware } from "../middlewares";

export const retrieveUserEndpoint = taggedEndpointsFactory
  .addMiddleware(methodProviderMiddleware)
  .build({
    method: "get",
    description: "example user retrieval endpoint",
    tags: ["users"],
    input: z.object({
      id: z
        .string()
        .trim()
        .regex(/\d+/)
        .transform((id) => parseInt(id, 10))
        .describe("a numeric string containing the id of the user"),
    }),
    output: z.object({
      id: z.number().int().nonnegative(),
      name: z.string(),
    }),
    handler: async ({ input: { id }, options: { method }, logger }) => {
      logger.debug(`Requested id: ${id}, method ${method}`);
      const name = "John Doe";
      if (id > 100) {
        throw createHttpError(404, "User not found");
      }
      return { id, name };
    },
  });
