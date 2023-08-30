import z from "zod";
import { arrayRespondingFactory } from "../factories";

export const listUsersEndpoint = arrayRespondingFactory.build({
  method: "get",
  tag: "users",
  input: z.object({}),
  output: z.object({
    array: z.array(
      z.object({
        name: z.string(),
      }),
    ),
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
