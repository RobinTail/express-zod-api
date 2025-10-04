import * as R from "ramda";
import {
  isMethod,
  methods,
  type Method,
  clientMethods,
  type ClientMethod,
  type SomeMethod,
  type CORSMethod,
} from "../src/method.ts";

describe("Method", () => {
  describe("SomeMethod type", () => {
    test("should be a lowercase string", () => {
      expectTypeOf<"test">().toExtend<SomeMethod>();
      expectTypeOf<"TEST">().not.toExtend<SomeMethod>();
    });
  });

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

  describe("Method type", () => {
    test("should match the entries of the methods array", () => {
      expectTypeOf<"get">().toExtend<Method>();
      expectTypeOf<"post">().toExtend<Method>();
      expectTypeOf<"put">().toExtend<Method>();
      expectTypeOf<"delete">().toExtend<Method>();
      expectTypeOf<"patch">().toExtend<Method>();
      expectTypeOf<"wrong">().not.toExtend<Method>();
      expectTypeOf<Method>().toExtend<SomeMethod>();
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
      expectTypeOf<ClientMethod>().toExtend<SomeMethod>();
    });
  });

  describe("CORSMethod type", () => {
    test("should extends ClientMethod with options", () => {
      expectTypeOf<"get">().toExtend<CORSMethod>();
      expectTypeOf<"post">().toExtend<CORSMethod>();
      expectTypeOf<"put">().toExtend<CORSMethod>();
      expectTypeOf<"delete">().toExtend<CORSMethod>();
      expectTypeOf<"patch">().toExtend<CORSMethod>();
      expectTypeOf<"head">().toExtend<CORSMethod>();
      expectTypeOf<"options">().toExtend<CORSMethod>();
      expectTypeOf<"wrong">().not.toExtend<CORSMethod>();
      expectTypeOf<CORSMethod>().toExtend<SomeMethod>();
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
