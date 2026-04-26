import { getSecurityHeaders } from "../src/security";

describe("getSecurityHeaders()", () => {
  test("should extract header names and ignore others", () => {
    expect(
      Array.from(
        getSecurityHeaders([
          { type: "header", name: "Auth" },
          { type: "cookie", name: "session" },
          { type: "bearer" },
          { type: "header", name: "Key" },
          { type: "openid", url: "https://auth.example.com" },
        ]),
      ),
    ).toEqual(["Auth", "Key"]);
  });

  test("should handle empty array", () => {
    expect(getSecurityHeaders([])).toHaveProperty("size", 0);
  });

  test.each([
    {
      and: [
        { type: "header" as const, name: "A" },
        { type: "bearer" as const },
      ],
    },
    {
      or: [{ type: "header" as const, name: "A" }, { type: "bearer" as const }],
    },
  ])("should extract headers from AND/OR %#", (container) => {
    expect(Array.from(getSecurityHeaders([container]))).toEqual(["A"]);
  });

  test.each([
    {
      and: [
        { type: "header" as const, name: "A1" },
        { or: [{ type: "header" as const, name: "A2" }] },
      ],
    },
    {
      or: [
        { type: "header" as const, name: "A1" },
        { and: [{ type: "header" as const, name: "A2" }] },
      ],
    },
  ])("should extract headers from nested AND/OR", (container) => {
    expect(Array.from(getSecurityHeaders([container]))).toEqual(["A1", "A2"]);
  });
});
