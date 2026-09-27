import * as R from "ramda";
import ts from "typescript";
import { globalRegistry, z } from "zod";
import {
  EndpointsFactory,
  defaultEndpointsFactory,
  ResultHandler,
} from "../src";
import { Integration, type Producer } from "../src/integration";
import { brandProperty } from "../src/metadata";

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
  const configMock = { cors: false };

  test.each([recursive1, recursive2])(
    "Should support types variant and handle recursive schemas %#",
    (recursiveSchema) => {
      const client = new Integration({
        variant: "types",
        config: configMock,
        routing: {
          v1: {
            test: defaultEndpointsFactory
              .buildVoid({
                method: "query",
                input: z.object({ features: recursiveSchema }),
                handler: vi.fn(),
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
      config: configMock,
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

  test.each([undefined, false])(
    "Should support HEAD method by default %#",
    async (hasHeadMethod) => {
      const client = new Integration({
        config: configMock,
        hasHeadMethod,
        variant: "types",
        routing: {
          v1: {
            "get path": defaultEndpointsFactory
              .addMiddleware({
                security: { type: "cookie", name: "session" },
                input: z.object({ session: z.object() }),
                handler: vi.fn(),
              })
              .buildVoid({
                input: z.object({ some: z.string() }),
                handler: vi.fn(),
              }),
          },
        },
      });
      expect(await client.printFormatted()).toMatchSnapshot();
    },
  );

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
      config: configMock,
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
        globalRegistry.remove(schema);
        return next(schema);
      };
      const client = new Integration({
        config: configMock,
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
                string: z.string().meta({ [brandProperty]: "CUSTOM" }),
                regular: z.string().meta({ [brandProperty]: "DEEP" }),
              }),
              output: z.object({
                number: z.number().meta({ [brandProperty]: "CUSTOM" }),
              }),
              handler: vi.fn(),
            }),
          },
        },
      });
      expect(await client.printFormatted()).toMatchSnapshot();
    });
  });

  describe("Feature #3604: OxFmt support", () => {
    test("should throw if it failed to format", async () => {
      await expect(() =>
        new Integration({
          config: configMock,
          variant: "types",
          brandHandling: {
            CUSTOM: () => ts.factory.createTypeReferenceNode("## WRONG ##"),
          },
          routing: {
            v1: {
              custom: defaultEndpointsFactory.buildVoid({
                method: "post",
                input: z.object({
                  string: z.string().meta({ [brandProperty]: "CUSTOM" }),
                }),
                handler: vi.fn(),
              }),
            },
          },
        }).printFormatted(),
      ).rejects.toThrow(
        new Error("OxFmt failed to format the code", {
          cause: [
            expect.objectContaining({
              codeframe: expect.stringContaining("## WRONG ##"),
            }),
          ],
        }),
      );
    });
  });

  describe("Named types", () => {
    const customer = z.object({ name: z.string() }).meta({ id: "Customer" });
    const booking = z
      .object({ id: z.string(), customer, notes: z.string().optional() })
      .meta({ id: "Booking" });

    test("should declare the schemas having id once and refer them", async () => {
      const client = new Integration({
        config: configMock,
        variant: "types",
        hasHeadMethod: false,
        routing: {
          v1: {
            list: defaultEndpointsFactory.build({
              output: z.object({ items: z.array(booking) }),
              handler: vi.fn(),
            }),
            save: defaultEndpointsFactory.build({
              method: "post",
              input: z.object({ customer }).meta({ id: "SaveBookingRequest" }),
              output: booking,
              handler: vi.fn(),
            }),
          },
        },
      });
      const code = await client.printFormatted();
      expect(code.match(/export type Booking =/g)).toHaveLength(1);
      expect(code).toMatchSnapshot();
    });

    test.each(["input", "output", "both"] as const)(
      "should name the type unless it differs for request and response: %s",
      async (usage) => {
        const draft = z
          .object({ status: z.string().default("new") })
          .meta({ id: "Draft" });
        const client = new Integration({
          config: configMock,
          variant: "types",
          routing: {
            v1: {
              draft: defaultEndpointsFactory.build({
                method: "post",
                input: z.object(usage === "output" ? {} : { draft }),
                output: z.object(usage === "input" ? {} : { draft }),
                handler: vi.fn(),
              }),
            },
          },
        });
        expect(await client.printFormatted()).toMatchSnapshot();
      },
    );

    test.each(["not-valid", "string", "Client", "Response", "PostV1TestInput"])(
      "should not name the type after the unsuitable id %s",
      (id) => {
        const client = new Integration({
          config: configMock,
          variant: "types",
          routing: {
            v1: {
              test: defaultEndpointsFactory.buildVoid({
                method: "post",
                input: z.object({ name: z.string() }).meta({ id }),
                handler: vi.fn(),
              }),
            },
          },
        });
        const code = client.print();
        expect(code).toMatch(/type Type1 = \{\s+name: string;\s+\};/);
        expect(code).toMatch("type PostV1TestInput = Type1;");
      },
    );

    test("should not name the types after the id of different schemas", () => {
      const one = z.object({ a: z.string() }).meta({ id: "Duplicate" });
      const two = z.object({ b: z.string() }).meta({ id: "Duplicate" });
      const client = new Integration({
        config: configMock,
        variant: "types",
        routing: {
          v1: {
            test: defaultEndpointsFactory.build({
              method: "post",
              input: z.object({ one }),
              output: z.object({ two }),
              handler: vi.fn(),
            }),
          },
        },
      });
      const code = client.print();
      expect(code).not.toMatch("Duplicate");
      expect(code).toMatch(/one: Type1;/);
      expect(code).toMatch(/two: Type2;/);
    });

    test.each([
      ["a", "b"],
      ["b", "a"],
    ] as const)(
      "should not depend on the order of endpoints %#",
      (...order) => {
        const draft = z
          .object({ status: z.string().default("new") })
          .meta({ id: "Draft" });
        const endpoints = {
          a: defaultEndpointsFactory.buildVoid({
            method: "post",
            input: z.object({ draft }),
            handler: vi.fn(),
          }),
          b: defaultEndpointsFactory.build({
            output: z.object({ draft }),
            handler: vi.fn(),
          }),
        };
        const client = new Integration({
          config: configMock,
          variant: "types",
          hasHeadMethod: false,
          routing: {
            v1: R.fromPairs(order.map((key) => [key, endpoints[key]])),
          },
        });
        const code = client.print();
        expect(code).not.toMatch("Draft");
        expect(code).toMatch(/draft: Type1;/);
        expect(code).toMatch(/draft: Type2;/);
      },
    );

    test("should name the lazy schema having id", () => {
      const tree: z.ZodType = z
        .lazy(() => z.object({ name: z.string(), kids: z.array(tree) }))
        .meta({ id: "Tree" });
      const client = new Integration({
        config: configMock,
        variant: "types",
        routing: {
          v1: {
            tree: defaultEndpointsFactory.build({
              output: z.object({ tree }),
              handler: vi.fn(),
            }),
          },
        },
      });
      const code = client.print();
      expect(code).toMatch(
        /export type Tree = \{\s+name: string;\s+kids: Tree\[\];\s+\};/,
      );
      expect(code).not.toMatch("Type1");
    });

    test("should name the schemas created on demand in sequence", () => {
      const factory = new EndpointsFactory(
        new ResultHandler({
          positive: (output) =>
            z.object({ data: output }).meta({ id: "Envelope" }),
          negative: z.object({ message: z.string() }),
          handler: vi.fn(),
        }),
      );
      const client = new Integration({
        config: configMock,
        variant: "types",
        hasHeadMethod: false,
        routing: {
          v1: {
            a: factory.build({
              output: z.object({ a: z.string() }),
              handler: vi.fn(),
            }),
            b: factory.build({
              output: z.object({ b: z.string() }),
              handler: vi.fn(),
            }),
          },
        },
      });
      const code = client.print();
      expect(code).not.toMatch("Envelope");
      expect(code).toMatch("type GetV1APositiveVariant1 = Type1;");
      expect(code).toMatch("type GetV1BPositiveVariant1 = Type2;");
    });

    test("should declare the recursive type for each direction when it differs", async () => {
      const node = z.object({
        label: z.string().default("untitled"),
        get children() {
          return z.array(node).optional();
        },
      });
      const client = new Integration({
        config: configMock,
        variant: "types",
        routing: {
          v1: {
            tree: defaultEndpointsFactory.build({
              method: "post",
              input: z.object({ node }),
              output: z.object({ node }),
              handler: vi.fn(),
            }),
          },
        },
      });
      expect(await client.printFormatted()).toMatchSnapshot();
    });

    test("should keep the input type of the endpoint omitting cookies", () => {
      const client = new Integration({
        config: configMock,
        variant: "types",
        routing: {
          v1: {
            "get path": defaultEndpointsFactory
              .addMiddleware({
                security: { type: "cookie", name: "session" },
                handler: vi.fn(),
              })
              .buildVoid({
                input: z.object({ some: z.string() }).meta({ id: "Some" }),
                handler: vi.fn(),
              }),
          },
        },
      });
      expect(client.print()).toMatch(/type GetV1PathInput = Omit<Some,/);
    });
  });

  test("Producer type should be satisfied", () => {
    expectTypeOf(() =>
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
    ).toExtend<Producer>();
  });
});
