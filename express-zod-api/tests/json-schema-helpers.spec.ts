import { z } from "zod";
import { flattenIO } from "../src/json-schema-helpers.ts";

describe("JSON Schema helpers", () => {
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

    test("should handle records", () => {
      const subject = z.toJSONSchema(
        z
          .record(z.literal(["one", "two"]), z.string())
          .meta({
            examples: [
              { one: "test", two: "jest" },
              { one: "some", two: "another" },
            ],
          })
          .or(
            z
              .record(z.enum(["three", "four"]), z.number())
              .meta({ examples: [{ three: 123, four: 456 }] }),
          ),
      );
      expect(flattenIO(subject)).toMatchSnapshot();
    });
  });
});
