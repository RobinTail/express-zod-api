import * as R from "ramda";
import { isMethod, methods, Method, AuxMethod } from "../src/method";

describe("Method", () => {
  describe("methods array", () => {
    test("should be the list of selected keys of express router", () => {
      expect(methods).toEqual(["get", "post", "put", "delete", "patch"]);
    });
  });

  describe("the type", () => {
    test("should match the entries of the methods array", () => {
      expectTypeOf<"get">().toExtend<Method>();
      expectTypeOf<"post">().toExtend<Method>();
      expectTypeOf<"put">().toExtend<Method>();
      expectTypeOf<"delete">().toExtend<Method>();
      expectTypeOf<"patch">().toExtend<Method>();
      expectTypeOf<"wrong">().not.toExtend<Method>();
    });
  });

  describe("AuxMethod", () => {
    test("should be options or head", () => {
      expectTypeOf<"options">().toExtend<AuxMethod>();
      expectTypeOf<"head">().toExtend<AuxMethod>();
      expectTypeOf<"other">().not.toExtend<AuxMethod>();
    });
  });

  describe("isMethod", () => {
    test.each(methods)("should validate %s", (one) => {
      expect(isMethod(one)).toBe(true);
    });
    test.each([...R.map(R.toUpper, methods), "", " ", "wrong"])(
      "should invalidate others %#",
      (one) => {
        expect(isMethod(one)).toBe(false);
      },
    );
  });
});
