import {
  type ApiResponse,
  createApiResponse,
  defaultStatusCodes,
  isPositiveStatusCode,
  responseVariants,
} from "../src/api-response";
import { z } from "zod";
import * as R from "ramda";

describe("ApiResponse", () => {
  test("type should satisfy", () => {
    expectTypeOf({ schema: z.string() }).toExtend<ApiResponse<z.ZodString>>();
  });

  describe("defaultStatusCodes", () => {
    test("should be 200 and 400", () => {
      expect(defaultStatusCodes).toMatchSnapshot();
      expect(isPositiveStatusCode(defaultStatusCodes.positive)).toBe(true);
      expect(isPositiveStatusCode(defaultStatusCodes.negative)).toBe(false);
    });
  });

  describe("responseVariants", () => {
    test("should consist of positive and negative", () => {
      expect(responseVariants).toMatchSnapshot();
    });
  });

  describe("createApiResponse()", () => {
    test("should accept schema", () => {
      const schema = z.string();
      expect(createApiResponse(schema)).toEqual({ schema });
      expectTypeOf(createApiResponse(schema)).toEqualTypeOf<
        ApiResponse<z.ZodString>
      >();
    });
    test("should accept ApiResponse", () => {
      const response = { schema: z.string(), statusCode: 204 };
      expect(createApiResponse(response)).toEqual(response);
      expectTypeOf(createApiResponse(response)).toEqualTypeOf<
        ApiResponse<z.ZodString>
      >();
    });
  });

  describe("isPositiveStatusCode", () => {
    test.each(R.range(100, 400))(
      "should consider %s as positive",
      (statusCode) => {
        expect(isPositiveStatusCode(statusCode)).toBe(true);
      },
    );
    test.each(R.range(400, 600))(
      "should consider %s as negative",
      (statusCode) => {
        expect(isPositiveStatusCode(statusCode)).toBe(false);
      },
    );
  });
});
