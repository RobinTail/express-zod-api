import { z } from "zod";
import { routing } from "../../example/routing";
import { createIntegration, defaultEndpointsFactory } from "../../src";
import { describe, expect, test } from "vitest";

describe("createIntegration()", () => {
  test.each(["client", "types"] as const)(
    "Should generate a %s for example API",
    async (variant) => {
      const client = createIntegration({ variant, routing });
      expect(client).toHaveProperty("program");
      expect(await client.print()).toMatchSnapshot();
    },
  );

  test("Should treat optionals the same way as z.infer() by default", async () => {
    const client = createIntegration({
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
    expect(await client.print()).toMatchSnapshot();
  });

  test.each([{ withQuestionMark: true }, { withUndefined: true }, {}])(
    "Feature #945: should have configurable treatment of optionals %#",
    async (optionalPropStyle) => {
      const client = createIntegration({
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
      expect(await client.print()).toMatchSnapshot();
    },
  );
});
