import createHttpError from "http-errors";
import * as R from "ramda";
import { z } from "zod";

describe("Environment checks", () => {
  describe("Zod Dates", () => {
    test.each(["2021-01-32", "22/01/2022", "2021-01-31T25:00:00.000Z"])(
      "should detect invalid date %#",
      (str) => {
        expect(z.date().safeParse(new Date(str)).success).toBeFalsy();
        expect(z.string().date().safeParse(str).success).toBeFalsy();
        expect(z.string().datetime().safeParse(str).success).toBeFalsy();
        expect(z.iso.date().safeParse(str).success).toBeFalsy();
        expect(z.iso.datetime().safeParse(str).success).toBeFalsy();
      },
    );
  });

  /**
   * @todo try z.int().max(1000) when it's fixed in Zod 4
   * @link https://github.com/colinhacks/zod/issues/4162
   */
  describe("Zod checks/refinements", () => {
    test.each([
      z.string().email(),
      z.email(),
      z.number().int(),
      z.int(),
      z.int32(),
    ])("Snapshot control $constructor.name definition", (schema) => {
      const snapshot = R.omit(["id", "version"], schema._zod);
      expect(snapshot).toMatchSnapshot();
    });

    /**
     * @link https://github.com/colinhacks/zod/issues/4162
     * @link https://github.com/colinhacks/zod/issues/4141
     * */
    test("This should fail when they fix it", () => {
      expect(z.email()).not.toHaveProperty("max");
    });
  });

  describe("Vitest error comparison", () => {
    test("should distinguish error instances of different classes", () => {
      expect(createHttpError(500, "some message")).not.toEqual(
        new Error("some message"),
      );
    });

    test("should distinguish HTTP errors by status code and message", () => {
      expect(createHttpError(400, "test")).not.toEqual(
        createHttpError(500, "test"),
      );
      expect(createHttpError(400, "one")).not.toEqual(
        createHttpError(400, "two"),
      );
      expect(createHttpError(400, new Error("one"))).not.toEqual(
        createHttpError(400, new Error("two")),
      );
    });

    test("should distinguish error causes", () => {
      expect(new Error("test", { cause: "one" })).not.toEqual(
        new Error("test", { cause: "two" }),
      );
      expect(
        createHttpError(400, new Error("test", { cause: "one" })),
      ).not.toEqual(createHttpError(400, new Error("test", { cause: "two" })));
    });
  });
});
