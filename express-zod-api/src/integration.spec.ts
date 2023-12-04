import { z } from "zod";
import { Integration, defaultEndpointsFactory } from "./index";

describe("API Integration Generator", () => {
  test("Should support types variant and handle recirsive schemas", () => {
    const recursiveSchema: z.ZodTypeAny = z.lazy(() =>
      z.object({
        name: z.string(),
        features: recursiveSchema,
      }),
    );

    const client = new Integration({
      variant: "types",
      routing: {
        v1: {
          test: defaultEndpointsFactory.build({
            method: "post",
            input: z.object({
              features: recursiveSchema,
            }),
            output: z.object({}),
            handler: async () => ({}),
          }),
        },
      },
    });
    expect(client.print()).toMatchSnapshot();
  });

  test("Should treat optionals the same way as z.infer() by default", () => {
    const client = new Integration({
      routing: {
        v1: {
          "test-with-dashes": defaultEndpointsFactory.build({
            method: "post",
            tags: ["one", "two"],
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
      expect(client.print()).toMatchSnapshot();
    },
  );
});
