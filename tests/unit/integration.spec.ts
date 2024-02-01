import { z } from "zod";
import { routing } from "../../example/routing";
import {
  EndpointsFactory,
  Integration,
  createResultHandler,
  defaultEndpointsFactory,
} from "../../src";
import { describe, expect, test, vi } from "vitest";

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
            methods: "post",
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
              methods: "post",
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
            methods: "post",
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

  test("Should support multiple response schemas depending on status code", async () => {
    const factory = new EndpointsFactory(
      createResultHandler({
        getPositiveResponse: (output) => [
          {
            statusCodes: 200,
            schema: z.object({ status: z.literal("ok"), data: output }),
          },
          {
            statusCodes: 201,
            schema: z.object({ status: z.literal("kinda"), data: output }),
          },
        ],
        getNegativeResponse: () => [
          { statusCodes: 400, schema: z.literal("error") },
          { statusCodes: 500, schema: z.literal("failure") },
        ],
        handler: vi.fn(),
      }),
    );
    const client = new Integration({
      splitResponse: true,
      variant: "types",
      routing: {
        v1: {
          mtpl: factory.build({
            methods: "post",
            input: z.object({ test: z.number() }),
            output: z.object({ payload: z.string() }),
            handler: async () => ({ payload: "test" }),
          }),
        },
      },
    });
    expect(await client.printFormatted()).toMatchSnapshot();
  });
});
