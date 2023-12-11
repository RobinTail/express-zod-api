import { z } from "zod";
import {
  DependsOnMethod,
  EndpointsFactory,
  defaultResultHandler,
} from "../../src";
import { describe, expect, test } from "vitest";

describe("DependsOnMethod", () => {
  test("should accept empty object", () => {
    const instance = new DependsOnMethod({});
    expect(instance).toBeInstanceOf(DependsOnMethod);
    expect(instance.endpoints).toEqual({});
  });

  test("should accept an endpoint with a corresponding method", () => {
    const instance = new DependsOnMethod({
      post: new EndpointsFactory(defaultResultHandler).build({
        method: "post",
        input: z.object({}),
        output: z.object({}),
        handler: async () => ({}),
      }),
    });
    expect(instance).toBeInstanceOf(DependsOnMethod);
    expect(instance.endpoints).toHaveProperty("post");
  });

  test("should accept an endpoint with additional methods", () => {
    const endpoint = new EndpointsFactory(defaultResultHandler).build({
      methods: ["get", "post"],
      input: z.object({}),
      output: z.object({}),
      handler: async () => ({}),
    });
    const instance = new DependsOnMethod({
      get: endpoint,
      post: endpoint,
    });
    expect(instance).toBeInstanceOf(DependsOnMethod);
    expect(instance.endpoints).toHaveProperty("get");
    expect(instance.endpoints).toHaveProperty("post");
  });
});
