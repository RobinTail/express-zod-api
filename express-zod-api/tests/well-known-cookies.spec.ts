import { getWellKnownCookies } from "../src/well-known-cookies";

describe("getWellKnownCookies()", () => {
  test("should return a memoized Set of certain cookie names", () => {
    const first = getWellKnownCookies();
    expect(first).toBeInstanceOf(Set);
    expect(first.size).toBeGreaterThan(1);
    expect([...first].every((name) => name.startsWith("session"))).toBe(true);
    const second = getWellKnownCookies();
    expect(first).toBe(second); // same by reference
  });
});
