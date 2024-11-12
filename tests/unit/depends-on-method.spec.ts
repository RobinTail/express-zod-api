import { z } from "zod";
import {
  DependsOnMethod,
  EndpointsFactory,
  defaultResultHandler,
} from "../../src";
import { AbstractEndpoint } from "../../src/endpoint";

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

  test("should accept an endpoint with additional methods", () => {
    const endpoint = new EndpointsFactory(defaultResultHandler).build({
      methods: ["get", "post"],
      output: z.object({}),
      handler: async () => ({}),
    });
    const instance = new DependsOnMethod({
      get: endpoint,
      post: endpoint,
    });
    expect(instance.entries).toEqual([
      ["get", expect.any(AbstractEndpoint), ["post"]],
      ["post", expect.any(AbstractEndpoint), ["get"]],
    ]);
  });

  test("should reject empty assignments", () => {
    const instance = new DependsOnMethod({
      get: undefined,
      post: undefined,
    });
    expect(instance.entries).toEqual([]);
  });
});
