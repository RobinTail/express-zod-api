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
  type Depicter,
  type Method,
} from "../src";
import { contentTypes } from "../src/content-type";
import { z } from "zod";
import { givePort } from "../../tools/ports";
import * as R from "ramda";
import { brandProperty } from "../src/metadata";

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
        hasHeadMethod: false,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              input: z.object({
                array: z.array(z.int().positive()).min(1).max(3),
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
                nuDefault: z.int().positive().nullish().default(123),
                labeledDate: z.iso
                  .datetime()
                  .default(() => new Date().toISOString())
                  .meta({ default: "Today" }), // Feature #1706
              }),
              output: z.object({
                nullable: z.string().nullable(),
                literal: z.literal("test").nullable(),
                multiliteral: z.literal(["one", "two"]).nullable(),
                enum: z.enum(["test"]).nullable(),
              }),
              handler: async () => ({
                nullable: null,
                literal: "test" as const,
                multiliteral: "one" as const,
                enum: "test" as const,
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
                  z.object({ one: z.string() }),
                  z.object({ two: z.string() }),
                ),
              }),
              output: z.object({
                and: z
                  .object({ five: z.int().gte(0) })
                  .and(z.object({ six: z.string() })),
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
                  z.object({ one: z.string(), two: z.int().positive() }),
                  z.object({ two: z.int().negative(), three: z.string() }),
                ]),
              }),
              output: z.object({ or: z.string().or(z.int().positive()) }),
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
              input: z.object({ one: z.string(), two: z.int().positive() }),
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
                buffer: ez.buffer(),
                based: z.base64(),
              }),
              handler: async () => ({
                null: null,
                dateOut: new Date("2021-12-31"),
                buffer: Buffer.from("test"),
                based: btoa("test"),
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
                intPositive: z.int().positive(),
                intNegative: z.int().negative(),
                intLimited: z.int().min(-100).max(100),
                zero: z.int().nonnegative().nonpositive().optional(),
                coercedNum: z.coerce.number(), // required prop in zod 4
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
                complex: z.tuple([z.boolean(), z.string(), z.int().positive()]),
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
        z.int().nonnegative(),
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

    test("should handle circular schemas via z.object()", () => {
      const category = z.object({
        name: z.string(),
        get subcategories() {
          return z.array(category);
        },
      });
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "post",
              input: category,
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
        handler: vi.fn(),
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
        handler: vi.fn(),
      });
      const mw3 = new Middleware({
        security: { type: "bearer", format: "JWT" },
        handler: vi.fn(),
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

    test("should handle CookieSecurity in params and security section", () => {
      const mw = new Middleware({
        security: { type: "cookie", name: "session" },
        handler: vi.fn(),
      });
      const spec = new Documentation({
        config: createConfig({
          cors: true,
          inputSources: { get: ["query", "cookies"] },
        }),
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.addMiddleware(mw).buildVoid({
              input: z.object({
                session: z.string(),
                page: z.number(),
              }),
              handler: vi.fn(),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing CookieSecurity",
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
                summary: "operationIdEndpoint",
                output: z.object({}),
                handler: async () => ({}),
              }),
              ":thing": defaultEndpointsFactory.build({
                description: "thing is the path parameter",
                input: z.object({
                  thing: z.string(),
                }),
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
                name: z
                  .literal("John")
                  .or(z.literal("Jane"))
                  .meta({ id: "NameParam" }),
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

  describe("Issue #3579: Cross-method normalized path duplicates", () => {
    test.each([
      [
        ["get /users/:id", "delete /users/:userId"],
        'the normalized path "/users/:1" is already registered with different parameter names at "/users/:id"',
      ],
      [
        ["get /a/:x/b/:y", "post /a/:u/b/:v"],
        'the normalized path "/a/:1/b/:2" is already registered with different parameter names at "/a/:x/b/:y"',
      ],
    ])(
      "Should detect duplicate normalized paths across methods %#",
      (paths, expectedMessageSubstring) => {
        const fn = () =>
          new Documentation({
            title: "Issue 3579",
            version: "1.0.0",
            serverUrl: "https://example.com",
            config: sampleConfig,
            routing: paths.reduce(
              (agg, path) => ({
                ...agg,
                [path]: defaultEndpointsFactory.buildVoid({
                  input: z.object({
                    id: z.string(),
                    userId: z.string(),
                    x: z.string(),
                    y: z.string(),
                    u: z.string(),
                    v: z.string(),
                  }),
                  handler: vi.fn(),
                }),
              }),
              {},
            ),
          });
        expect(fn).toThrow(DocumentationError);
        expect(fn).toThrow(expectedMessageSubstring);
      },
    );

    test.each([
      [["get /v1/users", "delete /v1/users"]],
      [["get /v1/user/:id", "delete /v1/user/:id"]],
    ])("Should allow same path with different methods %#", (paths) => {
      const fn = () =>
        new Documentation({
          title: "Issue 3579",
          version: "1.0.0",
          serverUrl: "https://example.com",
          config: sampleConfig,
          routing: paths.reduce(
            (agg, path) => ({
              ...agg,
              [path]: defaultEndpointsFactory.buildVoid({
                input: z.object({ id: z.string() }),
                handler: vi.fn(),
              }),
            }),
            {},
          ),
        });
      expect(fn).not.toThrow();
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
          str: z.string().meta({ deprecated: true }),
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

    test.each<Method>(["get", "post"])(
      "should pass over the example of an individual prop in %s request",
      (method) => {
        const spec = new Documentation({
          config: sampleConfig,
          routing: {
            v1: {
              getSomething: defaultEndpointsFactory.build({
                method,
                input: z.object({
                  strNum: z
                    .string()
                    .meta({ examples: ["123"] }) // example for the input side of the transformation
                    .transform((v) => parseInt(v, 10)),
                }),
                output: z.object({
                  numericStr: z
                    .number()
                    .transform((v) => `${v}`)
                    .meta({ examples: ["456"] }), // example for the output side of the transformation
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
      },
    );

    test.each<Method>(["get", "post"])(
      "should pass over examples of each param from the whole IO schema examples (%s method)",
      (method) => {
        const spec = new Documentation({
          config: sampleConfig,
          routing: {
            v1: {
              getSomething: defaultEndpointsFactory.build({
                method,
                input: z
                  .object({ strNum: z.string() })
                  .meta({ examples: [{ strNum: "123" }] }) // example is for input side of the transformation
                  .transform(R.mapObjIndexed(Number)),
                output: z
                  .object({
                    numericStr: z.number().transform((v) => `${v}`),
                  })
                  .meta({ examples: [{ numericStr: "123" }] }), // example is for output side of the transformation
                handler: async () => ({ numericStr: 123 }),
              }),
            },
          },
          version: "3.4.5",
          title: "Testing Metadata:example on IO schema",
          serverUrl: "https://example.com",
        }).getSpecAsYaml();
        expect(spec).toMatchSnapshot();
      },
    );

    test("should merge endpoint handler examples with its middleware examples", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory
              .addMiddleware({
                input: z
                  .object({ key: z.string() })
                  .meta({ examples: [{ key: "1234-56789-01" }] }),
                handler: vi.fn(),
              })
              .build({
                method: "post",
                input: z
                  .object({ str: z.string() })
                  .meta({ examples: [{ str: "test" }] }),
                output: z
                  .object({ num: z.number() })
                  .meta({ examples: [{ num: 123 }] }),
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

    test("should merge prop examples with middlewares", () => {
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory
              .addMiddleware({
                input: z.object({
                  key: z.string().meta({ examples: ["1234-56789-01"] }),
                }),
                handler: vi.fn(),
              })
              .build({
                method: "post",
                input: z.object({
                  str: z.string().meta({ examples: ["test"] }),
                }),
                output: z.object({ num: z.number().meta({ examples: [123] }) }),
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
              input: zodSchema.meta({ examples: [{ a: "first" }] }),
              output: zodSchema.extend({ b: z.string() }).meta({
                examples: [
                  { a: "first", b: "prefix_first" },
                  { a: "second", b: "prefix_second" },
                ],
              }),
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
      const rule: Depicter = ({ jsonSchema }) => jsonSchema;
      const spec = new Documentation({
        config: sampleConfig,
        routing: {
          v1: {
            ":name": defaultEndpointsFactory.build({
              input: z.object({
                name: z.string().meta({ [brandProperty]: "CUSTOM" }),
                other: z.boolean().meta({ [brandProperty]: "CUSTOM" }),
                regular: z.boolean().meta({ [brandProperty]: deep }),
              }),
              output: z.object({
                number: z.number().meta({ [brandProperty]: "CUSTOM" }),
              }),
              handler: vi.fn(),
            }),
          },
        },
        brandHandling: {
          CUSTOM: () => ({
            summary: "My custom schema",
          }),
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
                .transform((outputs) => snakify(outputs, true))
                .pipe(z.object({ user_name: z.string() })), // zod plugin's remap emulation
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
                .transform(({ user_id: userId, ...rest }) => ({
                  ...rest,
                  userId, // partial mapping
                }))
                .pipe(z.object({ userId: z.string(), at: z.date() })),
              output: z
                .object({ userName: z.string() })
                .transform(({ userName: user_name }) => ({ user_name }))
                .pipe(z.object({ user_name: z.string() })),
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

  describe("Issue #3570: component deduplication with meta id", () => {
    const commons = {
      config: sampleConfig,
      title: "Issue 3570",
      version: "1.0.0",
      serverUrl: "http://localhost:8090",
      composition: "components" as const,
    };

    test("same schema reused as output across two endpoints should produce one component", () => {
      const item = z
        .object({ id: z.uuid(), name: z.string() })
        .meta({ id: "Item" });
      const spec = new Documentation({
        routing: {
          "get /a": defaultEndpointsFactory.build({
            input: z.object({}),
            output: item,
            handler: vi.fn(),
          }),
          "get /b": defaultEndpointsFactory.build({
            input: z.object({}),
            output: item,
            handler: vi.fn(),
          }),
        },
        ...commons,
      }).getSpec();
      const schemas = spec.components?.schemas ?? {};
      const itemKeys = Object.keys(schemas).filter((name) =>
        name.startsWith("Item"),
      );
      expect(itemKeys).toEqual(["Item"]);
    });

    test("same schema as input and output of one endpoint should produce one component", () => {
      const item = z
        .object({ id: z.uuid(), name: z.string() })
        .meta({ id: "Item" });
      const spec = new Documentation({
        routing: {
          "post /a": defaultEndpointsFactory.build({
            method: "post",
            input: item,
            output: item,
            handler: vi.fn(),
          }),
        },
        ...commons,
      }).getSpec();
      const schemas = spec.components?.schemas ?? {};
      const itemKeys = Object.keys(schemas).filter((name) =>
        name.startsWith("Item"),
      );
      expect(itemKeys).toEqual(["Item"]);
    });

    test("multiple distinct meta ids should each appear once when reused", () => {
      const itemA = z
        .object({ id: z.uuid(), name: z.string() })
        .meta({ id: "ItemA" });
      const itemB = z
        .object({ id: z.uuid(), name: z.string() })
        .meta({ id: "ItemB" });
      const spec = new Documentation({
        routing: {
          "get /a": defaultEndpointsFactory.build({
            input: z.object({}),
            output: itemA,
            handler: vi.fn(),
          }),
          "get /b": defaultEndpointsFactory.build({
            input: z.object({}),
            output: itemA,
            handler: vi.fn(),
          }),
          "get /c": defaultEndpointsFactory.build({
            input: z.object({}),
            output: itemB,
            handler: vi.fn(),
          }),
          "get /d": defaultEndpointsFactory.build({
            input: z.object({}),
            output: itemB,
            handler: vi.fn(),
          }),
        },
        ...commons,
      }).getSpec();
      const schemas = spec.components?.schemas ?? {};
      const itemKeys = Object.keys(schemas).filter((name) =>
        name.startsWith("Item"),
      );
      expect(itemKeys).toEqual(["ItemA", "ItemB"]);
    });
  });

  describe("Issue #3576: meta id uniqueness guard", () => {
    const commons = {
      config: sampleConfig,
      title: "Issue 3576",
      version: "1.0.0",
      serverUrl: "http://localhost:8090",
      composition: "components" as const,
    };

    test("two different schemas sharing an id across endpoints should throw", () => {
      const alpha = z
        .object({ kind: z.literal("alpha") })
        .meta({ id: "Shared" });
      const beta = z.object({ kind: z.literal("beta") }).meta({ id: "Shared" });
      expect(
        () =>
          new Documentation({
            routing: {
              "get /a": defaultEndpointsFactory.build({
                input: z.object({}),
                output: alpha,
                handler: vi.fn(),
              }),
              "get /b": defaultEndpointsFactory.build({
                input: z.object({}),
                output: beta,
                handler: vi.fn(),
              }),
            },
            ...commons,
          }),
      ).toThrow(/Shared/);
    });

    test("an id reused for a transformation should throw", () => {
      const obj = z.object({ a: z.number() }).meta({ id: "Shared" });
      const objToObj = obj
        .transform(({ a }) => ({ b: String(a) }))
        .meta({ id: "Shared" });
      expect(
        () =>
          new Documentation({
            routing: {
              "post /a": defaultEndpointsFactory.build({
                method: "post",
                input: obj,
                output: objToObj,
                handler: vi.fn(),
              }),
            },
            ...commons,
          }),
      ).toThrow(/Shared/);
    });

    test("same instance depicted differently as input and output should not throw", () => {
      const pipe = z
        .object({ a: z.number() })
        .transform(({ a }) => ({ b: String(a) }))
        .meta({ id: "Shared" });
      expect(
        () =>
          new Documentation({
            routing: {
              "post /a": defaultEndpointsFactory.build({
                method: "post",
                input: pipe,
                output: pipe,
                handler: vi.fn(),
              }),
            },
            ...commons,
          }),
      ).not.toThrow();
    });

    test("same schema reused with the same id should not throw", () => {
      const item = z
        .object({ id: z.uuid(), name: z.string() })
        .meta({ id: "Item" });
      expect(
        () =>
          new Documentation({
            routing: {
              "get /a": defaultEndpointsFactory.build({
                input: item,
                output: item,
                handler: vi.fn(),
              }),
              "get /b": defaultEndpointsFactory.build({
                input: item,
                output: item,
                handler: vi.fn(),
              }),
            },
            ...commons,
          }),
      ).not.toThrow();
    });
  });

  describe("Issue #3578: Missing path parameters", () => {
    const commons = {
      config: sampleConfig,
      title: "Issue 3578",
      version: "1.0.0",
      serverUrl: "http://localhost:8090",
      composition: "components" as const,
    };

    test.each([
      ["users/:id", z.object({ name: z.string() }), "id"],
      ["items/:id/variants/:name", z.object({ id: z.string() }), "name"],
    ])(
      "Should throw when path param '%s' is missing from input schema",
      (routePath, input, missingParam) => {
        expect(
          () =>
            new Documentation({
              ...commons,
              routing: {
                v1: {
                  [routePath]: defaultEndpointsFactory.buildVoid({
                    input,
                    handler: vi.fn(),
                  }),
                },
              },
            }),
        ).toThrow(
          new DocumentationError(
            `The input schema is missing the path parameter "${missingParam}"`,
            { method: "get", path: `/v1/${routePath}`, isResponse: false },
          ),
        );
      },
    );

    test("Should not throw when all path params are present in the schema", () => {
      expect(
        () =>
          new Documentation({
            ...commons,
            routing: {
              v1: {
                "users/:id": defaultEndpointsFactory.buildVoid({
                  input: z.object({ id: z.string(), name: z.string() }),
                  handler: vi.fn(),
                }),
              },
            },
          }),
      ).not.toThrow();
    });

    test("Should throw when path param is not classified as in:path", () => {
      const config = createConfig({
        cors: true,
        logger: { level: "silent" },
        http: { listen: givePort() },
        inputSources: { post: ["body", "query"] },
      });
      expect(
        () =>
          new Documentation({
            ...commons,
            config,
            routing: {
              v1: {
                ":id": defaultEndpointsFactory.buildVoid({
                  method: "post",
                  input: z.object({ id: z.string() }),
                  handler: vi.fn(),
                }),
              },
            },
          }),
      ).toThrow(
        new DocumentationError(
          'The input schema is missing the path parameter "id"',
          { method: "post", path: "/v1/:id", isResponse: false },
        ),
      );
    });
  });

  test("Depicter type should be satisfied", () => {
    expectTypeOf(
      ({
        jsonSchema,
      }: {
        zodSchema: z.core.$ZodType;
        jsonSchema: z.core.JSONSchema.BaseSchema;
      }) => jsonSchema,
    ).toExtend<Depicter>();
  });
});
