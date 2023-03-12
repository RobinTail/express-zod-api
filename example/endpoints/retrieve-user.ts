import { createHttpError, z } from "../../src";
import { taggedEndpointsFactory } from "../factories";
import { methodProviderMiddleware } from "../middlewares";

// Demonstrating circular schemas using z.lazy()
const baseFeature = z.object({
  title: z.string(),
});
type Feature = z.infer<typeof baseFeature> & {
  features: Feature[];
};
const feature: z.ZodType<Feature> = baseFeature.extend({
  features: z.lazy(() => feature.array()),
});

export const retrieveUserEndpoint = taggedEndpointsFactory
  .addMiddleware(methodProviderMiddleware)
  .build({
    method: "get",
    tag: "users",
    shortDescription: "Retrieves the user.",
    description: "Example user retrieval endpoint.",
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
      features: feature.array(),
    }),
    handler: async ({ input: { id }, options: { method }, logger }) => {
      logger.debug(`Requested id: ${id}, method ${method}`);
      const name = "John Doe";
      if (id > 100) {
        throw createHttpError(404, "User not found");
      }
      return {
        id,
        name,
        features: [
          { title: "Tall", features: [{ title: "Above 180cm", features: [] }] },
          { title: "Young", features: [] },
          {
            title: "Cute",
            features: [
              {
                title: "Tells funny jokes",
                features: [{ title: "About Typescript", features: [] }],
              },
            ],
          },
        ],
      };
    },
  });
