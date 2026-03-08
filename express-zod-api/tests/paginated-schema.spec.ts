import { z } from "zod";
import {
  defaultEndpointsFactory,
  Documentation,
  ez,
  createConfig,
} from "../src";
import { givePort } from "../../tools/ports";

const userSchema = z.object({ id: z.number(), name: z.string() });

describe("ez.paginated()", () => {
  describe("offset style", () => {
    const pagination = ez.paginated({
      style: "offset",
      itemSchema: userSchema,
      maxLimit: 100,
      defaultLimit: 20,
    });

    describe("input", () => {
      test("parses query string params (coerced to numbers)", () => {
        const result = pagination.input.safeParse({
          limit: "10",
          offset: "5",
        });
        expect(result.success).toBe(true);
        if (result.success)
          expect(result.data).toEqual({ limit: 10, offset: 5 });
      });

      test("applies defaults when params omitted", () => {
        const result = pagination.input.safeParse({});
        expect(result.success).toBe(true);
        if (result.success)
          expect(result.data).toEqual({ limit: 20, offset: 0 });
      });

      test("applies defaultLimit only when limit omitted", () => {
        const result = pagination.input.safeParse({ offset: "100" });
        expect(result.success).toBe(true);
        if (result.success)
          expect(result.data).toEqual({ limit: 20, offset: 100 });
      });

      test("rejects limit above maxLimit", () => {
        const result = pagination.input.safeParse({
          limit: "101",
          offset: "0",
        });
        expect(result.success).toBe(false);
      });

      test("rejects negative offset", () => {
        const result = pagination.input.safeParse({
          limit: "10",
          offset: "-1",
        });
        expect(result.success).toBe(false);
      });

      test("accepts custom defaultLimit and maxLimit", () => {
        const custom = ez.paginated({
          style: "offset",
          itemSchema: userSchema,
          maxLimit: 50,
          defaultLimit: 10,
        });
        const result = custom.input.safeParse({});
        expect(result.success).toBe(true);
        if (result.success)
          expect(result.data).toEqual({ limit: 10, offset: 0 });

        const overMax = custom.input.safeParse({ limit: "51" });
        expect(overMax.success).toBe(false);
      });
    });

    describe("output", () => {
      const outputSchema = pagination.output;

      test("parses valid offset response", () => {
        const result = outputSchema.safeParse({
          items: [
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" },
          ],
          total: 42,
          limit: 10,
          offset: 0,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.items).toHaveLength(2);
          expect(result.data.total).toBe(42);
          expect(result.data.limit).toBe(10);
          expect(result.data.offset).toBe(0);
        }
      });

      test("rejects missing required fields", () => {
        const result = outputSchema.safeParse({
          items: [],
          total: 0,
          // missing limit, offset
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("cursor style", () => {
    const postSchema = z.object({ id: z.number(), title: z.string() });
    const pagination = ez.paginated({
      style: "cursor",
      itemSchema: postSchema,
      maxLimit: 50,
      defaultLimit: 20,
    });

    describe("input", () => {
      test("parses cursor and limit (coerced)", () => {
        const result = pagination.input.safeParse({
          cursor: "abc123",
          limit: "15",
        });
        expect(result.success).toBe(true);
        if (result.success)
          expect(result.data).toEqual({ cursor: "abc123", limit: 15 });
      });

      test("applies default when limit omitted, cursor optional", () => {
        const result = pagination.input.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toEqual({ limit: 20 });
      });

      test("accepts first page without cursor", () => {
        const result = pagination.input.safeParse({ limit: "10" });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toEqual({ limit: 10 });
      });

      test("rejects limit above maxLimit", () => {
        const result = pagination.input.safeParse({ limit: "51" });
        expect(result.success).toBe(false);
      });
    });

    describe("output", () => {
      const outputSchema = pagination.output;

      test("parses valid cursor response", () => {
        const result = outputSchema.safeParse({
          items: [{ id: 1, title: "First" }],
          nextCursor: "next_page_token",
          limit: 20,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.items).toHaveLength(1);
          expect(result.data.nextCursor).toBe("next_page_token");
          expect(result.data.limit).toBe(20);
        }
      });

      test("accepts nextCursor null", () => {
        const result = outputSchema.safeParse({
          items: [],
          nextCursor: null,
          limit: 20,
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe("composability", () => {
    test("input can be composed with .and() for extra params", () => {
      const pagination = ez.paginated({
        style: "offset",
        itemSchema: userSchema,
        maxLimit: 100,
        defaultLimit: 20,
      });
      const composed = pagination.input.and(
        z.object({
          search: z.string().optional(),
          role: z.enum(["admin", "user"]).optional(),
        }),
      );
      const result = composed.safeParse({
        limit: "10",
        offset: "0",
        search: "alice",
        role: "admin",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatchObject({
          limit: 10,
          offset: 0,
          search: "alice",
          role: "admin",
        });
      }
    });
  });

  describe("OpenAPI documentation", () => {
    const sampleConfig = createConfig({
      cors: true,
      logger: { level: "silent" },
      http: { listen: givePort() },
    });

    test("offset pagination endpoint is documented with query params and response schema", () => {
      const pagination = ez.paginated({
        style: "offset",
        itemSchema: userSchema,
        maxLimit: 100,
        defaultLimit: 20,
      });
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          users: defaultEndpointsFactory.build({
            method: "get",
            input: pagination.input,
            output: pagination.output,
            handler: async ({ input: { limit, offset } }) => ({
              items: [],
              total: 0,
              limit,
              offset,
            }),
          }),
        },
        version: "1.0.0",
        title: "Paginated API",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("cursor pagination endpoint is documented with query params and response schema", () => {
      const pagination = ez.paginated({
        style: "cursor",
        itemSchema: userSchema,
        maxLimit: 50,
        defaultLimit: 20,
      });
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          posts: defaultEndpointsFactory.build({
            method: "get",
            input: pagination.input,
            output: pagination.output,
            handler: async ({ input: { cursor, limit } }) => ({
              items: [],
              nextCursor: `next${cursor}`,
              limit,
            }),
          }),
        },
        version: "1.0.0",
        title: "Cursor Paginated API",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });
  });
});
