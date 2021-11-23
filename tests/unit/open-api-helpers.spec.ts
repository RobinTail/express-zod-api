import { z } from "../../src/index";
import {
  depictSchema,
  excludeParamsFromDepiction,
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
});
