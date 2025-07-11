import ts from "typescript";
import { z } from "zod";
import {
  EndpointsFactory,
  Integration,
  Producer,
  defaultEndpointsFactory,
  ResultHandler,
} from "../src";

describe("Integration", () => {
  const recursive1: z.ZodType = z.lazy(() =>
    z.object({
      name: z.string(),
      features: recursive1,
    }),
  );
  const recursive2 = z.object({
    name: z.string(),
    get features() {
      return recursive2;
    },
  });

  test.each([recursive1, recursive2])(
    "Should support types variant and handle recursive schemas %#",
    (recursiveSchema) => {
      const client = new Integration({
        variant: "types",
        routing: {
          v1: {
            test: defaultEndpointsFactory
              .build({
                method: "post",
                input: z.object({
                  features: recursiveSchema,
                }),
                output: z.object({}),
                handler: async () => ({}),
              })
              .deprecated(),
          },
        },
      });
      expect(client.print()).toMatchSnapshot();
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

  test("Should support multiple response schemas depending on status code", async () => {
    const factory = new EndpointsFactory(
      new ResultHandler({
        positive: (data) => [
          {
            statusCode: 200,
            schema: z.object({ status: z.literal("ok"), data }),
          },
          {
            statusCode: 201,
            schema: z.object({ status: z.literal("kinda"), data }),
          },
        ],
        negative: [
          { statusCode: 400, schema: z.literal("error") },
          { statusCode: 500, schema: z.literal("failure") },
        ],
        handler: vi.fn(),
      }),
    );
    const client = new Integration({
      variant: "types",
      routing: {
        v1: {
          mtpl: factory.build({
            method: "post",
            input: z.object({ test: z.number() }),
            output: z.object({ payload: z.string() }),
            handler: async () => ({ payload: "test" }),
          }),
        },
      },
    });
    expect(await client.printFormatted()).toMatchSnapshot();
  });

  describe("Feature #1470: Custom brands", () => {
    test("should by handled accordingly", async () => {
      const rule: Producer = (
        schema: ReturnType<z.ZodType["brand"]>,
        { next },
      ) => {
        schema._zod.bag.brand = undefined;
        return next(schema);
      };
      const client = new Integration({
        variant: "types",
        brandHandling: {
          CUSTOM: () =>
            ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),
          DEEP: rule,
        },
        routing: {
          v1: {
            custom: defaultEndpointsFactory.build({
              method: "post",
              input: z.object({
                string: z.string().brand("CUSTOM"),
                regular: z.string().brand("DEEP"),
              }),
              output: z.object({
                number: z.number().brand("CUSTOM"),
              }),
              handler: vi.fn(),
            }),
          },
        },
      });
      expect(await client.printFormatted()).toMatchSnapshot();
    });
  });
});
