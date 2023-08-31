import z from "zod";
import { withMeta } from "../../src";
import { arrayRespondingFactory } from "../factories";

export const listUsersEndpoint = arrayRespondingFactory.build({
  method: "get",
  tag: "users",
  input: z.object({}),
  output: withMeta(
    z.object({
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
