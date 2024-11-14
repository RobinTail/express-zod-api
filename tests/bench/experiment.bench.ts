import { bench } from "vitest";
import { DependsOnMethod } from "../../src";
import { walkRouting, walkRouting2 } from "../../src/routing-walker";

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
                    j: new DependsOnMethod({}),
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
    walkRouting({ routing, onEndpoint: vi.fn() });
  });

  bench("featured", () => {
    walkRouting2({ routing, onEndpoint: vi.fn() });
  });
});
