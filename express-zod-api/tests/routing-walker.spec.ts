import { defaultEndpointsFactory, type Routing, RoutingError } from "../src";
import { walkRouting } from "../src/routing-walker";
import { z } from "zod";

describe("walkRouting()", () => {
  const endpoint = defaultEndpointsFactory.buildVoid({
    handler: vi.fn(),
  });
  const deleteEndpoint = defaultEndpointsFactory.build({
    method: "delete",
    input: z.object({}),
    output: z.object({}),
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
    [{ "get /items/:id": endpoint, "get /items/:slug": endpoint }, "the normalized path \"/items/:1\" is already registered"],
    [{ "get /users/:id": endpoint, "get /users/:uid": endpoint }, "the normalized path \"/users/:1\" is already registered"],
    [{ "get /a/:x/b/:y": endpoint, "get /a/:u/b/:v": endpoint }, "the normalized path \"/a/:1/b/:2\" is already registered"],
  ])(
    "Should detect duplicate routes with differently named params %#",
    (routing, expectedMessageSubstring) => {
      expect(() =>
        walkRouting({ routing, config: { cors: false }, onEndpoint }),
      ).toThrow(RoutingError);
      try {
        walkRouting({ routing, config: { cors: false }, onEndpoint });
      } catch (e) {
        expect((e as RoutingError).message).toContain(expectedMessageSubstring);
      }
    },
  );

  test("Should allow cross-method routes with differently named params", () => {
    const routing: Routing = {
      "get /users/:id": endpoint,
      "delete /users/:userId": deleteEndpoint,
    };
    expect(() =>
      walkRouting({ routing, config: { cors: false }, onEndpoint }),
    ).not.toThrow();
  });
});
