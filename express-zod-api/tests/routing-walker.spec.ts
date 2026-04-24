import { defaultEndpointsFactory } from "../src";
import { walkRouting } from "../src/routing-walker";

describe("walkRouting()", () => {
  const endpoint = defaultEndpointsFactory.buildVoid({
    handler: vi.fn(),
  });

  test("should process endpoints in depth-first order", () => {
    const routing = {
      v1: {
        user: { retrieve: endpoint, create: endpoint },
        post: endpoint,
      },
    };

    const onEndpoint = vi.fn();

    walkRouting({
      routing,
      config: { cors: false, methodLikeRouteBehavior: "path" },
      onEndpoint,
    });

    expect(onEndpoint.mock.calls).toEqual([
      ["get", "/v1/user/retrieve", endpoint],
      ["get", "/v1/user/create", endpoint],
      ["get", "/v1/post", endpoint],
    ]);
  });

  test("should process nested routes before siblings", () => {
    const routing = { a: { b: { c: endpoint }, d: endpoint } };

    const onEndpoint = vi.fn();
    walkRouting({
      routing,
      config: { cors: false, methodLikeRouteBehavior: "path" },
      onEndpoint,
    });

    expect(onEndpoint.mock.calls).toEqual([
      ["get", "/a/b/c", endpoint],
      ["get", "/a/d", endpoint],
    ]);
  });
});
