import camelize from "camelize-ts";
import snakify from "snakify-ts";
import {
  Documentation,
  DocumentationError,
  EndpointsFactory,
  createConfig,
  Middleware,
  defaultEndpointsFactory,
  ez,
  ResultHandler,
  Overrider,
} from "../src";
import { contentTypes } from "../src/content-type";
import { z } from "zod";
import { givePort } from "../../tools/ports";

describe("Documentation", () => {
  const sampleConfig = createConfig({
    cors: true,
    logger: { level: "silent" },
    http: { listen: givePort() },
  });

  describe("Basic cases", () => {
    test("should generate the correct schema for DELETE request without body", () => {
      const spec = new Documentation({
        routing: {
          v1: {
            deleteSomething: defaultEndpointsFactory.build({
              method: "delete",
              output: z.object({
                whatever: z.number(),
              }),
              handler: async () => ({
                whatever: 42,
              }),
            }),
          },
        },
        config: sampleConfig,
        version: "3.4.5",
        title: "Testing DELETE request without body",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should generate the correct schema for complex types", () => {
      const literalValue = "something" as const;
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              input: z.object({
                array: z.array(z.number().int().positive()).min(1).max(3),
                unlimited: z.array(z.boolean()),
                transformer: z.string().transform((str) => str.length),
              }),
              output: z.object({
                literal: z.literal(literalValue),
                transformation: z.number(),
              }),
              handler: async ({ input }) => ({
                literal: literalValue,
                transformation: input.transformer,
              }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing Complex Types",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should generate the correct schema for nullable and optional types", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              input: z.object({
                optional: z.string().optional(),
                optDefault: z.string().optional().default("test"),
                nullish: z.boolean().nullish(),
                nuDefault: z.number().int().positive().nullish().default(123),
              }),
              output: z.object({
                nullable: z.string().nullable(),
              }),
              handler: async () => ({
                nullable: null,
              }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing Nullable and Optional Types",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should generate the correct schema for intersection type", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "post",
              input: z.object({
                intersection: z.intersection(
                  z.object({
                    one: z.string(),
                  }),
                  z.object({
                    two: z.string(),
                  }),
                ),
              }),
              output: z.object({
                and: z
                  .object({
                    five: z.number().int().gte(0),
                  })
                  .and(
                    z.object({
                      six: z.string(),
                    }),
                  ),
              }),
              handler: async () => ({
                and: {
                  five: 5,
                  six: "six",
                },
              }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing Intersection and And types",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should generate the correct schema for union type", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "post",
              input: z.object({
                union: z.union([
                  z.object({
                    one: z.string(),
                    two: z.number().int().positive(),
                  }),
                  z.object({
                    two: z.number().int().negative(),
                    three: z.string(),
                  }),
                ]),
              }),
              output: z.object({
                or: z.string().or(z.number().int().positive()),
              }),
              handler: async () => ({
                or: 554,
              }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing Union and Or Types",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should generate the correct schema for discriminated union type", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "post",
              input: z.discriminatedUnion("type", [
                z.object({ type: z.literal("a"), a: z.string() }),
                z.object({ type: z.literal("b"), b: z.string() }),
              ]),
              output: z.discriminatedUnion("status", [
                z.object({ status: z.literal("success"), data: z.any() }),
                z.object({
                  status: z.literal("error"),
                  error: z.object({ message: z.string() }),
                }),
              ]),
              handler: async () => ({
                status: "success" as const,
                data: "test",
              }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing Discriminated Union Type",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle transformation schema in output", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "post",
              input: z.object({
                one: z.string(),
                two: z.number().int().positive(),
              }),
              output: z.object({
                transform: z.string().transform((str) => str.length),
              }),
              handler: async () => ({
                transform: "test",
              }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing Transformation in response schema",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle bigint, boolean, date, null and readonly", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "post",
              input: z.object({
                bigint: z.bigint(),
                boolean: z.boolean().readonly(),
                dateIn: ez.dateIn(),
              }),
              output: z.object({
                null: z.null(),
                dateOut: ez.dateOut(),
              }),
              handler: async () => ({
                null: null,
                dateOut: new Date("2021-12-31"),
              }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing additional types",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle record", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "post",
              output: z.object({
                simple: z.record(z.string(), z.int()),
                stringy: z.record(z.string().regex(/[A-Z]+/), z.boolean()),
                numeric: z.record(z.int(), z.boolean()),
                literal: z.record(z.literal("only"), z.boolean()),
                union: z.record(
                  z.literal("option1").or(z.literal("option2")),
                  z.boolean(),
                ),
                enum: z.record(z.enum(["option1", "option2"]), z.boolean()),
              }),
              handler: vi.fn(),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing record",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle type any", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              input: z.object({
                any: z.any(),
              }),
              output: z.object({
                any: z.any(),
              }),
              handler: vi.fn(),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing type any",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle different number types", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "post",
              input: z.object({
                double: z.number(),
                doublePositive: z.number().positive(),
                doubleNegative: z.number().negative(),
                doubleLimited: z.number().min(-0.5).max(0.5),
                int: z.int(),
                intPositive: z.number().int().positive(),
                intNegative: z.number().int().negative(),
                intLimited: z.number().int().min(-100).max(100),
                zero: z.number().int().nonnegative().nonpositive().optional(),
              }),
              output: z.object({
                bigint: z.bigint(),
              }),
              handler: vi.fn(),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing numbers",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle different string types", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "post",
              input: z.object({
                regular: z.string(),
                min: z.string().nonempty(),
                max: z.string().max(15),
                range: z.string().min(2).max(3),
                email: z.email(),
                uuid: z.uuid(),
                cuid: z.cuid(),
                cuid2: z.cuid2(),
                ulid: z.ulid(),
                ip: z.ipv4(),
                emoji: z.emoji(),
                url: z.url(),
                numeric: z.string().regex(/\d+/),
                combined: z
                  .email()
                  .min(1)
                  .regex(/.*@example\.com/is)
                  .max(90),
              }),
              output: z.object({ nonempty: z.string().nonempty() }),
              handler: vi.fn(),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing strings",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle tuples", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "post",
              input: z.object({
                ofOne: z.tuple([z.boolean()]),
                ofStrings: z.tuple([z.string(), z.string().nullable()]),
                complex: z.tuple([
                  z.boolean(),
                  z.string(),
                  z.number().int().positive(),
                ]),
              }),
              output: z.object({
                empty: z.tuple([]),
              }),
              handler: vi.fn(),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing tuples",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle enum types", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "post",
              input: z.object({
                regularEnum: z.enum(["ABC", "DEF"]),
              }),
              output: z.object({
                nativeEnum: z.enum({ FEG: 1, XYZ: 2 }),
              }),
              handler: async () => ({
                nativeEnum: 1 as const,
              }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing enums",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle z.preprocess()", () => {
      const string = z.preprocess((arg) => String(arg), z.string());
      const number = z.preprocess(
        (arg) => parseInt(String(arg), 16),
        z.number().int().nonnegative(),
      );
      const boolean = z.preprocess((arg) => !!arg, z.boolean());
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              input: z.object({ string, number }),
              output: z.object({ boolean }),
              handler: async () => ({ boolean: [] }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing z.preprocess()",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
      expect(string.parse(123)).toBe("123");
      expect(number.parse("0xFF")).toBe(255);
      expect(boolean.parse([])).toBe(true);
      expect(boolean.parse("")).toBe(false);
      expect(boolean.parse(null)).toBe(false);
    });

    // @todo switch to z.interface for that
    test("should handle circular schemas via z.lazy()", () => {
      const category: z.ZodObject = z.object({
        name: z.string(),
        subcategories: z.lazy(() => category.array()),
      });
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "post",
              output: z.object({
                zodExample: category,
              }),
              handler: async () => ({
                zodExample: {
                  name: "People",
                  subcategories: [
                    {
                      name: "Politicians",
                      subcategories: [
                        { name: "Presidents", subcategories: [] },
                      ],
                    },
                  ],
                },
              }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing Lazy",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should ensure uniq security schema names", () => {
      const mw1 = new Middleware({
        security: {
          or: [{ type: "input", name: "key" }, { type: "bearer" }],
        },
        input: z.object({
          key: z.string(),
        }),
        handler: vi.fn<any>(),
      });
      const mw2 = new Middleware({
        security: {
          and: [
            { type: "bearer" },
            {
              type: "oauth2",
              flows: {
                password: {
                  tokenUrl: "https://some.url",
                  scopes: { read: "read something", write: "write something" },
                },
              },
            },
          ],
        },
        handler: vi.fn<any>(),
      });
      const mw3 = new Middleware({
        security: { type: "bearer", format: "JWT" },
        handler: vi.fn<any>(),
      });
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.addMiddleware(mw1).build({
              scope: "this should be omitted",
              input: z.object({
                str: z.string(),
              }),
              output: z.object({
                num: z.number(),
              }),
              handler: async () => ({ num: 123 }),
            }),
            setSomething: defaultEndpointsFactory.addMiddleware(mw2).build({
              scope: "write",
              method: "post",
              output: z.object({}),
              handler: async () => ({}),
            }),
            updateSomething: defaultEndpointsFactory.addMiddleware(mw3).build({
              scope: "this should be omitted",
              method: "put",
              output: z.object({}),
              handler: async () => ({}),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing Security",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should ensure the uniq operation ids", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSome: {
              thing: defaultEndpointsFactory.build({
                description: "thing is the path segment",
                shortDescription: "operationIdEndpoint",
                output: z.object({}),
                handler: async () => ({}),
              }),
              ":thing": defaultEndpointsFactory.build({
                description: "thing is the path parameter",
                output: z.object({}),
                handler: async () => ({}),
              }),
            },
          },
        },
        version: "3.4.5",
        title: "Testing Operation IDs",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should be able to specify operation", () => {
      const operationId = "coolOperationId";
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSome: {
              thing: defaultEndpointsFactory.build({
                description: "thing is the path segment",
                operationId,
                output: z.object({}),
                handler: async () => ({}),
              }),
            },
          },
        },
        version: "3.4.5",
        title: "Testing Operation IDs",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toContain(operationId);
      expect(spec).toMatchSnapshot();
    });

    test("should be able to specify the operationId provider depending on method", () => {
      const operationId = "CoolOperationId";
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSome: {
              thing: defaultEndpointsFactory.build({
                description: "thing is the path segment",
                method: ["get", "post"],
                operationId: (method) => `${method}${operationId}`,
                output: z.object({}),
                handler: async () => ({}),
              }),
            },
          },
        },
        version: "3.4.5",
        title: "Testing Operation IDs",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toContain(operationId);
      expect(spec).toMatchSnapshot();
    });

    test("should not be able to specify duplicated operation", () => {
      const operationId = "coolOperationId";
      const expectedError = new DocumentationError(
        'Duplicated operationId: "coolOperationId"',
        {
          isResponse: false,
          method: "get",
          path: "/v1/getSomeTwo/thing",
        },
      );
      expect(
        () =>
          new Documentation({
            config: sampleConfig,
            routing: {
              v1: {
                getSome: {
                  thing: defaultEndpointsFactory.build({
                    description: "thing is the path segment",
                    operationId,
                    output: z.object({}),
                    handler: async () => ({}),
                  }),
                },
                getSomeTwo: {
                  thing: defaultEndpointsFactory.build({
                    description: "thing is the path segment",
                    operationId,
                    output: z.object({}),
                    handler: async () => ({}),
                  }),
                },
              },
            },
            version: "3.4.5",
            title: "Testing Operation IDs",
            serverUrl: "https://example.com",
          }),
      ).toThrow(expectedError);
    });

    test("should handle custom mime types and status codes", () => {
      const resultHandler = new ResultHandler({
        positive: (result) => ({
          schema: z.object({ status: z.literal("OK"), result }),
          mimeType: [contentTypes.json, "text/vnd.yaml"],
          statusCode: 201,
        }),
        negative: {
          schema: z.object({ status: z.literal("NOT OK") }),
          mimeType: "text/vnd.yaml",
          statusCode: 403,
        },
        handler: () => {},
      });
      const factory = new EndpointsFactory(resultHandler);
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: factory.build({
              output: z.object({}),
              handler: async () => ({}),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing MIME types and status codes",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });
  });

  describe("Issue #98", () => {
    test("Should describe non-empty array", () => {
      // There is no such class as ZodNonEmptyArray in Zod v3.7.0+
      // It existed though in Zod v3.6.x:
      // @see https://github.com/colinhacks/zod/blob/v3.6.1/src/types.ts#L1204
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: ["get", "post"],
              input: z.object({ arr: z.array(z.string()).nonempty() }),
              output: z.object({ arr: z.array(z.string()).nonempty() }),
              handler: async ({ input }) => ({ arr: input.arr }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing issue #98",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should union schemas", () => {
      const baseSchema = z.object({ id: z.string() });
      const subType1 = baseSchema.extend({ field1: z.string() });
      const subType2 = baseSchema.extend({ field2: z.string() });
      const unionSchema = z.union([subType1, subType2]);
      type TestingType = z.infer<typeof unionSchema>;

      expectTypeOf<{ id: string; field1: string }>().toExtend<TestingType>();
      expectTypeOf<{ id: string; field2: string }>().toExtend<TestingType>();

      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "post",
              input: unionSchema,
              output: unionSchema,
              handler: async ({ input }) => {
                if ("field1" in input) {
                  return {
                    id: `test, ${input.id}`,
                    field1: input.field1,
                  };
                }
                return {
                  id: "other test",
                  field2: input.field2,
                };
              },
            }),
          },
        },
        version: "3.4.5",
        title: "Testing issue #98",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });
  });

  describe("Route Path Params", () => {
    test("should handle route path params for POST request", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            ":name": defaultEndpointsFactory.build({
              method: "post",
              input: z.object({
                name: z.literal("John").or(z.literal("Jane")),
                other: z.boolean(),
              }),
              output: z.object({}),
              handler: vi.fn(),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing route path params",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test.each(["inline", "components"] as const)(
      "should handle custom descriptions and descriptors %#",
      (composition) => {
        const spec = new Documentation({
          composition,
          config: sampleConfig,
          descriptions: {
            requestBody: () => "the body of request",
            requestParameter: ({ method, path }) =>
              `parameter of ${method} ${path}`,
            negativeResponse: ({ operationId }) =>
              `very negative response of ${operationId}`,
            positiveResponse: ({ path }) =>
              `Super positive response of ${path}`,
          },
          routing: {
            v1: {
              ":name": defaultEndpointsFactory.build({
                method: "post",
                input: z.object({
                  name: z.literal("John").or(z.literal("Jane")),
                  other: z.boolean(),
                }),
                output: z.object({}),
                handler: vi.fn(),
              }),
            },
          },
          version: "3.4.5",
          title: "Testing route path params",
          serverUrl: "https://example.com",
        }).getSpecAsYaml();
        expect(spec).toMatchSnapshot();
      },
    );

    test("should handle route path params for GET request", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            ":name": defaultEndpointsFactory.build({
              input: z.object({
                name: z.literal("John").or(z.literal("Jane")),
                other: z.boolean(),
              }),
              output: z.object({}),
              handler: vi.fn(),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing route path params",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });
  });

  describe("Feature 1180: Headers opt-in params", () => {
    const specificConfig = createConfig({
      ...sampleConfig,
      inputSources: {
        get: ["query", "params", "headers"],
        post: ["body", "query", "params", "headers"],
        put: ["body", "headers"], // query is not enabled
      },
    });

    test.each(["get", "post", "put"] as const)(
      "should describe x- inputs as header params in %s request",
      (method) => {
        const spec = new Documentation({
          config: specificConfig,
          routing: {
            v1: {
              test: defaultEndpointsFactory.build({
                method,
                input: z.object({
                  id: z.string(),
                  "x-request-id": z.string(),
                }),
                output: z.object({}),
                handler: vi.fn(),
              }),
            },
          },
          version: "3.4.5",
          title: "Testing headers params",
          serverUrl: "https://example.com",
        }).getSpecAsYaml();
        expect(spec).toMatchSnapshot();
      },
    );
  });

  describe("Feature #1431: Multiple schemas for different status codes", () => {
    test("should depict accordingly", () => {
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
      expect(
        new Documentation({
          version: "3.4.5",
          title: "Testing multiple schemas for different status codes",
          serverUrl: "https://example.com",
          config: sampleConfig,
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
        }).getSpecAsYaml(),
      ).toMatchSnapshot();
    });
  });

  describe("Metadata", () => {
    test("should pass over the schema description", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              input: z.object({
                str: z.string().describe("here is the test"),
              }),
              output: z.object({
                result: z
                  .number()
                  .int()
                  .positive()
                  .describe("some positive integer"),
              }),
              handler: async () => ({ result: 123 }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing Metadata:description",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("Feature #2390: should support deprecations", () => {
      const endpoint = defaultEndpointsFactory.build({
        input: z.object({
          str: z.string().deprecated(),
        }),
        output: z.object({}),
        handler: vi.fn(),
      });
      const spec = new Documentation({
        config: sampleConfig,
        routing: { v1: { getSomething: endpoint.deprecated() } },
        version: "3.4.5",
        title: "Testing Metadata:deprecations",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("Issue #929: the location of the custom description should be on the param level", () => {
      const spec = new Documentation({
        composition: "components",
        config: sampleConfig,
        routing: {
          hris: {
            employees: defaultEndpointsFactory.build({
              input: z.object({
                cursor: z
                  .string()
                  .optional()
                  .describe(
                    "An optional cursor string used for pagination." +
                      " This can be retrieved from the `next` property of the previous page response.",
                  ),
              }),
              output: z.object({}),
              handler: async () => ({}),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing Metadata:description",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should pass over the example of an individual parameter", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              input: z.object({
                strNum: z
                  .string()
                  .transform((v) => parseInt(v, 10))
                  .example("123"), // example is for input side of the transformation
              }),
              output: z.object({
                numericStr: z
                  .number()
                  .transform((v) => `${v}`)
                  .example(123), // example is for input side of the transformation
              }),
              handler: async () => ({ numericStr: 123 }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing Metadata:example on IO parameter",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should pass over examples of each param from the whole IO schema examples (GET)", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              input: z
                .object({
                  strNum: z.string().transform((v) => parseInt(v, 10)),
                })
                .example({
                  strNum: "123", // example is for input side of the transformation
                }),
              output: z
                .object({
                  numericStr: z.number().transform((v) => `${v}`),
                })
                .example({
                  numericStr: 123, // example is for input side of the transformation
                }),
              handler: async () => ({ numericStr: 123 }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing Metadata:example on IO schema",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should pass over examples of the whole IO schema (POST)", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "post",
              input: z
                .object({
                  strNum: z.string().transform((v) => parseInt(v, 10)),
                })
                .example({
                  strNum: "123", // example is for input side of the transformation
                }),
              output: z
                .object({
                  numericStr: z.number().transform((v) => `${v}`),
                })
                .example({
                  numericStr: 123, // example is for input side of the transformation
                }),
              handler: async () => ({ numericStr: 123 }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing Metadata:example on IO schema",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should merge endpoint handler examples with its middleware examples", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory
              .addMiddleware({
                input: z
                  .object({ key: z.string() })
                  .example({ key: "1234-56789-01" }),
                handler: vi.fn(),
              })
              .build({
                method: "post",
                input: z.object({ str: z.string() }).example({ str: "test" }),
                output: z.object({ num: z.number() }).example({ num: 123 }),
                handler: async () => ({ num: 123 }),
              }),
          },
        },
        version: "3.4.5",
        title: "Testing Metadata:example on IO schema + middleware",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("Issue #827: .example() should be immutable", () => {
      const zodSchema = z.object({ a: z.string() });
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            addSomething: defaultEndpointsFactory.build({
              method: "post",
              input: zodSchema.example({ a: "first" }),
              output: zodSchema
                .extend({ b: z.string() })
                .example({ a: "first", b: "prefix_first" })
                .example({ a: "second", b: "prefix_second" }),
              handler: async ({ input: { a } }) => ({ a, b: `prefix_${a}` }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing Metadata:example on IO parameter",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });
  });

  describe("Feature #1470: Custom brands", () => {
    test("should be handled accordingly in request, response and params", () => {
      const deep = Symbol("DEEP");
      const rule: Overrider = ({ jsonSchema }) => (jsonSchema.type = "boolean");
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            ":name": defaultEndpointsFactory.build({
              input: z.object({
                name: z.string().brand("CUSTOM"),
                other: z.boolean().brand("CUSTOM"),
                regular: z.boolean().brand(deep),
              }),
              output: z.object({
                number: z.number().brand("CUSTOM"),
              }),
              handler: vi.fn(),
            }),
          },
        },
        brandHandling: {
          CUSTOM: ({ jsonSchema }) => (jsonSchema.summary = "My custom schema"),
          [deep]: rule,
        },
        version: "3.4.5",
        title: "Testing custom brands handling",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });
  });

  describe("Feature #1869: Top level transformations", () => {
    test("should handle object-to-object functional transformations and mapping", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            test: defaultEndpointsFactory.build({
              input: z
                .object({ user_id: z.string() })
                .transform((inputs) => camelize(inputs, true)),
              output: z
                .object({ userName: z.string() })
                .remap((outputs) => snakify(outputs, true)),
              handler: async ({ input: { userId } }) => ({
                userName: `User ${userId}`,
              }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing top level transformations",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle explicit renaming", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            test: defaultEndpointsFactory.build({
              input: z
                .object({ user_id: z.string(), at: ez.dateIn() })
                .remap({ user_id: "userId" }), // partial mapping
              output: z
                .object({ userName: z.string() })
                .remap({ userName: "user_name" }),
              handler: async ({ input: { userId, at } }) => ({
                userName: `User ${userId} ${at}`,
              }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing top level transformations",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });
  });
});
