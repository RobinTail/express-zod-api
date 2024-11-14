import { bench } from "vitest";
import { DependsOnMethod } from "../../src";
import { walkRouting } from "../../src/routing-walker";

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
  },
};

describe("Experiment for routing walker", () => {
  bench("current", () => {
    walkRouting({ routing, onEndpoint: vi.fn() });
  });
});
