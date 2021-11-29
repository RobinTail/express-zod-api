import { defaultEndpointsFactory, withMeta, z } from "../../src/index";
import {
  depictAny,
  depictArray,
  depictBigInt,
  depictBoolean,
  depictDate,
  depictDefault,
  depictEffect,
  depictEnum,
  depictFile,
  depictIntersection,
  depictIOExamples,
  depictIOParamExamples,
  depictLiteral,
  depictNull,
  depictNumber,
  depictObject,
  depictObjectProperties,
  depictOptionalOrNullable,
  depictRecord,
  depictRequestParams,
  depictSchema,
  depictString,
  depictTuple,
  depictUnion,
  depictUpload,
  excludeExampleFromDepiction,
  excludeParamsFromDepiction,
  reformatParamsInPath,
} from "../../src/open-api-helpers";

describe("Open API helpers", () => {
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
  });

  describe("depictFile()", () => {
    test("should depict ZodFile", () => {
      expect(
        depictFile({
          schema: z.file().binary(),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
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

  describe("depictOptionalOrNullable()", () => {
    test("should depict ZodOptional", () => {
      expect(
        depictOptionalOrNullable({
          schema: z.string().optional(),
          isResponse: false,
          initial: { description: "test" },
        })
      ).toMatchSnapshot();
    });

    test("should depict ZodNullable", () => {
      expect(
        depictOptionalOrNullable({
          schema: z.string().nullable(),
          isResponse: false,
          initial: { description: "test", nullable: true },
        })
      ).toMatchSnapshot();
    });
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
    test("should depict ZodObject", () => {
      expect(
        depictObject({
          schema: z.object({
            one: z.number(),
            two: z.string(),
          }),
          isResponse: false,
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

  describe("depictDate()", () => {
    test("should depict ZodDate", () => {
      expect(
        depictDate({
          schema: z.date(),
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

    test("should depict ZodString with refinements", () => {
      expect(
        depictString({
          schema: z.string().email().min(10).max(20),
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
          test: "some",
          example: "test",
        })
      ).toMatchSnapshot();
    });
  });
});
