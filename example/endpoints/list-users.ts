import z from "zod/v4";
import { arrayRespondingFactory } from "../factories";

/**
 * This endpoint demonstrates the ability to respond with array.
 * Avoid doing this in new projects. This feature is only for easier migration of legacy APIs.
 * */
export const listUsersEndpoint = arrayRespondingFactory.build({
  tag: "users",
  output: z.object({
    // the arrayResultHandler will take the "items" prop as the response
    items: z
      .array(z.object({ name: z.string() }))
      .example([
        { name: "Hunter Schafer" },
        { name: "Laverne Cox" },
        { name: "Patti Harrison" },
      ]),
  }),
  handler: async () => ({
    items: [
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
