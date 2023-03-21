/**
 * This file is based on https://github.com/sachinraja/zod-to-ts
 *
 * MIT License
 *
 * Copyright (c) 2021 Sachin Raja
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import ts from "typescript";
import { z } from "zod";
import { f } from "../../src/client-helpers";
import { defaultSerializer } from "../../src/common-helpers";
import { zodToTs } from "../../src/zts";
import { createTypeAlias, printNode } from "../../src/zts-helpers";

describe("zod-to-ts", () => {
  const printNodeTest = (node: ts.Node) =>
    printNode(node, { newLine: ts.NewLineKind.LineFeed });
  const defaultCtx = {
    isResponse: false,
    getAlias: jest.fn((name: string) => f.createTypeReferenceNode(name)),
    makeAlias: jest.fn(),
    serializer: defaultSerializer,
  };

  describe("z.array()", () => {
    it("outputs correct typescript", () => {
      const node = zodToTs({
        schema: z.object({ id: z.number(), value: z.string() }).array(),
        ...defaultCtx,
      });
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });

  describe("createTypeAlias()", () => {
    const identifier = "User";
    const node = zodToTs({
      schema: z.object({ username: z.string(), age: z.number() }),
      ...defaultCtx,
    });

    it("outputs correct typescript", () => {
      const typeAlias = createTypeAlias(node, identifier);
      expect(printNodeTest(typeAlias)).toMatchSnapshot();
    });

    it("optionally takes a comment", () => {
      const typeAlias = createTypeAlias(node, identifier, "A basic user");
      expect(printNodeTest(typeAlias)).toMatchSnapshot();
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

    it.each([
      { schema: z.nativeEnum(Color), feature: "numeric" },
      { schema: z.nativeEnum(Fruit), feature: "string" },
      { schema: z.nativeEnum(StringLiteral), feature: "quoted string" },
    ])("handles $feature literals", ({ schema }) => {
      expect(
        printNodeTest(zodToTs({ schema, ...defaultCtx }))
      ).toMatchSnapshot();
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

    const circular: z.ZodLazy<z.ZodTypeAny> = z.lazy(() =>
      z.object({
        a: z.string(),
        b: circular,
      })
    );

    const example = z.object({
      string: z.string(),
      number: z.number(),
      arrayOfObjects: z.array(
        z.object({
          string: z.string(),
        })
      ),
      boolean: z.boolean(),
      circular,
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
      record: z.record(
        z.object({
          object: z.object({
            arrayOfUnions: z
              .union([
                z.tuple([z.string(), z.object({ string: z.string() })]),
                z.bigint(),
              ])
              .array(),
          }),
        })
      ),
      map: z.map(z.string(), z.array(z.object({ string: z.string() }))),
      set: z.set(z.string()),
      intersection: z.intersection(z.string(), z.number()).or(z.bigint()),
      promise: z.promise(z.number()),
      function: z
        .function()
        .args(z.string().nullish().default("heo"), z.boolean(), z.boolean())
        .returns(z.string()),
      optDefaultString: z.string().optional().default("hi"),
      refinedStringWithSomeBullshit: z
        .string()
        .refine((val) => val.length > 10)
        .or(z.number())
        .and(z.bigint().nullish().default(1000n)),
      nativeEnum: z.nativeEnum(Fruits),
      lazy: z.lazy(() => z.string()),
      discUnion: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("circle"), radius: z.number() }),
        z.object({ kind: z.literal("square"), x: z.number() }),
        z.object({ kind: z.literal("triangle"), x: z.number(), y: z.number() }),
      ]),
      branded: z.string().brand("BRAND"),
      catch: z.number().catch(123),
      pipeline: z.string().regex(/\d+/).pipe(z.coerce.number()),
    });

    it("should produce the expected results", () => {
      const node = zodToTs({
        schema: example,
        ...defaultCtx,
      });
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

    it("outputs correct typescript", () => {
      const node = zodToTs({ schema: optionalStringSchema, ...defaultCtx });
      expect(printNodeTest(node)).toMatchSnapshot();
    });

    it("should output `?:` and undefined union for optional properties", () => {
      const node = zodToTs({ schema: objectWithOptionals, ...defaultCtx });
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });

  describe("z.nullable()", () => {
    const nullableUsernameSchema = z.object({
      username: z.string().nullable(),
    });
    const node = zodToTs({ schema: nullableUsernameSchema, ...defaultCtx });

    it("outputs correct typescript", () => {
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });

  describe("z.object()", () => {
    it("supports string literal properties", () => {
      const schema = z.object({
        "string-literal": z.string(),
        5: z.number(),
      });
      const node = zodToTs({ schema, ...defaultCtx });
      expect(printNodeTest(node)).toMatchSnapshot();
    });

    it("does not unnecessary quote identifiers", () => {
      const schema = z.object({
        id: z.string(),
        name: z.string(),
        countryOfOrigin: z.string(),
      });
      const node = zodToTs({ schema, ...defaultCtx });
      expect(printNodeTest(node)).toMatchSnapshot();
    });

    it("escapes correctly", () => {
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
      const node = zodToTs({ schema, ...defaultCtx });
      expect(printNodeTest(node)).toMatchSnapshot();
    });

    it("supports zod.describe()", () => {
      const schema = z.object({
        name: z.string().describe("The name of the item"),
        price: z.number().describe("The price of the item"),
      });
      const node = zodToTs({ schema, ...defaultCtx });
      expect(printNodeTest(node)).toMatchSnapshot();
    });
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
    const node = zodToTs({ schema: primitiveSchema, ...defaultCtx });

    it("outputs correct typescript", () => {
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });

  describe("z.discriminatedUnion()", () => {
    const shapeSchema = z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("circle"), radius: z.number() }),
      z.object({ kind: z.literal("square"), x: z.number() }),
      z.object({ kind: z.literal("triangle"), x: z.number(), y: z.number() }),
    ]);
    const node = zodToTs({ schema: shapeSchema, ...defaultCtx });

    it("outputs correct typescript", () => {
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });

  describe("z.literal()", () => {
    test.each([
      z.literal("test"),
      z.literal(true),
      z.literal(false),
      z.literal(123),
    ])("Should produce the correct typescript %#", (schema) => {
      expect(
        printNodeTest(zodToTs({ schema, ...defaultCtx }))
      ).toMatchSnapshot();
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
          printNodeTest(zodToTs({ schema, ...defaultCtx, isResponse }))
        ).toMatchSnapshot();
      });

      test("should handle unsupported transformation in response", () => {
        const schema = z.number().transform((num) => () => num);
        expect(
          printNodeTest(zodToTs({ schema, ...defaultCtx, isResponse: true }))
        ).toMatchSnapshot();
      });

      test("should handle an error within the transformation", () => {
        const schema = z.number().transform(() => {
          throw new Error("this should be handled");
        });
        expect(
          printNodeTest(zodToTs({ schema, ...defaultCtx, isResponse: true }))
        ).toMatchSnapshot();
      });
    });
  });
});
