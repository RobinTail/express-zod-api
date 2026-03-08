import { z } from "zod";
import { ez } from "../src";

const userSchema = z.object({ id: z.number(), name: z.string() });

describe("ez.paginated()", () => {
  describe("config validation", () => {
    test("throws when maxLimit is 0 or less", () => {
      expect(() =>
        ez.paginated({
          style: "offset",
          itemSchema: userSchema,
          maxLimit: 0,
        }),
      ).toThrow("ez.paginated: maxLimit must be greater than 0");
      expect(() =>
        ez.paginated({
          style: "cursor",
          itemSchema: userSchema,
          maxLimit: -1,
        }),
      ).toThrow("ez.paginated: maxLimit must be greater than 0");
    });

    test("throws when defaultLimit is greater than maxLimit", () => {
      expect(() =>
        ez.paginated({
          style: "offset",
          itemSchema: userSchema,
          maxLimit: 10,
          defaultLimit: 20,
        }),
      ).toThrow("ez.paginated: defaultLimit must not be greater than maxLimit");
    });

    test("throws when itemsName matches reserved key for offset output", () => {
      for (const reserved of ["total", "limit", "offset"]) {
        expect(() =>
          ez.paginated({
            style: "offset",
            itemSchema: userSchema,
            itemsName: reserved,
          }),
        ).toThrow(
          "ez.paginated: itemsName must not match reserved keys for offset output (total, limit, offset)",
        );
      }
    });

    test("throws when itemsName matches reserved key for cursor output", () => {
      for (const reserved of ["nextCursor", "limit"]) {
        expect(() =>
          ez.paginated({
            style: "cursor",
            itemSchema: userSchema,
            itemsName: reserved,
          }),
        ).toThrow(
          "ez.paginated: itemsName must not match reserved keys for cursor output (nextCursor, limit)",
        );
      }
    });
  });

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
        const payload = {
          items: [
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" },
          ],
          total: 42,
          limit: 10,
          offset: 0,
        };
        const result = outputSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
          expectTypeOf(result.data).toMatchTypeOf<
            z.input<typeof outputSchema>
          >();
          expect(result.data).toHaveProperty("items");
          expect(result.data.items).toEqual(payload.items);
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
        const payload = {
          items: [{ id: 1, title: "First" }],
          nextCursor: "next_page_token",
          limit: 20,
        };
        const result = outputSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
          expectTypeOf(result.data).toMatchTypeOf<
            z.input<typeof outputSchema>
          >();
          expect(result.data).toHaveProperty("items");
          expect(result.data.items).toEqual(payload.items);
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

  describe("custom itemsName", () => {
    test("output uses custom key for items array (offset and cursor)", () => {
      const offsetPagination = ez.paginated({
        style: "offset",
        itemSchema: userSchema,
        itemsName: "users",
        maxLimit: 100,
        defaultLimit: 20,
      });
      const offsetResult = offsetPagination.output.safeParse({
        users: [{ id: 1, name: "Alice" }],
        total: 1,
        limit: 20,
        offset: 0,
      });
      expect(offsetResult.success).toBe(true);
      if (offsetResult.success) {
        expectTypeOf(offsetResult.data).toMatchTypeOf<
          z.input<typeof offsetPagination.output>
        >();
        expect(offsetResult.data).toHaveProperty("users");
        expect(offsetResult.data.users).toEqual([{ id: 1, name: "Alice" }]);
        expect(offsetResult.data).not.toHaveProperty("items");
      }

      const cursorPagination = ez.paginated({
        style: "cursor",
        itemSchema: userSchema,
        itemsName: "results",
        maxLimit: 50,
        defaultLimit: 20,
      });
      const cursorResult = cursorPagination.output.safeParse({
        results: [{ id: 2, name: "Bob" }],
        nextCursor: null,
        limit: 20,
      });
      expect(cursorResult.success).toBe(true);
      if (cursorResult.success) {
        expectTypeOf(cursorResult.data).toMatchTypeOf<
          z.input<typeof cursorPagination.output>
        >();
        expect(cursorResult.data).toHaveProperty("results");
        expect(cursorResult.data.results).toEqual([{ id: 2, name: "Bob" }]);
        expect(cursorResult.data).not.toHaveProperty("items");
      }
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
});
