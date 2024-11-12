import { z } from "zod";
import {
  DependsOnMethod,
  EndpointsFactory,
  defaultResultHandler,
} from "../../src";

describe("DependsOnMethod", () => {
  test("should accept empty object", () => {
    const instance = new DependsOnMethod({});
    expect(instance).toBeInstanceOf(DependsOnMethod);
    expect(instance.siblingMethods).toEqual([]);
    expect(instance.pairs).toEqual([]);
  });

  test("should accept an endpoint with a corresponding method", () => {
    const instance = new DependsOnMethod({
      post: new EndpointsFactory(defaultResultHandler).build({
        method: "post",
        output: z.object({}),
        handler: async () => ({}),
      }),
    });
    expect(instance).toBeInstanceOf(DependsOnMethod);
    expect(instance.siblingMethods).toEqual([]);
    expect(instance.pairs).toHaveLength(1);
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
    expect(instance).toBeInstanceOf(DependsOnMethod);
    expect(instance.siblingMethods).toEqual(["post"]);
    expect(instance.pairs).toHaveLength(2);
  });

  test("should reject empty assignments", () => {
    const instance = new DependsOnMethod({
      get: undefined,
      post: undefined,
    });
    expect(instance.pairs).toEqual([]);
    expect(instance.siblingMethods).toEqual([]);
  });
});
