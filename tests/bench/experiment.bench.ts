import { bench } from "vitest";
import { serialize } from "superjson";

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
                    j: new Date(),
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

describe("Experiment on serialization", () => {
  bench("JSON.stringify()", () => {
    JSON.stringify(routing);
  });

  bench("superjson.serialize()", () => {
    serialize(routing);
  });
});
