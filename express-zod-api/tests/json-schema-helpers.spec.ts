import { z } from "zod";
import {
  flattenIO,
  isJsonObjectSchema,
  mergeExamples,
  propsMerger,
  canMerge,
  nestOptional,
  processAllOf,
  processVariants,
  processPropertyNames,
  pullRequestExamples,
} from "../src/json-schema-helpers";

describe("JSON Schema helpers", () => {
  describe("isJsonObjectSchema()", () => {
    test("should return true for object schema", () => {
      expect(isJsonObjectSchema({ type: "object" })).toBe(true);
    });

    test.each(["string", "array"] as const)(
      "should return false for non-object schema",
      (one) => {
        expect(isJsonObjectSchema({ type: one })).toBe(false);
      },
    );
  });

  describe("propsMerger()", () => {
    test("should merge objects deeply", () => {
      expect(propsMerger({ a: { b: 1 } }, { a: { c: 2 } })).toStrictEqual({
        a: { b: 1, c: 2 },
      });
    });

    test("should throw when leaf values cannot be merged", () => {
      expect(() => propsMerger({ a: 1 }, { a: "string" })).toThrow(
        "Can not flatten properties",
      );
    });
  });

  describe("canMerge()", () => {
    test("should return true for empty object", () => {
      expect(canMerge({})).toBe(true);
    });

    test("should return true for object with only mergeable keys", () => {
      expect(canMerge({ type: "object", properties: {} })).toBe(true);
    });

    test.each([{ title: "test" }, { format: "date-time" }])(
      "should return false for object with non-mergeable keys",
      (subj) => {
        expect(canMerge(subj)).toBe(false);
      },
    );
  });

  describe("nestOptional()", () => {
    test("should pair true with given argument", () => {
      expect(nestOptional({ type: "string" })).toEqual([
        true,
        { type: "string" },
      ]);
    });
  });

  describe("processAllOf()", () => {
    test("should return empty array when no allOf", () => {
      const result = processAllOf(
        { type: "object", properties: {} },
        { isStrict: false, isOptional: false },
      );
      expect(result).toEqual([]);
    });

    test("should map allOf entries with isOptional flag in non-strict mode", () => {
      const result = processAllOf(
        {
          type: "object",
          allOf: [{ type: "object", properties: { a: { type: "string" } } }],
        },
        { isStrict: false, isOptional: true },
      );
      expect(result).toEqual([
        [true, { type: "object", properties: { a: { type: "string" } } }],
      ]);
    });

    test("should throw in strict mode when schema cannot be merged", () => {
      expect(() =>
        processAllOf(
          { type: "object", allOf: [{ type: "string" }] },
          { isStrict: true, isOptional: false },
        ),
      ).toThrow("Can not merge");
    });

    test("should allow mergeable schemas in strict mode", () => {
      const result = processAllOf(
        {
          type: "object",
          allOf: [{ type: "object", properties: { a: { type: "string" } } }],
        },
        { isStrict: true, isOptional: false },
      );
      expect(result).toEqual([
        [false, { type: "object", properties: { a: { type: "string" } } }],
      ]);
    });
  });

  describe("processVariants()", () => {
    test("should return empty array when no anyOf/oneOf", () => {
      const result = processVariants({ type: "object", properties: {} });
      expect(result).toEqual([]);
    });

    test("should process anyOf as optional", () => {
      const result = processVariants({
        type: "object",
        anyOf: [{ type: "string" }, { type: "number" }],
      });
      expect(result).toEqual([
        [true, { type: "string" }],
        [true, { type: "number" }],
      ]);
    });

    test("should process oneOf as optional", () => {
      const result = processVariants({
        type: "object",
        oneOf: [{ type: "string" }, { type: "number" }],
      });
      expect(result).toEqual([
        [true, { type: "string" }],
        [true, { type: "number" }],
      ]);
    });
  });

  describe("processPropertyNames()", () => {
    test("should not modify flat when no propertyNames", () => {
      const flat = { type: "object" as const, properties: {} };
      const flatRequired: string[] = [];
      processPropertyNames(
        { type: "object", properties: {} },
        flat,
        flatRequired,
        false,
      );
      expect(flat.properties).toEqual({});
      expect(flatRequired).toEqual([]);
    });

    test("should extract const key", () => {
      const flat = { type: "object" as const, properties: {} };
      const flatRequired: string[] = [];
      processPropertyNames(
        { type: "object", propertyNames: { const: "key" } },
        flat,
        flatRequired,
        false,
      );
      expect(flat.properties).toHaveProperty("key");
      expect(flatRequired).toContain("key");
    });

    test("should extract enum keys", () => {
      const flat = { type: "object" as const, properties: {} };
      const flatRequired: string[] = [];
      processPropertyNames(
        { type: "object", propertyNames: { enum: ["a", "b"] } },
        flat,
        flatRequired,
        false,
      );
      expect(flat.properties).toHaveProperty("a");
      expect(flat.properties).toHaveProperty("b");
      expect(flatRequired).toContain("a");
      expect(flatRequired).toContain("b");
    });

    test("should not add to required when optional", () => {
      const flat = { type: "object" as const, properties: {} };
      const flatRequired: string[] = [];
      processPropertyNames(
        { type: "object", propertyNames: { const: "key" } },
        flat,
        flatRequired,
        true,
      );
      expect(flat.properties).toHaveProperty("key");
      expect(flatRequired).toEqual([]);
    });
  });

  describe("mergeExamples()", () => {
    test("should do nothing when entry has no examples", () => {
      const flat = { type: "object" as const, properties: {} };
      mergeExamples(flat, { type: "string" }, { isOptional: false });
      expect(flat).toEqual({ type: "object", properties: {} });
    });

    test.each([0, -1, NaN])(
      "should do nothing when maxCombinations=%s",
      (maxCombinations) => {
        const flat = { type: "object" as const, properties: {} };
        mergeExamples(
          flat,
          { examples: [{ a: 1 }] },
          { isOptional: false, maxCombinations },
        );
        expect(flat).toEqual({ type: "object", properties: {} });
      },
    );

    test("should concatenate examples when optional", () => {
      const flat = {
        type: "object" as const,
        properties: {},
        examples: [{ a: 1 }],
      };
      mergeExamples(
        flat,
        { examples: [{ b: 2 }, { c: 3 }] },
        { isOptional: true },
      );
      expect(flat.examples).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
    });

    test.each([true, false])(
      "should initialize examples when flat has none (isOptional=%s)",
      (isOptional) => {
        const flat = { type: "object" as const, properties: {} };
        mergeExamples(flat, { examples: [{ a: 1 }] }, { isOptional });
        expect(flat).toHaveProperty("examples", [{ a: 1 }]);
      },
    );

    test("should produce combinations when required", () => {
      const flat = {
        type: "object" as const,
        properties: {},
        examples: [{ a: 1 }],
      };
      mergeExamples(
        flat,
        { examples: [{ b: 2 }, { b: 3 }] },
        { isOptional: false },
      );
      expect(flat.examples).toEqual([
        { a: 1, b: 2 },
        { a: 1, b: 3 },
      ]);
    });
  });

  describe("pullRequestExamples()", () => {
    test("should return empty array for empty properties", () => {
      expect(pullRequestExamples({ type: "object", properties: {} })).toEqual(
        [],
      );
    });

    test("should return empty array when properties have no examples", () => {
      expect(
        pullRequestExamples({
          type: "object",
          properties: { name: { type: "string" } },
        }),
      ).toEqual([]);
    });

    test("should extract examples from properties", () => {
      expect(
        pullRequestExamples({
          type: "object",
          properties: { name: { type: "string", examples: ["john", "jane"] } },
        }),
      ).toEqual([{ name: "john" }, { name: "jane" }]);
    });

    test("should combine examples from multiple properties", () => {
      expect(
        pullRequestExamples({
          type: "object",
          properties: {
            name: { type: "string", examples: ["john", "jane"] },
            age: { type: "number", examples: [25, 30] },
          },
        }),
      ).toEqual([
        { name: "john", age: 25 },
        { name: "john", age: 30 },
        { name: "jane", age: 25 },
        { name: "jane", age: 30 },
      ]);
    });

    test("should respect the given limit", () => {
      expect(
        pullRequestExamples(
          {
            type: "object",
            properties: {
              name: { type: "string", examples: ["john", "jane"] },
              age: { type: "number", examples: [25, 30] },
            },
          },
          2,
        ),
      ).toEqual([
        { name: "john", age: 25 },
        { name: "john", age: 30 },
      ]);
    });

    test.each([0, -1, NaN])("should return empty for limit=%s", (limit) => {
      expect(
        pullRequestExamples(
          {
            type: "object",
            properties: {
              name: { type: "string", examples: ["john"] },
            },
          },
          limit,
        ),
      ).toEqual([]);
    });
  });

  describe("flattenIO()", () => {
    test("should pass the object schema through", () => {
      const subject = flattenIO({
        type: "object",
        properties: { one: { type: "string" } },
        required: ["one"],
        examples: [{ one: "test" }],
      });
      expect(subject).toMatchSnapshot();
    });

    test("should return object schema for the union of object schemas", () => {
      const subject = flattenIO({
        oneOf: [
          {
            type: "object",
            properties: { one: { type: "string" } },
            required: ["one"],
            examples: [{ one: "test" }],
          },
          {
            type: "object",
            properties: { two: { type: "number" } },
            required: ["two"],
            examples: [{ two: "jest" }],
          },
        ],
      });
      expect(subject).toMatchSnapshot();
    });

    test("should return object schema for the intersection of object schemas", () => {
      const subject = flattenIO({
        allOf: [
          {
            type: "object",
            properties: { one: { type: "string" } },
            required: ["one"],
            examples: [{ one: "test" }],
          },
          {
            type: "object",
            properties: { two: { type: "number" } },
            required: ["two"],
            examples: [{ two: "jest" }],
          },
        ],
      });
      expect(subject).toMatchSnapshot();
    });

    test("should use top level examples of the intersection", () => {
      const subject = flattenIO({
        examples: [{ one: "test", two: "jest" }],
        allOf: [
          {
            type: "object",
            properties: { one: { type: "string" } },
            required: ["one"],
          },
          {
            type: "object",
            properties: { two: { type: "number" } },
            required: ["two"],
          },
        ],
      });
      expect(subject).toMatchSnapshot();
    });

    test("should pull examples up from object schema props", () => {
      const subject = flattenIO({
        allOf: [
          {
            type: "object",
            properties: { one: { type: "string", examples: ["test", "jest"] } },
            required: ["one"],
          },
          {
            type: "object",
            properties: { two: { type: "number", examples: [123] } },
            required: ["two"],
          },
        ],
      });
      expect(subject).toMatchSnapshot();
    });

    describe("should handle records", () => {
      const rec1 = z.record(z.literal(["one", "two"]), z.string()).meta({
        examples: [
          { one: "test", two: "jest" },
          { one: "some", two: "another" },
        ],
      });
      const rec2 = z
        .record(z.enum(["three", "four"]), z.number())
        .meta({ examples: [{ three: 123, four: 456 }] });

      test("in union", () => {
        const subject = z.toJSONSchema(rec1.or(rec2));
        expect(flattenIO(subject)).toMatchSnapshot();
      });

      test("in intersection", () => {
        const subject = z.toJSONSchema(rec1.and(rec2));
        expect(flattenIO(subject)).toMatchSnapshot();
      });
    });
  });
});
