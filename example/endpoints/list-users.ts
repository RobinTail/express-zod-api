import { z } from "zod";
import { arrayRespondingFactory } from "../factories.ts";

const roleSchema = z.enum(["manager", "operator", "admin"]);

const users = [
  { name: "Maria Merian", role: "manager" },
  { name: "Mary Anning", role: "operator" },
  { name: "Marie Skłodowska Curie", role: "admin" },
  { name: "Henrietta Leavitt", role: "manager" },
  { name: "Lise Meitner", role: "operator" },
  { name: "Alice Ball", role: "admin" },
  { name: "Gerty Cori", role: "manager" },
  { name: "Helen Taussig", role: "operator" },
] as const;

/**
 * This endpoint demonstrates the ability to respond with array.
 * Avoid doing this in new projects. This feature is only for easier migration of legacy APIs.
 * */
export const listUsersEndpoint = arrayRespondingFactory.build({
  tag: "users",
  input: z.object({
    roles: z.array(roleSchema).optional(),
  }),
  output: z.object({
    // the arrayResultHandler will take the "items" prop as the response
    items: z.array(z.object({ name: z.string(), role: roleSchema })).example([
      { name: "Hunter Schafer", role: "manager" },
      { name: "Laverne Cox", role: "operator" },
      { name: "Patti Harrison", role: "admin" },
    ]),
  }),
  handler: async ({ input: { roles } }) => ({
    items: users.filter(({ role }) => roles?.includes(role) ?? true),
  }),
});
