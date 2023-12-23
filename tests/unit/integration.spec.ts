import { z } from "zod";
import { routing } from "../../example/routing";
import { Integration, defaultEndpointsFactory } from "../../src";
import { describe, expect, test } from "vitest";

describe("Integration", () => {
  test.each(["client", "types"] as const)(
    "Should generate a %s for example API",
    async (variant) => {
      const client = new Integration({ variant, routing });
      expect(await client.printFormatted()).toMatchSnapshot();
    },
  );

  test("Should treat optionals the same way as z.infer() by default", async () => {
    const client = new Integration({
      routing: {
        v1: {
          "test-with-dashes": defaultEndpointsFactory.build({
            method: "post",
            input: z.object({
              opt: z.string().optional(),
            }),
            output: z.object({
              similar: z.number().optional(),
            }),
            handler: async () => ({}),
          }),
        },
      },
    });
    expect(await client.printFormatted()).toMatchSnapshot();
  });

  test.each([{ withQuestionMark: true }, { withUndefined: true }, {}])(
    "Feature #945: should have configurable treatment of optionals %#",
    async (optionalPropStyle) => {
      const client = new Integration({
        optionalPropStyle,
        routing: {
          v1: {
            "test-with-dashes": defaultEndpointsFactory.build({
              method: "post",
              input: z.object({
                opt: z.string().optional(),
              }),
              output: z.object({
                similar: z.number().optional(),
              }),
              handler: async () => ({}),
            }),
          },
        },
      });
      expect(await client.printFormatted()).toMatchSnapshot();
    },
  );

  test("Feature #1411: Should split response type on demand", async () => {
    const client = new Integration({
      splitResponse: true,
      routing: {
        v1: {
          test: defaultEndpointsFactory.build({
            method: "post",
            input: z.object({
              opt: z.string().optional(),
            }),
            output: z.object({
              similar: z.number().optional(),
            }),
            handler: async () => ({}),
          }),
        },
      },
    });
    expect(await client.printFormatted()).toMatchSnapshot();
  });
});
