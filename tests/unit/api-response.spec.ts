import { createApiResponse, z } from "../../src/index.js";

describe("ApiResponse", () => {
  describe("createApiResponse()", () => {
    test("should accept an array of mime types", () => {
      const output = z.object({});
      expect(createApiResponse(output, ["something", "anything"])).toEqual({
        schema: output,
        mimeTypes: ["something", "anything"],
      });
    });

    test("should accept a single mime type", () => {
      const output = z.object({});
      expect(createApiResponse(output, "something")).toEqual({
        schema: output,
        mimeTypes: ["something"],
      });
    });

    test("should assume json mime type by default", () => {
      const output = z.object({});
      expect(createApiResponse(output)).toEqual({
        schema: output,
        mimeTypes: ["application/json"],
      });
    });
  });
});
