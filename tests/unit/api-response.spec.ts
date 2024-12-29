import { defaultStatusCodes, responseVariants } from "../../src/api-response";

describe("ApiResponse", () => {
  describe("defaultStatusCodes", () => {
    test("should be 200 and 400", () => {
      expect(defaultStatusCodes).toMatchSnapshot();
    });
  });

  describe("responseVariants", () => {
    test("should consist of positive and negative", () => {
      expect(responseVariants).toHaveLength(2);
      expect(responseVariants).toContain("positive");
      expect(responseVariants).toContain("negative");
    });
  });
});
