import "../../src/zod-plugin"; // required for this test // @todo until import from index
import { z } from "zod";
import { formatEvent, makeEventSchema } from "../../src/sse";

describe("SSE", () => {
  describe("makeEventSchema()", () => {
    test("should make a valid schema of SSE event", () => {
      expect(makeEventSchema("test", z.string())).toMatchSnapshot();
    });
  });

  describe("formatEvent()", () => {
    test("should format a valid event into string", () => {
      expect(formatEvent({ test: z.string() }, "test", "something")).toBe(
        `event: test\ndata: "something"\n\n`,
      );
    });
    test("should withstand newlines", () => {
      expect(formatEvent({ test: z.string() }, "test", "some\ntext")).toBe(
        `event: test\ndata: "some\\ntext"\n\n`,
      );
    });
    test("should fail for unknown event", () => {
      expect(() =>
        formatEvent({ test: z.string() }, "another" as "test", "text"),
      ).toThrowError();
    });
    test("should fail for invalid data", () => {
      expect(() =>
        formatEvent({ test: z.string() }, "test", 123),
      ).toThrowError();
    });
  });
});
