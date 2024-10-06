import { keys } from "ramda";
import { defaultStatusCodes } from "../../src/api-response";

describe("ApiResponse", () => {
  describe("defaultStatusCodes", () => {
    test("should be 200 and 400", () => {
      expect(defaultStatusCodes).toMatchSnapshot();
      expect(keys(defaultStatusCodes)).toEqual(["positive", "negative"]);
    });
  });
});
