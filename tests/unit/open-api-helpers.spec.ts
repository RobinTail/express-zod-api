import { IOSchemaError } from "../../src/errors";
import {
  OpenAPIError,
  defaultEndpointsFactory,
  withMeta,
  z,
} from "../../src/index";
import { getMeta } from "../../src/metadata";
import {
  depictAny,
  depictArray,
  depictBigInt,
  depictBoolean,
  depictBranded,
  depictCatch,
  depictDate,
  depictDateIn,
  depictDateOut,
  depictDefault,
  depictDiscriminatedUnion,
  depictEffect,
  depictEnum,
  depictFile,
  depictIOExamples,
  depictIOParamExamples,
  depictIntersection,
  depictLiteral,
  depictNull,
  depictNullable,
  depictNumber,
  depictObject,
  depictObjectProperties,
  depictOptional,
  depictPipeline,
  depictRecord,
  depictRequestParams,
  depictSchema,
  depictSecurity,
  depictSecurityRefs,
  depictString,
  depictTags,
  depictTuple,
  depictUnion,
  depictUpload,
  ensureShortDescription,
  excludeExampleFromDepiction,
  excludeParamsFromDepiction,
  extractObjectSchema,
  hasCoercion,
  reformatParamsInPath,
} from "../../src/open-api-helpers";
import { serializeSchemaForTest } from "../helpers";

