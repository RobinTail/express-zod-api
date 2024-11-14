import { bench } from "vitest";
import { retrieveUserEndpoint } from "../../example/endpoints/retrieve-user";
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
    walkRouting({ routing, onEndpoint: vi.fn() });
  });

  bench("featured", () => {
    walkRouting2({ routing, onEndpoint: vi.fn() });
  });
});

describe("stack ops", () => {
  const arr: number[] = [];
  bench("shift", () => {
    arr.push(1);
    arr.shift();
  });
  bench("pop", () => {
    arr.push(1);
    arr.pop();
  });
});
