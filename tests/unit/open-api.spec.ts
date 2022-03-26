import { routing } from "../../example/routing";
import {
  z,
  OpenAPI,
  defaultEndpointsFactory,
  withMeta,
  createConfig,
} from "../../src";
import { expectType } from "tsd";

describe("Open API generator", () => {
  const config = createConfig({
    cors: true,
    logger: { level: "debug", color: true },
    server: {
      listen: 8090,
    },
  });

  describe("generateOpenApi()", () => {
    test("should generate the correct schema of example routing", () => {
      const spec = new OpenAPI({
        routing,
        config,
        version: "1.2.3",
        title: "Example API",
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should generate the correct schema for complex types", () => {
      const literalValue = "something" as const;
      const spec = new OpenAPI({
        config,
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
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should generate the correct schema for nullable and optional types", () => {
      const spec = new OpenAPI({
        config,
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
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should generate the correct schema for intersection type", () => {
      const spec = new OpenAPI({
        config,
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
                  })
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
                    })
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
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should generate the correct schema for union type", () => {
      const spec = new OpenAPI({
        config,
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
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should generate the correct schema for discriminated union type", () => {
      const spec = new OpenAPI({
        config,
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
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle transformation schema in output", () => {
      const spec = new OpenAPI({
        config,
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
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle bigint, boolean, date and null", () => {
      const spec = new OpenAPI({
        config,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "post",
              input: z.object({
                bigint: z.bigint(),
                boolean: z.boolean(),
                dateIn: z.dateIn(),
              }),
              output: z.object({
                null: z.null(),
                dateOut: z.dateOut(),
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
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle record", () => {
      const spec = new OpenAPI({
        config,
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
                  z.boolean()
                ),
                enum: z.record(z.enum(["option1", "option2"]), z.boolean()),
              }),
              handler: jest.fn(),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing record",
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle type any", () => {
      const spec = new OpenAPI({
        config,
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
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle different number types", () => {
      const spec = new OpenAPI({
        config,
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
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle different string types", () => {
      const spec = new OpenAPI({
        config,
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
                url: z.string().url(),
                numeric: z.string().regex(/\d+/),
                combined: z
                  .string()
                  .nonempty()
                  .email()
                  .regex(/.*@example\.com/is)
                  .max(90),
              }),
              output: z.object({
                nonempty: z.string().nonempty(),
              }),
              handler: jest.fn(),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing strings",
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle tuples", () => {
      const spec = new OpenAPI({
        config,
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
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle enum types", () => {
      const spec = new OpenAPI({
        config,
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
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle z.preprocess()", () => {
      const string = z.preprocess((arg) => String(arg), z.string());
      const number = z.preprocess(
        (arg) => parseInt(String(arg), 16),
        z.number().int().nonnegative()
      );
      const boolean = z.preprocess((arg) => !!arg, z.boolean());
      const spec = new OpenAPI({
        config,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "get",
              input: z.object({ string, number }),
              output: z.object({ boolean }),
              handler: async () => ({
                boolean: [] as unknown as boolean, // @todo check this out without type forcing in future Zod versions
              }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing z.preprocess()",
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
      expect(string.parse(123)).toBe("123");
      expect(number.parse("0xFF")).toBe(255);
      expect(boolean.parse([])).toBe(true);
      expect(boolean.parse("")).toBe(false);
      expect(boolean.parse(null)).toBe(false);
    });

    test("should throw on unsupported types", () => {
      [
        z.undefined(),
        z.map(z.any(), z.any()),
        z.function(),
        z.lazy(() => z.any()),
        z.promise(z.any()),
        z.unknown(),
        z.never(),
        z.void(),
      ].forEach((zodType) => {
        expect(
          () =>
            new OpenAPI({
              config,
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
              serverUrl: "http://example.com",
            })
        ).toThrowError(/Zod type Zod\w+ is unsupported/);
      });
    });
  });

  describe("Issue #98", () => {
    test("Should describe non-empty array", () => {
      // There is no such class as ZodNonEmptyArray in Zod v3.7.0+
      // It existed though in Zod v3.6.x:
      // @see https://github.com/colinhacks/zod/blob/v3.6.1/src/types.ts#L1204
      const spec = new OpenAPI({
        config,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              methods: ["get", "post"],
              input: z.object({
                arr: z.array(z.string()).nonempty(),
              }),
              output: z.object({
                arr: z.array(z.string()).nonempty(),
              }),
              handler: async ({ input }) => ({
                arr: input.arr,
              }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing issue #98",
        serverUrl: "http://example.com",
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

      const spec = new OpenAPI({
        config,
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
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });
  });

  describe("Route Path Params", () => {
    test("should handle route path params for POST request", () => {
      const spec = new OpenAPI({
        config,
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
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should handle route path params for GET request", () => {
      const spec = new OpenAPI({
        config,
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
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });
  });

  describe("Metadata", () => {
    test("should pass over the schema description", () => {
      const spec = new OpenAPI({
        config,
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
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should pass over the example of an individual parameter", () => {
      const spec = new OpenAPI({
        config,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "get",
              input: z.object({
                strNum: withMeta(
                  z.string().transform((v) => parseInt(v, 10))
                ).example("123"), // example is for input side of the transformation
              }),
              output: z.object({
                numericStr: withMeta(
                  z.number().transform((v) => `${v}`)
                ).example(123), // example is for input side of the transformation
              }),
              handler: async () => ({ numericStr: 123 }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing Metadata:example on IO parameter",
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should pass over examples of each param from the whole IO schema examples (GET)", () => {
      const spec = new OpenAPI({
        config,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "get",
              input: withMeta(
                z.object({
                  strNum: z.string().transform((v) => parseInt(v, 10)),
                })
              ).example({
                strNum: "123", // example is for input side of the transformation
              }),
              output: withMeta(
                z.object({
                  numericStr: z.number().transform((v) => `${v}`),
                })
              ).example({
                numericStr: 123, // example is for input side of the transformation
              }),
              handler: async () => ({ numericStr: 123 }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing Metadata:example on IO schema",
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should pass over examples of the whole IO schema (POST)", () => {
      const spec = new OpenAPI({
        config,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory.build({
              method: "post",
              input: withMeta(
                z.object({
                  strNum: z.string().transform((v) => parseInt(v, 10)),
                })
              ).example({
                strNum: "123", // example is for input side of the transformation
              }),
              output: withMeta(
                z.object({
                  numericStr: z.number().transform((v) => `${v}`),
                })
              ).example({
                numericStr: 123, // example is for input side of the transformation
              }),
              handler: async () => ({ numericStr: 123 }),
            }),
          },
        },
        version: "3.4.5",
        title: "Testing Metadata:example on IO schema",
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });

    test("should merge endpoint handler examples with its middleware examples", () => {
      const spec = new OpenAPI({
        config,
        routing: {
          v1: {
            getSomething: defaultEndpointsFactory
              .addMiddleware({
                input: withMeta(
                  z.object({
                    key: z.string(),
                  })
                ).example({
                  key: "1234-56789-01",
                }),
                middleware: jest.fn(),
              })
              .build({
                method: "post",
                input: withMeta(
                  z.object({
                    str: z.string(),
                  })
                ).example({
                  str: "test",
                }),
                output: withMeta(
                  z.object({
                    num: z.number(),
                  })
                ).example({
                  num: 123,
                }),
                handler: async () => ({ num: 123 }),
              }),
          },
        },
        version: "3.4.5",
        title: "Testing Metadata:example on IO schema + middleware",
        serverUrl: "http://example.com",
      }).getSpecAsYaml();
      expect(spec).toMatchSnapshot();
    });
  });
});
