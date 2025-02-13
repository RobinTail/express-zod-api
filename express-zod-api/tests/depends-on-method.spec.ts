import { z } from "zod";
import {
  DependsOnMethod,
  EndpointsFactory,
  defaultResultHandler,
} from "../src";
import { AbstractEndpoint } from "../src/endpoint";

describe("DependsOnMethod", () => {
  test("should accept empty object", () => {
    const instance = new DependsOnMethod({});
    expect(instance).toBeInstanceOf(DependsOnMethod);
    expect(instance.entries).toEqual([]);
  });

  test("should accept an endpoint with a corresponding method", () => {
    const instance = new DependsOnMethod({
      post: new EndpointsFactory(defaultResultHandler).build({
        method: "post",
        output: z.object({}),
        handler: async () => ({}),
      }),
    });
    expect(instance.entries).toEqual([
      ["post", expect.any(AbstractEndpoint), []],
    ]);
  });

  test.each([{ methods: ["get", "post"] } as const, {}])(
    "should accept an endpoint capable to handle multiple methods %#",
    (inc) => {
      const endpoint = new EndpointsFactory(defaultResultHandler).build({
        ...inc,
        output: z.object({}),
        handler: async () => ({}),
      });
      const instance = new DependsOnMethod({ get: endpoint, post: endpoint });
      expect(instance.entries).toEqual([
        ["get", expect.any(AbstractEndpoint), ["post"]],
        ["post", expect.any(AbstractEndpoint), ["get"]],
      ]);
    },
  );

  test("should reject empty assignments", () => {
    const instance = new DependsOnMethod({
      get: undefined,
      post: undefined,
    });
    expect(instance.entries).toEqual([]);
  });

  test("should be able to deprecate the assigned endpoints within a copy of itself", () => {
    const instance = new DependsOnMethod({
      post: new EndpointsFactory(defaultResultHandler).build({
        method: "post",
        output: z.object({}),
        handler: async () => ({}),
      }),
    });
    expect(instance.entries[0][1].isDeprecated).toBe(false);
    const copy = instance.deprecated();
    expect(copy.entries[0][1].isDeprecated).toBe(true);
    expect(copy).not.toBe(instance);
  });
});
