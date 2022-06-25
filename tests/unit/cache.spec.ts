import { DefaultCache } from "../../src";
import { waitFor } from "../helpers";

describe("Cache", () => {
  describe("DefaultCache", () => {
    const cache = new DefaultCache();

    test("should set, get and delete items", () => {
      expect(cache.get("test")).toBeUndefined();
      cache.set("test", "something");
      expect(cache.get("test")).toBe("something");
      cache.delete("test");
      expect(cache.get("test")).toBeUndefined();
    });

    test("should expire", async () => {
      expect(cache.get("test")).toBeUndefined();
      cache.set("test", "something", 2);
      expect(cache.get("test")).toBe("something");
      await waitFor(() => cache.get("test") !== "something");
      expect(cache.get("test")).toBeUndefined();
    }, 5000);

    test("should clear", () => {
      expect(cache.get("test")).toBeUndefined();
      cache.set("test", "something");
      expect(cache.get("test")).toBe("something");
      cache.clear();
      expect(cache.get("test")).toBeUndefined();
    });

    test("should ensure", async () => {
      expect(cache.get("test")).toBeUndefined();
      const provider = jest.fn(async () => "something");
      expect(await cache.ensure("test", provider, 2)).toBe("something");
      expect(provider).toBeCalledTimes(1);
      expect(await cache.ensure("test", provider, 2)).toBe("something");
      expect(provider).toBeCalledTimes(1);
      await waitFor(() => cache.get("test") !== "something");
      expect(cache.get("test")).toBeUndefined();
      expect(await cache.ensure("test", provider, 2)).toBe("something");
      expect(provider).toBeCalledTimes(2);
    }, 5000);
  });
});
