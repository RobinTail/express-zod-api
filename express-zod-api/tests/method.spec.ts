import * as R from "ramda";
import {
  isMethod,
  methods,
  Method,
  clientMethods,
  ClientMethod,
} from "../src/method";
import { describe } from "node:test";

describe("Method", () => {
  describe("methods array", () => {
    test("should be the list of selected keys of express router", () => {
      expect(methods).toEqual(["get", "post", "put", "delete", "patch"]);
    });
  });

  describe("clientMethods array", () => {
    test("should be same methods and the head", () => {
      expect(clientMethods).toEqual([
        "get",
        "post",
        "put",
        "delete",
        "patch",
        "head",
      ]);
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

  describe("ClientMethod type", () => {
    test("should match the entries of the methods array", () => {
      expectTypeOf<"get">().toExtend<ClientMethod>();
      expectTypeOf<"post">().toExtend<ClientMethod>();
      expectTypeOf<"put">().toExtend<ClientMethod>();
      expectTypeOf<"delete">().toExtend<ClientMethod>();
      expectTypeOf<"patch">().toExtend<ClientMethod>();
      expectTypeOf<"head">().toExtend<ClientMethod>();
      expectTypeOf<"wrong">().not.toExtend<ClientMethod>();
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
