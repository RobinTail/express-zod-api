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
});
