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

import { NewLineKind, Node } from "typescript";
import { z } from "../../src";
import { zodToTs } from "../../src/zts";
import { createTypeAlias, printNode } from "../../src/zts-utils";

describe("zod-to-ts", () => {
  const printNodeTest = (node: Node) =>
    printNode(node, { newLine: NewLineKind.LineFeed });

  describe("z.array()", () => {
    it("outputs correct typescript", () => {
      const node = zodToTs({
        schema: z.object({ id: z.number(), value: z.string() }).array(),
        identifier: "User",
      });
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });

  describe("createTypeAlias()", () => {
    const identifier = "User";
    const node = zodToTs({
      schema: z.object({ username: z.string(), age: z.number() }),
      identifier,
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

    it("handles numeric literals with resolveNativeEnums", () => {
      const node = zodToTs({ schema: z.nativeEnum(Color) });
      expect(printNodeTest(node)).toMatchSnapshot();
    });

    it("handles string literals with resolveNativeEnums", () => {
      const node = zodToTs({ schema: z.nativeEnum(Fruit) });
      expect(printNodeTest(node)).toMatchSnapshot();
    });

    it("handles string literal properties", () => {
      const node = zodToTs({ schema: z.nativeEnum(StringLiteral) });
      expect(printNodeTest(node)).toMatchSnapshot();
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

    const example2 = z.object({
      a: z.string(),
      b: z.number(),
      c: z.array(z.string()).nonempty().length(10),
      d: z.object({
        e: z.string(),
      }),
    });

    const pickedSchema = example2.partial();

    const nativeEnum = z.nativeEnum(Fruits);

    type ELazy = {
      a: string;
      b: ELazy;
    };

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const eLazy: z.ZodSchema<ELazy> = z.lazy(() => e3);

    const e3 = z.object({
      a: z.string(),
      b: eLazy,
    });

    const example = z.object({
      a: z.string(),
      b: z.number(),
      c: z.array(
        z.object({
          a: z.string(),
        })
      ),
      d: z.boolean(),
      e: eLazy,
      f: z.union([z.object({ a: z.number() }), z.literal("hi")]),
      g: z.enum(["hi", "bye"]),
      h: z
        .number()
        .and(z.bigint())
        .and(z.number().and(z.string()))
        .transform((arg) => console.log(arg)),
      i: z.date(),
      j: z.undefined(),
      k: z.null(),
      l: z.void(),
      m: z.any(),
      n: z.unknown(),
      o: z.never(),
      p: z.optional(z.string()),
      q: z.nullable(pickedSchema),
      r: z.tuple([z.string(), z.number(), z.object({ name: z.string() })]),
      s: z.record(
        z.object({
          de: z.object({
            me: z
              .union([
                z.tuple([z.string(), z.object({ a: z.string() })]),
                z.bigint(),
              ])
              .array(),
          }),
        })
      ),
      t: z.map(z.string(), z.array(z.object({ p: z.string() }))),
      u: z.set(z.string()),
      v: z.intersection(z.string(), z.number()).or(z.bigint()),
      w: z.promise(z.number()),
      x: z
        .function()
        .args(z.string().nullish().default("heo"), z.boolean(), z.boolean())
        .returns(z.string()),
      y: z.string().optional().default("hi"),
      z: z
        .string()
        .refine((val) => val.length > 10)
        .or(z.number())
        .and(z.bigint().nullish().default(1000n)),
      aa: nativeEnum,
      cc: z.lazy(() => z.string()),
      dd: z.nativeEnum(Fruits),
      ee: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("circle"), radius: z.number() }),
        z.object({ kind: z.literal("square"), x: z.number() }),
        z.object({ kind: z.literal("triangle"), x: z.number(), y: z.number() }),
      ]),
    });

    it("should produce the expected results", () => {
      const node = zodToTs({
        schema: example,
        identifier: "Example",
      });
      expect(printNode(node)).toMatchSnapshot();
    });
  });

  describe("z.function()", () => {
    it("prints correct typescript", () => {
      const schema = z
        .function()
        .args(z.string().nullish().default("name"), z.boolean(), z.boolean())
        .returns(z.string());
      const node = zodToTs({ schema, identifier: "Function" });
      expect(printNodeTest(node)).toMatchSnapshot();
    });

    it("prints correct typescript 2", () => {
      const schema = z
        .function()
        .args(
          z.object({ name: z.string(), price: z.number(), comment: z.string() })
        )
        .describe("create an item");
      const node = zodToTs({ schema });
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });

  describe("z.optional()", () => {
    const OptionalStringSchema = z.string().optional();
    const ObjectWithOptionals = z.object({
      optional: OptionalStringSchema,
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
      const node = zodToTs({ schema: OptionalStringSchema });
      expect(printNodeTest(node)).toMatchSnapshot();
    });

    it("should output `?:` and undefined union for optional properties", () => {
      const node = zodToTs({ schema: ObjectWithOptionals });
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });

  describe("z.nullable()", () => {
    const NullableUsernameSchema = z.object({
      username: z.string().nullable(),
    });
    const node = zodToTs({ schema: NullableUsernameSchema });

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
      const node = zodToTs({ schema });
      expect(printNodeTest(node)).toMatchSnapshot();
    });

    it("does not unnecessary quote identifiers", () => {
      const schema = z.object({
        id: z.string(),
        name: z.string(),
        countryOfOrigin: z.string(),
      });
      const node = zodToTs({ schema });
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
      const node = zodToTs({ schema });
      expect(printNodeTest(node)).toMatchSnapshot();
    });

    it("supports zod.describe()", () => {
      const schema = z.object({
        name: z.string().describe("The name of the item"),
        price: z.number().describe("The price of the item"),
      });
      const node = zodToTs({ schema });
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });

  describe("PrimitiveSchema", () => {
    const PrimitiveSchema = z.object({
      username: z.string(),
      age: z.number(),
      isAdmin: z.boolean(),
      createdAt: z.date(),
      undef: z.undefined(),
      nu: z.null(),
      vo: z.void(),
      an: z.any(),
      unknown: z.unknown(),
      nev: z.never(),
    });
    const node = zodToTs({ schema: PrimitiveSchema, identifier: "User" });

    it("outputs correct typescript", () => {
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });

  describe("z.discriminatedUnion()", () => {
    const ShapeSchema = z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("circle"), radius: z.number() }),
      z.object({ kind: z.literal("square"), x: z.number() }),
      z.object({ kind: z.literal("triangle"), x: z.number(), y: z.number() }),
    ]);
    const node = zodToTs({ schema: ShapeSchema, identifier: "Shape" });

    it("outputs correct typescript", () => {
      expect(printNodeTest(node)).toMatchSnapshot();
    });
  });
});
