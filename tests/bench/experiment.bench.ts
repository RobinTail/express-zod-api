import { bench } from "vitest";
import { retrieveUserEndpoint } from "../../example/endpoints/retrieve-user";
import { DependsOnMethod } from "../../src";
import { walkRouting, _old } from "../../src/routing-walker";

const routing = {
  a: {
    b: {
      c: {
        d: {
          e: {
            f: {
              g: {
                h: {
                  i: {
                    j: new DependsOnMethod({
                      post: retrieveUserEndpoint,
                    }),
                  },
                },
              },
            },
          },
        },
      },
    },
    k: { l: {} },
    m: {},
  },
};

describe("Experiment for routing walker", () => {
  bench("current", () => {
    _old({ routing, onEndpoint: vi.fn() });
  });

  bench("featured", () => {
    walkRouting({ routing, onEndpoint: vi.fn() });
  });
});
