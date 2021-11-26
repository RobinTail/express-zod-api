import { z } from "../../src/index";
import {
  depictSchema,
  excludeParamsFromDepiction,
  reformatParamsInPath,
} from "../../src/open-api-helpers";

describe("Open API helpers", () => {
  describe("excludeParamsFromDepiction()", () => {
    test("should omit specified path params", () => {
      const depicted = depictSchema({
        schema: z.object({
          a: z.string(),
          b: z.string(),
        }),
        isResponse: false,
      });
      expect(excludeParamsFromDepiction(depicted, ["a"])).toMatchSnapshot();
    });

    test("should handle union", () => {
      const depicted = depictSchema({
        schema: z
          .object({
            a: z.string(),
          })
          .or(
            z.object({
              b: z.string(),
            })
          ),
        isResponse: false,
      });
      expect(excludeParamsFromDepiction(depicted, ["a"])).toMatchSnapshot();
    });

    test("should handle intersection", () => {
      const depicted = depictSchema({
        schema: z
          .object({
            a: z.string(),
          })
          .and(
            z.object({
              b: z.string(),
            })
          ),
        isResponse: false,
      });
      expect(excludeParamsFromDepiction(depicted, ["a"])).toMatchSnapshot();
    });
  });

  describe("reformatParamsInPath()", () => {
    test("should replace route path params from colon to curly braces notation", () => {
      expect(reformatParamsInPath("/v1/user")).toBe("/v1/user");
      expect(reformatParamsInPath("/v1/user/:id")).toBe("/v1/user/{id}");
      expect(reformatParamsInPath("/v1/flight/:from-:to")).toBe(
        "/v1/flight/{from}-{to}"
      );
      expect(reformatParamsInPath("/v1/flight/:from-:to/updates")).toBe(
        "/v1/flight/{from}-{to}/updates"
      );
    });
  });
});
