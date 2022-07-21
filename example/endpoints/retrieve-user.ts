import {
  z,
  createHttpError,
  defaultEndpointsFactory,
} from "../../src/index.js";
import { methodProviderMiddleware } from "../middlewares.js";

export const retrieveUserEndpoint = defaultEndpointsFactory
  .addMiddleware(methodProviderMiddleware)
  .build({
    method: "get",
    description: "example user retrieval endpoint",
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
