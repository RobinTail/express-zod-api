import z from "zod";
import { withMeta } from "../../src";
import { arrayRespondingFactory } from "../factories";

/**
 * This endpoint demonstrates the ability to respond with array.
 * Avoid doing this in new projects. This feature is only for easier migration of legacy APIs.
 * */
export const listUsersEndpoint = arrayRespondingFactory.build({
  method: "get",
  tag: "users",
  input: z.object({}),
  output: withMeta(
    z.object({
      // the arrayResultHandler will take the "array" prop as the response
      array: z.array(
        z.object({
          name: z.string(),
        }),
      ),
    }),
  ).example({
    array: [
      { name: "Hunter Schafer" },
      { name: "Laverne Cox" },
      { name: "Patti Harrison" },
    ],
  }),
  handler: async () => ({
    array: [
      { name: "Maria Merian" },
      { name: "Mary Anning" },
      { name: "Marie Skłodowska Curie" },
      { name: "Henrietta Leavitt" },
      { name: "Lise Meitner" },
      { name: "Alice Ball" },
      { name: "Gerty Cori" },
      { name: "Helen Taussig" },
    ],
  }),
});
