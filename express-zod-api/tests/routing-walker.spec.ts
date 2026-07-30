import { defaultEndpointsFactory, type Routing } from "../src";
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
});
