import { FrozenSet } from "../src/frozen-set";

describe("FrozenSet", () => {
  test("types", () => {
    expectTypeOf(Set).toExtend<typeof FrozenSet>();
    expectTypeOf(FrozenSet).not.toExtend<typeof Set>();
    expectTypeOf<Set<string>>().toExtend<FrozenSet<string>>();
  });

  test("should construct an empty Set", () => {
    expect(new FrozenSet().size).toBe(0);
    expect(new FrozenSet(undefined).size).toBe(0);
  });

  test("should construct a Set from an iterable", () => {
    const set = new FrozenSet(["get", "post", "get"]);
    expect(set).toBeInstanceOf(Set);
    expect(Object.prototype.toString.call(set)).toBe("[object Set]");
    expect(set.size).toBe(2);
    expect(set.has("get")).toBe(true);
    expect(Array.from(set)).toEqual(["get", "post"]);
  });

  test.each(["add", "delete", "clear"] as const)(
    "should reject the mutation via %s",
    (method) => {
      const set = new FrozenSet(["get"]);
      expect(() => set[method]("get")).toThrow(/read only/);
      expect(set.size).toBe(1);
    },
  );

  test.each([
    "union",
    "intersection",
    "difference",
    "symmetricDifference",
  ] as const)("::%s() should return a new FrozenSet", (method) => {
    const set = new FrozenSet(["get"]);
    const result = set[method](new Set(["post"]));
    expect(result).toBeInstanceOf(FrozenSet);
    expect(result).not.toBe(set);
  });
});
