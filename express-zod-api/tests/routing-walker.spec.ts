import { defaultEndpointsFactory, type Routing, RoutingError } from "../src";
import { walkRouting } from "../src/routing-walker";

describe("walkRouting()", () => {
  const endpoint = defaultEndpointsFactory.buildVoid({
    handler: vi.fn(),
  });

  const onEndpoint = vi.fn();

  afterEach(() => {
    onEndpoint.mockClear();
  });

  test.each<Routing>([
    {
      v1: {
        user: { retrieve: endpoint, create: endpoint },
        record: endpoint,
      },
    },
    { a: { b: { c: endpoint }, d: endpoint } },
  ])("should process endpoints in depth-first order %#", (routing) => {
    walkRouting({ routing, config: { cors: false }, onEndpoint });
    expect(onEndpoint.mock.calls).toMatchSnapshot();
  });

  test.each<[Routing, string]>([
    [{ "/": endpoint }, "/"],
    [{ "": endpoint }, "/"],
    [{ "get /": endpoint }, "/"],
  ])("should normalize root path %s to %s", (routing, expectedPath) => {
    walkRouting({ routing, config: { cors: false }, onEndpoint });
    expect(onEndpoint).toHaveBeenCalledTimes(1);
    expect(onEndpoint).toHaveBeenCalledWith("get", expectedPath, endpoint);
  });

  test.each<[Routing, string]>([
    [
      { "get /items/:id": endpoint, "get /items/:slug": endpoint },
      'the normalized path "/items/:1" is already registered',
    ],
    [
      { "get /users/:id": endpoint, "get /users/:uid": endpoint },
      'the normalized path "/users/:1" is already registered',
    ],
    [
      { "get /a/:x/b/:y": endpoint, "get /a/:u/b/:v": endpoint },
      'the normalized path "/a/:1/b/:2" is already registered',
    ],
  ])(
    "Issue #3579: Should detect duplicate routes with differently named params %#",
    (routing, expectedMessageSubstring) => {
      const fn = () =>
        walkRouting({ routing, config: { cors: false }, onEndpoint });
      expect(fn).toThrow(RoutingError);
      expect(fn).toThrow(expectedMessageSubstring);
    },
  );

  test("Should allow cross-method routes with differently named params", () => {
    const routing: Routing = {
      "get /users/:id": endpoint,
      "delete /users/:userId": endpoint,
    };
    expect(() =>
      walkRouting({ routing, config: { cors: false }, onEndpoint }),
    ).not.toThrow();
  });

  test("Should deduplicate the methods declared by the endpoint", () => {
    const dupEndpoint = defaultEndpointsFactory.buildVoid({
      method: ["get", "get"],
      handler: vi.fn(),
    });
    expect(() =>
      walkRouting({
        routing: { "/x": dupEndpoint },
        config: { cors: false },
        onEndpoint,
      }),
    ).not.toThrow();
    expect(onEndpoint).toHaveBeenCalledTimes(1);
    expect(onEndpoint).toHaveBeenCalledWith("get", "/x", dupEndpoint);
  });
});
