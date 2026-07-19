import {
  type ApiResponse,
  defaultStatusCodes,
  responseVariants,
} from "../src/api-response";
import { z } from "zod";

describe("ApiResponse", () => {
  test("type should satisfy", () => {
    expectTypeOf({ schema: z.string() }).toExtend<ApiResponse<z.ZodString>>();
  });

  describe("defaultStatusCodes", () => {
    test("should be 200 and 400", () => {
      expect(defaultStatusCodes).toMatchSnapshot();
    });
  });

  describe("responseVariants", () => {
    test("should consist of positive and negative", () => {
      expect(responseVariants).toMatchSnapshot();
    });
  });
});
