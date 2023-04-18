import { z } from "zod";
import { routing } from "../../example/routing";
import { Client, defaultEndpointsFactory } from "../../src";

describe("API Client Generator", () => {
  test("Should generate a client for example API", () => {
    const client = new Client({ routing });
    expect(client.print()).toMatchSnapshot();
  });

  test("Should treat optionals the same way as z.infer() by default", () => {
    const client = new Client({
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
    expect(client.print()).toMatchSnapshot();
  });

  test.each([{ withQuestionMark: true }, { withUndefined: true }, {}])(
    "Feature #945: should have configurable treatment of optionals %#",
    (optionalPropStyle) => {
      const client = new Client({
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
      expect(client.print()).toMatchSnapshot();
    }
  );
});
