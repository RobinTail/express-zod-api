import {
  type BasicSecurity,
  type BearerSecurity,
  type CookieSecurity,
  getSecurityNames,
  type HeaderSecurity,
  type InputSecurity,
  type OAuth2Security,
  type OpenIdSecurity,
} from "../src/security";

describe("Security", () => {
  test("types should satisfy", () => {
    expectTypeOf<{ type: "basic" }>().toEqualTypeOf<BasicSecurity>();
    expectTypeOf<{
      type: "bearer";
      format?: string;
    }>().toEqualTypeOf<BearerSecurity>();
    expectTypeOf<{
      type: "cookie";
      name: string;
    }>().toEqualTypeOf<CookieSecurity>();
    expectTypeOf<{
      type: "header";
      name: string;
    }>().toEqualTypeOf<HeaderSecurity>();
    expectTypeOf<{ type: "input"; name: string }>().toEqualTypeOf<
      InputSecurity<string>
    >();
    expectTypeOf<{ type: "oauth2" }>().toExtend<OAuth2Security<string>>();
    expectTypeOf<{
      type: "openid";
      url: string;
    }>().toEqualTypeOf<OpenIdSecurity>();
  });

  describe("getSecurityNames", () => {
    test("should return empty set for empty containers", () => {
      expect(getSecurityNames([], "header")).toHaveProperty("size", 0);
    });

    test.each([
      { type: "basic" as const },
      { and: [{ type: "basic" as const }, { type: "bearer" as const }] },
    ])(
      "should return empty set for containers without matching type %#",
      (container) => {
        expect(getSecurityNames([container], "header")).toHaveProperty(
          "size",
          0,
        );
      },
    );

    test.each([
      { type: "header" as const, name: "test" },
      { type: "cookie" as const, name: "test" },
      { type: "input" as const, name: "test" },
    ])("should extract names from $type container", (container) => {
      expect(Array.from(getSecurityNames([container], container.type))).toEqual(
        ["test"],
      );
    });

    test.each([
      {
        and: [
          { type: "header" as const, name: "x-auth" },
          { type: "header" as const, name: "x-token" },
        ],
      },
      {
        or: [
          { type: "header" as const, name: "x-auth" },
          { type: "header" as const, name: "x-token" },
        ],
      },
      {
        and: [
          { type: "header" as const, name: "x-auth" },
          {
            or: [
              { type: "header" as const, name: "x-token" },
              { type: "basic" as const },
              { type: "cookie" as const, name: "session" },
            ],
          },
        ],
      },
    ])("should extract names from nested container %#", (container) => {
      expect(Array.from(getSecurityNames([container], "header"))).toEqual([
        "x-auth",
        "x-token",
      ]);
    });
  });
});
