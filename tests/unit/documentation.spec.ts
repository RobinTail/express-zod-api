import { config as exampleConfig } from "../../example/config";
import { routing } from "../../example/routing";
import {
  Documentation,
  DocumentationError,
  EndpointsFactory,
  createConfig,
  createMiddleware,
  createResultHandler,
  defaultEndpointsFactory,
  ez,
  withMeta,
} from "../../src";
import { expectType } from "tsd";
import { mimeJson } from "../../src/mime";
import { z } from "zod";
import { givePort } from "../helpers";

describe("Documentation generator", () => {
  const sampleConfig = createConfig({
    cors: true,
    logger: { level: "debug", color: true },
    server: { listen: givePort() },
  });

  describe("getSpecAsYaml()", () => {
    test.each([
      { composition: "inline" },
      { composition: "components" },
    ] as const)(
      "should generate the correct schema of example routing %#",
      ({ composition }) => {
        const spec = new Documentation({
          routing,
          config: exampleConfig,
          version: "1.2.3",
          title: "Example API",
          serverUrl: "https://example.com",
          composition,
        }).getSpecAsYaml();
        expect(spec).toMatchSnapshot();
      },
    );

    test("should generate the correct schema for DELETE request without body", () => {
      const spec = new Documentation({
        routing: {
          v1: {
            deleteSomething: defaultEndpointsFactory.build({
              methods: ["delete"],
              input: z.object({}),
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
              methods: ["get"],
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
              methods: ["get"],
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
              methods: ["post"],
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
              methods: ["post"],
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
              methods: ["post"],
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
              methods: ["post"],
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
              input: z.object({}),
              output: z.object({
                simple: z.record(z.number().int()),
                stringy: z.record(z.string().regex(/[A-Z]+/), z.boolean()),
                numeric: z.record(z.number().int(), z.boolean()),
                literal: z.record(z.literal("only"), z.boolean()),
                union: z.record(
                  z.literal("option1").or(z.literal("option2")),
                  z.boolean(),
                ),
                enum: z.record(z.enum(["option1", "option2"]), z.boolean()),
              }),
              handler: jest.fn(),
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
              method: "get",
              input: z.object({
                any: z.any(),
              }),
              output: z.object({
                any: z.any(),
              }),
              handler: jest.fn(),
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
                int: z.number().int(),
                intPositive: z.number().int().positive(),
                intNegative: z.number().int().negative(),
                intLimited: z.number().int().min(-100).max(100),
                zero: z.number().int().nonnegative().nonpositive().optional(),
              }),
              output: z.object({
                bigint: z.bigint(),
              }),
              handler: jest.fn(),
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
                min: z.string().min(1),
                max: z.string().max(15),
                range: z.string().min(2).max(3),
                email: z.string().email(),
                uuid: z.string().uuid(),
                cuid: z.string().cuid(),
                cuid2: z.string().cuid2(),
                ulid: z.string().ulid(),
                ip: z.string().ip(),
                emoji: z.string().emoji(),
                url: z.string().url(),
                numeric: z.string().regex(/\d+/),
                combined: z
                  .string()
                  .min(1)
                  .email()
                  .regex(/.*@example\.com/is)
                  .max(90),
              }),
              output: z.object({
                nonempty: z.string().min(1),
              }),
              handler: jest.fn(),
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
              handler: jest.fn(),
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
                nativeEnum: z.nativeEnum({ FEG: 1, XYZ: 2 }),
              }),
              handler: async () => ({
                nativeEnum: 1,
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
              method: "get",
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

    test("should handle circular schemas via z.lazy()", () => {
      const baseCategorySchema = z.object({
        name: z.string(),
      });
      type Category = z.infer<typeof baseCategorySchema> & {
        subcategories: Category[];
      };
      const categorySchema: z.ZodType<Category> = baseCategorySchema.extend({
        subcategories: z.lazy(() => categorySchema.array()),
      });
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "post",
              input: baseCategorySchema,
              output: z.object({
                zodExample: categorySchema,
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

    test("should throw on unsupported types", () => {
      [
        z.undefined(),
        z.map(z.any(), z.any()),
        z.function(),
        z.promise(z.any()),
        z.unknown(),
        z.never(),
        z.void(),
      ].forEach((zodType) => {
        expect(
          () =>
            new Documentation({
              config: sampleConfig,
              routing: {
                v1: {
                  getSomething: defaultEndpointsFactory.build({
                    method: "post",
                    input: z.object({
                      property: zodType,
                    }),
                    output: z.object({}),
                    handler: async () => ({}),
                  }),
                },
              },
              version: "3.4.5",
              title: "Testing unsupported types",
              serverUrl: "https://example.com",
            }),
        ).toThrow(
          new DocumentationError({
            method: "post",
            path: "/v1/getSomething",
            isResponse: false,
            message: `Zod type ${zodType._def.typeName} is unsupported.`,
          }),
        );
      });
    });

    test("should ensure uniq security schema names", () => {
      const mw1 = createMiddleware({
        security: {
          or: [{ type: "input", name: "key" }, { type: "bearer" }],
        },
        input: z.object({
          key: z.string(),
        }),
        middleware: jest.fn(),
      });
      const mw2 = createMiddleware({
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
        input: z.object({}),
        middleware: jest.fn(),
      });
      const mw3 = createMiddleware({
        security: { type: "bearer", format: "JWT" },
        input: z.object({}),
        middleware: jest.fn(),
      });
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.addMiddleware(mw1).build({
              scopes: ["this should be omitted"],
              method: "get",
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
              input: z.object({}),
              output: z.object({}),
              handler: async () => ({}),
            }),
            updateSomething: defaultEndpointsFactory.addMiddleware(mw3).build({
              scopes: ["this should be omitted"],
              method: "put",
              input: z.object({}),
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
                method: "get",
                input: z.object({}),
                output: z.object({}),
                handler: async () => ({}),
              }),
              ":thing": defaultEndpointsFactory.build({
                description: "thing is the path parameter",
                method: "get",
                input: z.object({}),
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
                method: "get",
                operationId,
                input: z.object({}),
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
                methods: ["get", "post"],
                operationId: (method) => `${method}${operationId}`,
                input: z.object({}),
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
      const expectedError = new DocumentationError({
        message: 'Duplicated operationId: "coolOperationId"',
        isResponse: false,
        method: "get",
        path: "/v1/getSomeTwo/thing",
      });
      expect(() => {
        new Documentation({
          config: sampleConfig,
          routing: {
            v1: {
              getSome: {
                thing: defaultEndpointsFactory.build({
                  description: "thing is the path segment",
                  method: "get",
                  operationId,
                  input: z.object({}),
                  output: z.object({}),
                  handler: async () => ({}),
                }),
              },
              getSomeTwo: {
                thing: defaultEndpointsFactory.build({
                  description: "thing is the path segment",
                  method: "get",
                  operationId,
                  input: z.object({}),
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
      }).toThrow(expectedError);
    });

    test("should handle custom mime types and status codes", () => {
      const resultHandler = createResultHandler({
        getPositiveResponse: (output) => ({
          schema: z.object({ status: z.literal("OK"), result: output }),
          mimeTypes: [mimeJson, "text/vnd.yaml"],
          statusCode: 201,
        }),
        getNegativeResponse: () => ({
          schema: z.object({ status: z.literal("NOT OK") }),
          mimeType: "text/vnd.yaml",
          statusCode: 403,
        }),
        handler: () => {},
      });
      const factory = new EndpointsFactory(resultHandler);
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: factory.build({
              method: "get",
              input: z.object({}),
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
              methods: ["get", "post"],
              input: z.object({
                arr: z.array(z.string()).min(1),
              }),
              output: z.object({
                arr: z.array(z.string()).min(1),
              }),
              handler: async ({ input }) => ({
                arr: input.arr,
              }),
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

      expectType<TestingType>({ id: "string", field1: "string" });
      expectType<TestingType>({ id: "string", field2: "string" });

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
              handler: jest.fn(),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing route path params",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle route path params for GET request", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            ":name": defaultEndpointsFactory.build({
              method: "get",
              input: z.object({
                name: z.literal("John").or(z.literal("Jane")),
                other: z.boolean(),
              }),
              output: z.object({}),
              handler: jest.fn(),
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
      inputSources: { get: ["query", "params", "headers"] },
    });

    test("should describe x- inputs as header params", () => {
      const spec = new Documentation({
        config: specificConfig,
        routing: {
          v1: {
            test: defaultEndpointsFactory.build({
              method: "get",
              input: z.object({
                id: z.string(),
                "x-request-id": z.string(),
              }),
              output: z.object({}),
              handler: jest.fn(),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing headers params",
        serverUrl: "https://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });
  });

  describe("Metadata", () => {
    test("should pass over the schema description", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "get",
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

    test("Issue #929: the location of the custom description should be on the param level", () => {
      const spec = new Documentation({
        composition: "components",
        config: sampleConfig,
        routing: {
          hris: {
            employees: defaultEndpointsFactory.build({
              method: "get",
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
              method: "get",
              input: z.object({
                strNum: withMeta(
                  z.string().transform((v) => parseInt(v, 10)),
                ).example("123"), // example is for input side of the transformation
              }),
              output: z.object({
                numericStr: withMeta(
                  z.number().transform((v) => `${v}`),
                ).example(123), // example is for input side of the transformation
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
              method: "get",
              input: withMeta(
                z.object({
                  strNum: z.string().transform((v) => parseInt(v, 10)),
                }),
              ).example({
                strNum: "123", // example is for input side of the transformation
              }),
              output: withMeta(
                z.object({
                  numericStr: z.number().transform((v) => `${v}`),
                }),
              ).example({
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
              input: withMeta(
                z.object({
                  strNum: z.string().transform((v) => parseInt(v, 10)),
                }),
              ).example({
                strNum: "123", // example is for input side of the transformation
              }),
              output: withMeta(
                z.object({
                  numericStr: z.number().transform((v) => `${v}`),
                }),
              ).example({
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
              .addMiddleware(
                createMiddleware({
                  input: withMeta(
                    z.object({
                      key: z.string(),
                    }),
                  ).example({
                    key: "1234-56789-01",
                  }),
                  middleware: jest.fn(),
                }),
              )
              .build({
                method: "post",
                input: withMeta(
                  z.object({
                    str: z.string(),
                  }),
                ).example({
                  str: "test",
                }),
                output: withMeta(
                  z.object({
                    num: z.number(),
                  }),
                ).example({
                  num: 123,
                }),
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

    test("Issue #827: withMeta() should be immutable", () => {
      const zodSchema = z.object({ a: z.string() });
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            addSomething: defaultEndpointsFactory.build({
              method: "post",
              input: withMeta(zodSchema).example({ a: "first" }),
              output: withMeta(zodSchema.extend({ b: z.string() }))
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
});
