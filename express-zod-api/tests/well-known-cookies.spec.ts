import { getWellKnownCookies } from "../src/well-known-cookies";

describe("getWellKnownCookies()", () => {
  test("should return a memoized Set having a lot of entries", () => {
    const first = getWellKnownCookies();
    expect(first).toBeInstanceOf(Set);
    const second = getWellKnownCookies();
    expect(second.size).toBeGreaterThan(10);
    expect(first).toBe(second); // same by reference
  });
});
