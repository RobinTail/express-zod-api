import { z } from "zod";
import { defaultEndpointsFactory, ez } from "express-zod-api";

const roleSchema = z.enum(["manager", "operator", "admin"]);

const userSchema = z.object({
  name: z.string(),
  role: roleSchema,
});

const paginatedUsers = ez.paginated({
  style: "offset",
  itemSchema: userSchema,
  itemsName: "users",
  maxLimit: 100,
  defaultLimit: 20,
});

const users: z.output<typeof userSchema>[] = [
  { name: "Maria Merian", role: "manager" },
  { name: "Mary Anning", role: "operator" },
  { name: "Marie Skłodowska Curie", role: "admin" },
  { name: "Henrietta Leavitt", role: "manager" },
  { name: "Lise Meitner", role: "operator" },
  { name: "Alice Ball", role: "admin" },
  { name: "Gerty Cori", role: "manager" },
  { name: "Helen Taussig", role: "operator" },
];

/**
 * Lists users with offset pagination and optional role filter.
 * Uses ez.paginated() for request params (limit, offset) and response shape (items, total, limit, offset).
 */
export const listUsersPaginatedEndpoint = defaultEndpointsFactory.build({
  tag: "users",
  shortDescription: "Lists users with pagination.",
  description:
    "Returns a page of users. Optionally filter by roles. Uses offset-based pagination (limit and offset).",
  input: paginatedUsers.input.and(
    z.object({
      roles: z
        .array(roleSchema)
        .optional()
        .describe("Filter by roles; omit for all"),
    }),
  ),
  output: paginatedUsers.output,
  handler: async ({ input: { limit, offset, roles } }) => {
    const filtered = roles
      ? users.filter(({ role }) => roles.includes(role))
      : users;
    const total = filtered.length;
    const page = filtered.slice(offset, offset + limit);
    return { users: page, total, limit, offset };
  },
});
