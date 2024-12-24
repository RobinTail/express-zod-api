import { bench } from "vitest";

function lazyWithInternalProp<T>(getter: () => T) {
  return {
    __value: undefined as T,
    get value() {
      if (this.__value) return this.__value;
      const value = getter();
      this.__value = value;
      return value;
    },
  };
}

function lazyWithScopeProp<T>(getter: () => T): {
  value: T;
  __value?: T;
} {
  let __value: T;
  return {
    get value() {
      if (__value) return __value;
      const value = getter();
      __value = value;
      return value;
    },
  };
}

function lazyWithGetterOverride<T>(getter: () => T): {
  value: T;
} {
  return {
    get value() {
      const value = getter();
      Object.defineProperty(this, "value", { value });
      return value;
    },
  };
}

const a = lazyWithInternalProp(() => "test");
const b = lazyWithScopeProp(() => "test");
const c = lazyWithGetterOverride(() => "test");

/**
 * @see https://x.com/colinhacks/status/1865002498332795032
 * @see https://x.com/colinhacks/status/1865143412812664985
 * @see https://gist.github.com/colinhacks/a8d5772c1078b9285efb2455ab95fadf
 */
describe("AB test: uuid", () => {
  bench("internal_prop", () => {
    a.value;
  });

  bench("scope_prop", () => {
    b.value;
  });

  bench("getter_override", () => {
    c.value;
  });
});
