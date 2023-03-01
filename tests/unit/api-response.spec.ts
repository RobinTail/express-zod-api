import { createApiResponse, z } from "../../src";

/** @todo remove in v9 */
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
        mimeType: "something",
      });
    });

    test("mime type can be optional", () => {
      const output = z.object({});
      expect(createApiResponse(output)).toEqual({ schema: output });
    });
  });
});
