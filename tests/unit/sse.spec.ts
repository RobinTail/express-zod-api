import "../../src/zod-plugin"; // required for this test // @todo until import from index
import { z } from "zod";
import { makeEventSchema } from "../../src/sse";

describe("SSE", () => {
  describe("makeEventSchema()", () => {
    test("should make a valid schema of SSE event", () => {
      expect(makeEventSchema("test", z.string())).toMatchSnapshot();
    });
  });
});
