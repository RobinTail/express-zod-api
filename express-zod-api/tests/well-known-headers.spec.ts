import { getWellKnownHeaders } from "../src/well-known-headers";

describe("getWellKnownHeaders()", () => {
  test("should return a memoized Set having a lot of entries", () => {
    const first = getWellKnownHeaders();
    expect(first).toBeInstanceOf(Set);
    const second = getWellKnownHeaders();
    expect(second.size).toBeGreaterThan(200);
    expect(first).toBe(second); // same by reference
  });
});
