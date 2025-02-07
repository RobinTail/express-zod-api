import { z } from "zod";
import {
  DependsOnMethod,
  EndpointsFactory,
  defaultResultHandler,
} from "../../express-zod-api/src";
import { AbstractEndpoint } from "../../express-zod-api/src/endpoint";

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
});
