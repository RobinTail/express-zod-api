import { bench, describe } from "vitest";
import { z } from "zod";
import { depictExamples } from "../../src/documentation-helpers";
import "../../src/zod-plugin";

describe.each([true, false])("Experiment %s", (isResponse) => {
  bench("original", () => {
    depictExamples(
      z
        .object({
          one: z.string().transform((v) => v.length),
          two: z.number().transform((v) => `${v}`),
          three: z.boolean(),
        })
        .example({
          one: "test",
          two: 123,
          three: true,
        })
        .example({
          one: "test2",
          two: 456,
          three: false,
        }),
      isResponse,
      ["three"],
    );
  });

  bench("featured", () => {
    depictExamples(
      z
        .object({
          one: z.string().transform((v) => v.length),
          two: z.number().transform((v) => `${v}`),
          three: z.boolean(),
        })
        .example({
          one: "test",
          two: 123,
          three: true,
        })
        .example({
          one: "test2",
          two: 456,
          three: false,
        }),
      isResponse,
      ["three"],
    );
  });
});
