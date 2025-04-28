import ts from "typescript";
import { z } from "zod";
import { ez } from "../src";
import { f, printNode } from "../src/typescript-api";
import { zodToTs } from "../src/zts";
import { ZTSContext } from "../src/zts-helpers";

describe("zod-to-ts", () => {
  const printNodeTest = (node: ts.Node) =>
    printNode(node, { newLine: ts.NewLineKind.LineFeed });
  const ctx: ZTSContext = {
    isResponse: false,
    makeAlias: vi.fn(() => f.createTypeReferenceNode("SomeType")),
  };

  describe("z.array()", () => {
    test("outputs correct typescript", () => {
      const node = zodToTs(
        z.object({ id: z.number(), value: z.string() }).array(),
        { ctx },
      );
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });

  describe.each(["string", "base64", "binary", "buffer"] as const)(
    "ez.file(%s)",
    (variant) => {
      test("should depend on variant", () => {
        const node = zodToTs(ez.file(variant), { ctx });
        expect(printNodeTest(node)).toMatchSnapshot();
      });
    },
  );

  describe("ez.raw()", () => {
    test("should depict the raw property", () => {
      const node = zodToTs(ez.raw({ extra: z.string() }), { ctx });
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });

  describe("enums", () => {
    // noinspection JSUnusedGlobalSymbols
    enum Color {
      Red,
      Green,
      Blue,
    }

    // noinspection JSUnusedGlobalSymbols
    enum Fruit {
      Apple = "apple",
      Banana = "banana",
      Cantaloupe = "cantaloupe",
    }

    // noinspection JSUnusedGlobalSymbols
    enum StringLiteral {
      "Two Words",
      "'Quotes\"",
      '\\"Escaped\\"',
    }

    test.each([
      { schema: z.enum(Color), feature: "numeric" },
      { schema: z.enum(Fruit), feature: "string" },
      { schema: z.enum(StringLiteral), feature: "quoted string" },
    ])("handles $feature literals", ({ schema }) => {
      expect(printNodeTest(zodToTs(schema, { ctx }))).toMatchSnapshot();
    });
  });

  describe("Example", () => {
    // noinspection JSUnusedGlobalSymbols
    enum Fruits {
      Apple = "apple",
      Banana = "banana",
      Cantaloupe = "cantaloupe",
      A = 5,
    }

    const pickedSchema = z
      .object({
        string: z.string(),
        number: z.number(),
        fixedArrayOfString: z.array(z.string()).nonempty().length(10),
        object: z.object({
          string: z.string(),
        }),
      })
      .partial();

    const circular: z.ZodLazy = z.lazy(() =>
      z.object({
        a: z.string(),
        b: circular,
      }),
    );

    const circular2 = z.interface({
      name: z.string(),
      get subcategories() {
        return z.array(circular2);
      },
    });

    const example = z.object({
      string: z.string(),
      number: z.number(),
      arrayOfObjects: z.array(
        z.object({
          string: z.string(),
        }),
      ),
      boolean: z.boolean(),
      circular,
      circular2,
      union: z.union([z.object({ number: z.number() }), z.literal("hi")]),
      enum: z.enum(["hi", "bye"]),
      intersectionWithTransform: z
        .number()
        .and(z.bigint())
        .and(z.number().and(z.string()))
        .transform((arg) => console.log(arg)),
      date: z.date(),
      undefined: z.undefined(),
      null: z.null(),
      void: z.void(),
      any: z.any(),
      unknown: z.unknown(),
      never: z.never(),
      optionalString: z.optional(z.string()),
      nullablePartialObject: z.nullable(pickedSchema),
      tuple: z.tuple([
        z.string(),
        z.number(),
        z.object({ string: z.string() }),
      ]),
      tupleRest: z.tuple([z.string(), z.number()]).rest(z.boolean()),
      record: z.record(
        z.string(),
        z.object({
          object: z.object({
            arrayOfUnions: z
              .union([
                z.tuple([z.string(), z.object({ string: z.string() })]),
                z.bigint(),
              ])
              .array(),
          }),
        }),
      ),
      map: z.map(z.string(), z.array(z.object({ string: z.string() }))),
      set: z.set(z.string()),
      intersection: z.string().and(z.number()).or(z.bigint()),
      promise: z.promise(z.number()),
      optDefaultString: z.string().optional().default("hi"),
      refinedStringWithSomeBullshit: z
        .string()
        .refine((val) => val.length > 10)
        .or(z.number())
        .and(z.bigint().nullish().default(1000n)),
      nativeEnum: z.enum(Fruits),
      lazy: z.lazy(() => z.string()),
      discUnion: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("circle"), radius: z.number() }),
        z.object({ kind: z.literal("square"), x: z.number() }),
        z.object({ kind: z.literal("triangle"), x: z.number(), y: z.number() }),
      ]),
      branded: z.string().brand("BRAND"),
      catch: z.number().catch(123),
      pipeline: z.string().regex(/\d+/).transform(Number).pipe(z.number()),
      readonly: z.string().readonly(),
    });

    test("should produce the expected results", () => {
      const node = zodToTs(example, { ctx });
      expect(printNode(node)).toMatchSnapshot();
    });
  });

  describe("z.optional()", () => {
    const optionalStringSchema = z.string().optional();
    const objectWithOptionals = z.object({
      optional: optionalStringSchema,
      required: z.string(),
      transform: z
        .number()
        .optional()
        .transform((arg) => arg),
      or: z.number().optional().or(z.string()),
      tuple: z
        .tuple([
          z.string().optional(),
          z.number(),
          z.object({
            optional: z.string().optional(),
            required: z.string(),
          }),
        ])
        .optional(),
    });

    test("outputs correct typescript", () => {
      const node = zodToTs(optionalStringSchema, { ctx });
      expect(printNodeTest(node)).toMatchSnapshot();
    });

    test("should output `?:` and undefined union for optional properties", () => {
      const node = zodToTs(objectWithOptionals, { ctx });
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });

  describe("z.nullable()", () => {
    const nullableUsernameSchema = z.object({
      username: z.string().nullable(),
    });
    const node = zodToTs(nullableUsernameSchema, { ctx });

    test("outputs correct typescript", () => {
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });

  describe("z.object()", () => {
    test("supports string literal properties", () => {
      const schema = z.object({
        "string-literal": z.string(),
        5: z.number(),
      });
      const node = zodToTs(schema, { ctx });
      expect(printNodeTest(node)).toMatchSnapshot();
    });

    test("does not unnecessary quote identifiers", () => {
      const schema = z.object({
        id: z.string(),
        name: z.string(),
        countryOfOrigin: z.string(),
      });
      const node = zodToTs(schema, { ctx });
      expect(printNodeTest(node)).toMatchSnapshot();
    });

    test("escapes correctly", () => {
      const schema = z.object({
        "\\": z.string(),
        '"': z.string(),
        "'": z.string(),
        "`": z.string(),
        "\n": z.number(),
        $e: z.any(),
        "4t": z.any(),
        _r: z.any(),
        "-r": z.undefined(),
      });
      const node = zodToTs(schema, { ctx });
      expect(printNodeTest(node)).toMatchSnapshot();
    });

    test("supports zod.describe()", () => {
      const schema = z.object({
        name: z.string().describe("The name of the item"),
        price: z.number().describe("The price of the item"),
      });
      const node = zodToTs(schema, { ctx });
      expect(printNodeTest(node)).toMatchSnapshot();
    });

    test("supports zod.deprecated()", () => {
      const schema = z.object({
        one: z.string().deprecated(),
        two: z.string().deprecated().describe("with description"),
      });
      const node = zodToTs(schema, { ctx });
      expect(printNodeTest(node)).toMatchSnapshot();
    });

    test("specially handles coercive schema in response", () => {
      const schema = z.object({
        prop: z.coerce.string(),
      });
      const node = zodToTs(schema, { ctx: { ...ctx, isResponse: true } });
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });

  describe("Issue #2352: intersection of objects having same prop %#", () => {
    test.each([
      [z.string(), z.string()],
      [z.string().nonempty(), z.email()],
      [
        z.string().transform(Number),
        z
          .string()
          .transform((str) => new Date(str))
          .pipe(z.date()),
      ],
      [z.object({}), z.object({})],
    ])("should deduplicate the prop with a same name", (a, b) => {
      const schema = z.object({ query: a }).and(z.object({ query: b }));
      const node = zodToTs(schema, { ctx });
      expect(printNodeTest(node)).toMatchSnapshot();
    });

    test.each([
      [
        z.object({ query: z.string() }),
        z.object({ query: z.number() }), // prop type
      ],
      [
        z.object({ query: z.object({ sub: z.string() }) }),
        z.object({ query: z.object({ sub: z.number() }) }), // different complex
      ],
      [
        z.object({ query: z.string() }),
        z.object({ query: z.string().optional() }), // question mark
      ],
      [
        z.object({ query: z.string() }),
        z.object({ query: z.string() }).partial(), // also question mark
      ],
    ])(
      "should not flatten the result for objects with a conflicting prop %#",
      (a, b) => {
        const node = zodToTs(a.and(b), { ctx });
        expect(printNodeTest(node)).toMatchSnapshot();
      },
    );
  });

  describe("PrimitiveSchema", () => {
    const primitiveSchema = z.object({
      string: z.string(),
      number: z.number(),
      boolean: z.boolean(),
      date: z.date(),
      undefined: z.undefined(),
      null: z.null(),
      void: z.void(),
      any: z.any(),
      unknown: z.unknown(),
      never: z.never(),
    });
    const node = zodToTs(primitiveSchema, { ctx });

    test("outputs correct typescript", () => {
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });

  describe("z.discriminatedUnion()", () => {
    const shapeSchema = z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("circle"), radius: z.number() }),
      z.object({ kind: z.literal("square"), x: z.number() }),
      z.object({ kind: z.literal("triangle"), x: z.number(), y: z.number() }),
    ]);
    const node = zodToTs(shapeSchema, { ctx });

    test("outputs correct typescript", () => {
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });

  describe("z.literal()", () => {
    test.each([
      z.literal("test"),
      z.literal(true),
      z.literal(false),
      z.literal(123),
      z.literal(undefined),
    ])("Should produce the correct typescript %#", (schema) => {
      expect(printNodeTest(zodToTs(schema, { ctx }))).toMatchSnapshot();
    });
  });

  describe("z.effect()", () => {
    describe("transformations", () => {
      test.each([
        { isResponse: false, expected: "intact" },
        { isResponse: true, expected: "transformed" },
      ])("should produce the schema type $expected", ({ isResponse }) => {
        const schema = z.number().transform((num) => `${num}`);
        expect(
          printNodeTest(zodToTs(schema, { ctx: { ...ctx, isResponse } })),
        ).toMatchSnapshot();
      });

      test("should handle unsupported transformation in response", () => {
        const schema = z.number().transform((num) => () => num);
        expect(
          printNodeTest(zodToTs(schema, { ctx: { ...ctx, isResponse: true } })),
        ).toMatchSnapshot();
      });

      test("should handle an error within the transformation", () => {
        const schema = z
          .number()
          .transform(() => assert.fail("this should be handled"));
        expect(
          printNodeTest(zodToTs(schema, { ctx: { ...ctx, isResponse: true } })),
        ).toMatchSnapshot();
      });
    });
  });
});