describe("Open API helpers", () => {
  describe("extractObjectSchema()", () => {
    test("should pass the object schema through", () => {
      const subject = extractObjectSchema(
        z.object({
          one: z.string(),
        })
      );
      expect(subject).toBeInstanceOf(z.ZodObject);
      expect(serializeSchemaForTest(subject)).toMatchSnapshot();
    });

    test("should return object schema for the union of object schemas", () => {
      const subject = extractObjectSchema(
        z
          .object({
            one: z.string(),
          })
          .or(
            z.object({
              two: z.number(),
            })
          )
      );
      expect(subject).toBeInstanceOf(z.ZodObject);
      expect(serializeSchemaForTest(subject)).toMatchSnapshot();
    });

    test("should return object schema for the intersection of object schemas", () => {
      const subject = extractObjectSchema(
        z
          .object({
            one: z.string(),
          })
          .and(
            z.object({
              two: z.number(),
            })
          )
      );
      expect(subject).toBeInstanceOf(z.ZodObject);
      expect(serializeSchemaForTest(subject)).toMatchSnapshot();
    });

    test("should preserve examples", () => {
      const objectSchema = withMeta(
        z.object({
          one: z.string(),
        })
      ).example({
        one: "test",
      });
      expect(getMeta(extractObjectSchema(objectSchema), "examples")).toEqual([
        {
          one: "test",
        },
      ]);

      const refinedObjSchema = withMeta(
        z
          .object({
            one: z.string(),
          })
          .refine(() => true)
      ).example({
        one: "test",
      });
      expect(
        getMeta(extractObjectSchema(refinedObjSchema), "examples")
      ).toEqual([
        {
          one: "test",
        },
      ]);

      const unionSchema = withMeta(
        z
          .object({
            one: z.string(),
          })
          .or(
            z.object({
              two: z.number(),
            })
          )
      )
        .example({
          one: "test1",
        })
        .example({
          two: 123,
        });
      expect(getMeta(extractObjectSchema(unionSchema), "examples")).toEqual([
        { one: "test1" },
        { two: 123 },
      ]);

      const intersectionSchema = withMeta(
        z
          .object({
            one: z.string(),
          })
          .and(
            z.object({
              two: z.number(),
            })
          )
      ).example({
        one: "test1",
        two: 123,
      });
      expect(
        getMeta(extractObjectSchema(intersectionSchema), "examples")
      ).toEqual([
        {
          one: "test1",
          two: 123,
        },
      ]);
    });

    describe("Feature #600: Top level refinements", () => {
      test("should handle refined object schema", () => {
        const subject = extractObjectSchema(
          z
            .object({
              one: z.string(),
            })
            .refine(() => true)
        );
        expect(subject).toBeInstanceOf(z.ZodObject);
        expect(serializeSchemaForTest(subject)).toMatchSnapshot();
      });

      test("should throw when using transformation", () => {
        expect(() =>
          extractObjectSchema(
            z
              .object({
                one: z.string(),
              })
              .transform(() => [])
          )
        ).toThrowError(
          new IOSchemaError(
            "Using transformations on the top level of input schema is not allowed."
          )
        );
      });
    });
  });

  describe("excludeParamsFromDepiction()", () => {
    test("should omit specified path params", () => {
      const depicted = depictSchema({
        schema: z.object({
          a: z.string(),
          b: z.string(),
        }),
        isResponse: false,
      });
      expect(excludeParamsFromDepiction(depicted, ["a"])).toMatchSnapshot();
    });

    test("should handle union", () => {
      const depicted = depictSchema({
        schema: z
          .object({
            a: z.string(),
          })
          .or(
            z.object({
              b: z.string(),
            })
          ),
        isResponse: false,
      });
      expect(excludeParamsFromDepiction(depicted, ["a"])).toMatchSnapshot();
    });

    test("should handle intersection", () => {
      const depicted = depictSchema({
        schema: z
          .object({
            a: z.string(),
          })
          .and(
            z.object({
              b: z.string(),
            })
          ),
        isResponse: false,
      });
      expect(excludeParamsFromDepiction(depicted, ["a"])).toMatchSnapshot();
    });
  });

  describe("reformatParamsInPath()", () => {
    test("should replace route path params from colon to curly braces notation", () => {
      expect(reformatParamsInPath("/v1/user")).toBe("/v1/user");
      expect(reformatParamsInPath("/v1/user/:id")).toBe("/v1/user/{id}");
      expect(reformatParamsInPath("/v1/flight/:from-:to")).toBe(
        "/v1/flight/{from}-{to}"
      );
      expect(reformatParamsInPath("/v1/flight/:from-:to/updates")).toBe(
        "/v1/flight/{from}-{to}/updates"
      );
    });
  });

  describe("depictDefault()", () => {
    test("should depict ZodDefault", () => {
      expect(
        depictDefault({
          schema: z.boolean().default(true),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictCatch()", () => {
    test("should depict ZodCatch", () => {
      expect(
        depictCatch({
          schema: z.boolean().catch(true),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictAny()", () => {
    test("should depict ZodAny", () => {
      expect(
        depictAny({
          schema: z.any(),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictUpload()", () => {
    test("should depict ZodUpload", () => {
      expect(
        depictUpload({
          schema: z.upload(),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
    test("should throw when using in response", () => {
      try {
        depictUpload({
          schema: z.upload(),
          isResponse: true,
          initial: { description: "test" },
        });
        fail("Should not be here");
      } catch (e) {
        expect(e).toBeInstanceOf(OpenAPIError);
        expect(e).toMatchSnapshot();
      }
    });
  });

  describe("depictFile()", () => {
    test.each([z.file(), z.file().binary(), z.file().base64()])(
      "should depict ZodFile %#",
      (schema) => {
        expect(
          depictFile({
            schema,
            isResponse: true,
            initial: { description: "test" },
          })
        ).toMatchSnapshot();
      }
    );
    test("should throw when using in input", () => {
      try {
        depictFile({
          schema: z.file().binary(),
          isResponse: false,
          initial: { description: "test" },
        });
        fail("Should not be here");
      } catch (e) {
        expect(e).toBeInstanceOf(OpenAPIError);
        expect(e).toMatchSnapshot();
      }
    });
  });

  describe("depictUnion()", () => {
    test("should depict ZodUnion", () => {
      expect(
        depictUnion({
          schema: z.string().or(z.number()),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictDiscriminatedUnion()", () => {
    test("should depict ZodDiscriminatedUnion", () => {
      expect(
        depictDiscriminatedUnion({
          schema: z.discriminatedUnion("status", [
            z.object({ status: z.literal("success"), data: z.any() }),
            z.object({
              status: z.literal("error"),
              error: z.object({ message: z.string() }),
            }),
          ]),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictIntersection()", () => {
    test("should depict ZodIntersection", () => {
      expect(
        depictIntersection({
          schema: z
            .object({ one: z.number() })
            .and(z.object({ two: z.number() })),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("hasCoercion", () => {
    test.each([
      { schema: z.string(), coercion: false },
      { schema: z.coerce.string(), coercion: true },
      { schema: z.boolean({ coerce: true }), coercion: true },
      { schema: z.custom(), coercion: false },
    ])(
      "should check the presence and value of coerce prop %#",
      ({ schema, coercion }) => {
        expect(hasCoercion(schema)).toBe(coercion);
      }
    );
  });

  describe("depictOptional()", () => {
    test.each([{ isResponse: false }, { isResponse: true }])(
      "should depict ZodOptional %#",
      ({ isResponse }) => {
        expect(
          depictOptional({
            schema: z.string().optional(),
            isResponse,
            initial: { description: "test" },
          })
        ).toMatchSnapshot();
      }
    );
  });

  describe("depictNullable()", () => {
    test.each([{ isResponse: false }, { isResponse: true }])(
      "should depict ZodNullable %#",
      ({ isResponse }) => {
        expect(
          depictNullable({
            schema: z.string().nullable(),
            isResponse,
            initial: { description: "test" },
          })
        ).toMatchSnapshot();
      }
    );
  });

  describe("depictEnum()", () => {
    test("should depict ZodEnum", () => {
      expect(
        depictEnum({
          schema: z.enum(["one", "two"]),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });

    test("should depict ZodNativeEnum", () => {
      enum Test {
        one = "ONE",
        two = "TWO",
      }

      expect(
        depictEnum({
          schema: z.nativeEnum(Test),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictLiteral()", () => {
    test("should depict ZodLiteral", () => {
      expect(
        depictLiteral({
          schema: z.literal("testing"),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictObject()", () => {
    test.each([
      {
        isResponse: false,
        shape: { a: z.number(), b: z.string() },
      },
      {
        isResponse: true,
        shape: { a: z.number(), b: z.string() },
      },
      {
        isResponse: true,
        shape: { a: z.coerce.number(), b: z.string({ coerce: true }) },
      },
    ])("should depict ZodObject %#", ({ isResponse, shape }) => {
      expect(
        depictObject({
          schema: z.object(shape),
          isResponse,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictNull()", () => {
    test("should depict ZodNull", () => {
      expect(
        depictNull({
          schema: z.null(),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictBoolean()", () => {
    test("should depict ZodBoolean", () => {
      expect(
        depictBoolean({
          schema: z.boolean(),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictBigInt()", () => {
    test("should depict ZodBigInt", () => {
      expect(
        depictBigInt({
          schema: z.bigint(),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictRecord()", () => {
    test("should depict classic ZodRecord", () => {
      expect(
        depictRecord({
          schema: z.record(z.boolean()),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });

    test("should depict ZodRecord with key schema string", () => {
      expect(
        depictRecord({
          schema: z.record(z.string(), z.boolean()),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });

    test("should depict ZodRecord with key schema enum", () => {
      expect(
        depictRecord({
          schema: z.record(z.enum(["one", "two"]), z.boolean()),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });

    test("should depict ZodRecord with key schema literal", () => {
      expect(
        depictRecord({
          schema: z.record(z.literal("testing"), z.boolean()),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });

    test("should depict ZodRecord with key schema union of literals", () => {
      expect(
        depictRecord({
          schema: z.record(z.literal("one").or(z.literal("two")), z.boolean()),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictArray()", () => {
    test("should depict ZodArray", () => {
      expect(
        depictArray({
          schema: z.array(z.boolean()),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictTuple()", () => {
    test("should depict ZodTuple", () => {
      expect(
        depictTuple({
          schema: z.tuple([z.boolean(), z.string(), z.literal("test")]),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictString()", () => {
    test("should depict regular ZodString", () => {
      expect(
        depictString({
          schema: z.string(),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });

    test.each([
      z.string().email().min(10).max(20),
      z.string().url().length(15),
      z.string().uuid(),
      z.string().cuid(),
      z.string().datetime(),
      z.string().datetime({ offset: true }),
    ])("should depict ZodString with refinements %#", (schema) => {
      expect(
        depictString({
          schema,
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });

    test("should depict ZodString with regex", () => {
      expect(
        depictString({
          schema: z.string().regex(/^\d+.\d+.\d+$/),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictNumber()", () => {
    test("should depict regular ZodNumber", () => {
      expect(
        depictNumber({
          schema: z.number(),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });

    test("should depict ZodNumber with refinements", () => {
      expect(
        depictNumber({
          schema: z.number().int().min(10).max(20),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictObjectProperties()", () => {
    test("should depict ZodObject shape", () => {
      expect(
        depictObjectProperties({
          schema: z.object({
            one: z.string(),
            two: z.boolean(),
          }),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictEffect()", () => {
    test("should depict ZodEffects transformation in case of response", () => {
      expect(
        depictEffect({
          schema: z.string().transform((v) => parseInt(v, 10)),
          isResponse: true,
        })
      ).toMatchSnapshot();
    });

    test("should depict ZodEffects transformation in case of request", () => {
      expect(
        depictEffect({
          schema: z.string().transform((v) => parseInt(v, 10)),
          isResponse: false,
        })
      ).toMatchSnapshot();
    });

    test("should depict ZodEffects preprocess in case of request", () => {
      expect(
        depictEffect({
          schema: z.preprocess((v) => parseInt(`${v}`, 10), z.string()),
          isResponse: false,
        })
      ).toMatchSnapshot();
    });

    test("should depict refinements", () => {
      expect(
        depictEffect({
          schema: z
            .object({ s: z.string() })
            .refine(() => false, { message: "test" }),
          isResponse: false,
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictPipeline", () => {
    test.each([{ isResponse: true }, { isResponse: false }])(
      "should depict inner schema depending on IO direction %#",
      ({ isResponse }) => {
        expect(
          depictPipeline({
            isResponse,
            schema: z.string().pipe(z.coerce.boolean()),
          })
        ).toMatchSnapshot();
      }
    );
  });

  describe("depictIOExamples()", () => {
    test("should depict examples in case of request", () => {
      expect(
        depictIOExamples(
          withMeta(
            z.object({
              one: z.string().transform((v) => v.length),
              two: z.number().transform((v) => `${v}`),
              three: z.boolean(),
            })
          )
            .example({
              one: "test",
              two: 123,
              three: true,
            })
            .example({
              one: "test2",
              two: 456,
              three: false,
            }),
          false,
          ["three"]
        )
      ).toMatchSnapshot();
    });

    test("should depict examples in case of response", () => {
      expect(
        depictIOExamples(
          withMeta(
            z.object({
              one: z.string().transform((v) => v.length),
              two: z.number().transform((v) => `${v}`),
              three: z.boolean(),
            })
          )
            .example({
              one: "test",
              two: 123,
              three: true,
            })
            .example({
              one: "test2",
              two: 456,
              three: false,
            }),
          true,
          ["three"]
        )
      ).toMatchSnapshot();
    });
  });

  describe("depictIOParamExamples()", () => {
    test("should depict examples in case of request", () => {
      expect(
        depictIOParamExamples(
          withMeta(
            z.object({
              one: z.string().transform((v) => v.length),
              two: z.number().transform((v) => `${v}`),
              three: z.boolean(),
            })
          )
            .example({
              one: "test",
              two: 123,
              three: true,
            })
            .example({
              one: "test2",
              two: 456,
              three: false,
            }),
          false,
          "two"
        )
      ).toMatchSnapshot();
    });

    test("should depict examples in case of response", () => {
      expect(
        depictIOParamExamples(
          withMeta(
            z.object({
              one: z.string().transform((v) => v.length),
              two: z.number().transform((v) => `${v}`),
              three: z.boolean(),
            })
          )
            .example({
              one: "test",
              two: 123,
              three: true,
            })
            .example({
              one: "test2",
              two: 456,
              three: false,
            }),
          true,
          "two"
        )
      ).toMatchSnapshot();
    });
  });

  describe("depictRequestParams()", () => {
    test("should depict query and path params", () => {
      expect(
        depictRequestParams({
          path: "/v1/user/:id",
          method: "get",
          endpoint: defaultEndpointsFactory.build({
            methods: ["get", "put", "delete"],
            input: z.object({
              id: z.string(),
              test: z.boolean(),
            }),
            output: z.object({}),
            handler: jest.fn(),
          }),
          inputSources: ["query", "params"],
        })
      ).toMatchSnapshot();
    });

    test("should depict only path params if query is disabled", () => {
      expect(
        depictRequestParams({
          path: "/v1/user/:id",
          method: "get",
          endpoint: defaultEndpointsFactory.build({
            methods: ["get", "put", "delete"],
            input: z.object({
              id: z.string(),
              test: z.boolean(),
            }),
            output: z.object({}),
            handler: jest.fn(),
          }),
          inputSources: ["body", "params"],
        })
      ).toMatchSnapshot();
    });

    test("should depict none if both query and params are disabled", () => {
      expect(
        depictRequestParams({
          path: "/v1/user/:id",
          method: "get",
          endpoint: defaultEndpointsFactory.build({
            methods: ["get", "put", "delete"],
            input: z.object({
              id: z.string(),
              test: z.boolean(),
            }),
            output: z.object({}),
            handler: jest.fn(),
          }),
          inputSources: ["body"],
        })
      ).toMatchSnapshot();
    });
  });

  describe("excludeExampleFromDepiction()", () => {
    test("should remove example property of supplied object", () => {
      expect(
        excludeExampleFromDepiction({
          type: "string",
          description: "test",
          example: "test",
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictDateIn", () => {
    test("should depict ZodDateIn", () => {
      expect(
        depictDateIn({
          schema: z.dateIn(),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
    test("should throw when ZodDateIn in response", () => {
      try {
        depictDateIn({
          schema: z.dateIn(),
          isResponse: true,
          initial: { description: "test" },
        });
        fail("should not be here");
      } catch (e) {
        expect(e).toBeInstanceOf(OpenAPIError);
        expect(e).toMatchSnapshot();
      }
    });
  });

  describe("depictDateOut", () => {
    test("should depict ZodDateOut", () => {
      expect(
        depictDateOut({
          schema: z.dateOut(),
          isResponse: true,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });
    test("should throw when ZodDateOut in request", () => {
      try {
        depictDateOut({
          schema: z.dateOut(),
          isResponse: false,
          initial: { description: "test" },
        });
        fail("should not be here");
      } catch (e) {
        expect(e).toBeInstanceOf(OpenAPIError);
        expect(e).toMatchSnapshot();
      }
    });
  });

  describe("depictDate", () => {
    test("should throw clear error", () => {
      try {
        depictDate({ isResponse: true, schema: z.date() });
        fail("should not be here");
      } catch (e) {
        expect(e).toBeInstanceOf(OpenAPIError);
        expect(e).toMatchSnapshot();
      }
      try {
        depictDate({ isResponse: false, schema: z.date() });
        fail("should not be here");
      } catch (e) {
        expect(e).toBeInstanceOf(OpenAPIError);
        expect(e).toMatchSnapshot();
      }
    });
  });

  describe("depictBranded", () => {
    test("should depict the actual schema", () => {
      expect(
        depictBranded({
          schema: z.string().min(2).brand<"Test">(),
          isResponse: true,
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictSecurity()", () => {
    test("should handle Basic, Bearer and CustomHeader Securities", () => {
      expect(
        depictSecurity({
          or: [
            { and: [{ type: "basic" }, { type: "bearer" }] },
            { type: "header", name: "X-Key" },
          ],
        })
      ).toMatchSnapshot();
    });
    test("should handle Input and Cookie Securities", () => {
      expect(
        depictSecurity({
          and: [
            {
              or: [
                { type: "input", name: "apiKey" },
                { type: "cookie", name: "hash" },
              ],
            },
          ],
        })
      ).toMatchSnapshot();
    });
    test("should handle OpenID and OAuth2 Securities", () => {
      expect(
        depictSecurity({
          or: [{ type: "openid", url: "https://test.url" }, { type: "oauth2" }],
        })
      ).toMatchSnapshot();
    });
    test("should depict OAuth2 Security with flows", () => {
      expect(
        depictSecurity({
          type: "oauth2",
          flows: {
            implicit: {
              authorizationUrl: "https://test.url",
              refreshUrl: "https://test2.url",
              scopes: {
                read: "read something",
                write: "write something",
              },
            },
            authorizationCode: {
              authorizationUrl: "https://test.url",
              refreshUrl: "https://test2.url",
              tokenUrl: "https://test3.url",
              scopes: {
                read: "read something",
                write: "write something",
              },
            },
            clientCredentials: {
              refreshUrl: "https://test2.url",
              tokenUrl: "https://test3.url",
              scopes: {
                read: "read something",
                write: "write something",
              },
            },
            password: {
              refreshUrl: "https://test2.url",
              tokenUrl: "https://test3.url",
              scopes: {
                read: "read something",
                write: "write something",
              },
            },
          },
        })
      ).toMatchSnapshot();
    });
    test("should handle undefined flows", () => {
      expect(
        depictSecurity({
          type: "oauth2",
          flows: {
            implicit: undefined,
            password: undefined,
          },
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictSecurityRefs()", () => {
    test("should handle LogicalAnd", () => {
      expect(
        depictSecurityRefs({
          and: [
            { name: "A", scopes: [] },
            { name: "B", scopes: [] },
            { name: "C", scopes: [] },
          ],
        })
      ).toMatchSnapshot();
      expect(
        depictSecurityRefs({
          and: [
            { name: "A", scopes: [] },
            {
              or: [
                { name: "B", scopes: [] },
                { name: "C", scopes: [] },
              ],
            },
          ],
        })
      ).toMatchSnapshot();
    });

    test("should handle LogicalOr", () => {
      expect(
        depictSecurityRefs({
          or: [
            { name: "A", scopes: [] },
            { name: "B", scopes: [] },
            { name: "C", scopes: [] },
          ],
        })
      ).toMatchSnapshot();
      expect(
        depictSecurityRefs({
          or: [
            { name: "A", scopes: [] },
            {
              and: [
                { name: "B", scopes: [] },
                { name: "C", scopes: [] },
              ],
            },
          ],
        })
      ).toMatchSnapshot();
    });

    test("should handle the plain value", () => {
      expect(depictSecurityRefs({ name: "A", scopes: [] })).toMatchSnapshot();
    });

    test("should populate the scopes", () => {
      expect(
        depictSecurityRefs({
          or: [
            { name: "A", scopes: ["write"] },
            { name: "B", scopes: ["read"] },
            { name: "C", scopes: ["read", "write"] },
          ],
        })
      ).toMatchSnapshot();
    });
  });

  describe("depictTags()", () => {
    test("should accept plain descriptions", () => {
      expect(
        depictTags({
          users: "Everything about users",
          files: "Everything about files processing",
        })
      ).toMatchSnapshot();
    });

    test("should accept objects with URLs", () => {
      expect(
        depictTags({
          users: { description: "Everything about users" },
          files: {
            description: "Everything about files processing",
            url: "https://example.com",
          },
        })
      ).toMatchSnapshot();
    });
  });

  describe("ensureShortDescription()", () => {
    test("keeps the short text as it is", () => {
      expect(ensureShortDescription("here is a short text")).toBe(
        "here is a short text"
      );
      expect(ensureShortDescription(" ")).toBe(" ");
      expect(ensureShortDescription("")).toBe("");
    });
    test("trims the long text", () => {
      expect(
        ensureShortDescription(
          "this text is definitely too long for the short description"
        )
      ).toBe("this text is definitely too long for the short de…");
    });
  });
});
