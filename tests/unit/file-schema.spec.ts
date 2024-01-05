import { z } from "zod";
import { getMeta } from "../../src/metadata";
import * as ez from "../../src/proprietary-schemas";
import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

describe("ez.file()", () => {
  describe("creation", () => {
    test("should create an instance being string by default", () => {
      const schema = ez.file();
      expect(schema).toBeInstanceOf(z.ZodString);
      // expect(schema._def.encoding).toBeUndefined();
      expect(getMeta(schema, "proprietaryKind")).toBe("ZodFile");
      /*
      expect(schema.isBinary).toBeFalsy();
      expect(schema.isBase64).toBeFalsy();
      expect(schema.isString).toBeTruthy();
      expect(schema.isBuffer).toBeFalsy();*/
    });
  });

  describe(".string()", () => {
    test("should create a string file", () => {
      const schema = ez.file("string"); //.string();
      expect(schema).toBeInstanceOf(z.ZodString);
      /*
      expect(schema._def.encoding).toBeUndefined();
      expect(schema.isString).toBeTruthy();
      expect(schema.isBuffer).toBeFalsy();*/
    });
  });

  describe(".buffer()", () => {
    test("should create a buffer file", () => {
      const schema = ez.file("buffer"); //.buffer();
      expect(schema).toBeInstanceOf(z.ZodEffects);
      /*
      expect(schema._def.encoding).toBeUndefined();
      expect(schema.isBuffer).toBeTruthy();
      expect(schema.isString).toBeFalsy();*/
    });
  });

  describe(".binary()", () => {
    test("should create a binary file", () => {
      const schema = ez.file("binary"); //.binary("test message");
      expect(schema).toBeInstanceOf(z.ZodString);
      /*
      expect(schema.isBinary).toBeTruthy();
      expect(schema._def.encoding).toBe("binary");
      expect(schema._def.message).toBe("test message");*/
    });
  });

  describe(".base64()", () => {
    test("should create a base64 file", () => {
      const schema = ez.file("base64"); // .base64("test message");
      expect(schema).toBeInstanceOf(z.ZodString);
      /*
      expect(schema.isBase64).toBeTruthy();
      expect(schema._def.encoding).toBe("base64");
      expect(schema._def.message).toBe("test message");*/
    });
  });

  describe("parsing", () => {
    test.each([
      {
        schema: ez.file(),
        subject: 123,
        code: "invalid_type",
        expected: "string",
        received: "number",
        message: "Expected string, received number",
      },
      {
        schema: ez.file("buffer"), // .buffer(),
        subject: "123",
        code: "custom",
        message: "Expected Buffer",
        fatal: true,
      },
    ])(
      "should invalidate wrong types",
      ({ schema, subject, ...expectedError }) => {
        const result = schema.safeParse(subject);
        expect(result.success).toBeFalsy();
        if (!result.success) {
          expect(result.error.issues).toEqual([
            {
              ...expectedError,
              path: [],
            },
          ]);
        }
      },
    );

    test("should perform additional check for base64 file", () => {
      const schema = ez.file("base64"); //.base64();
      const result = schema.safeParse("~~~~");
      expect(result.success).toBeFalsy();
      if (!result.success) {
        expect(result.error.issues).toEqual([
          {
            code: "invalid_string",
            message: "Does not match base64 encoding",
            validation: "regex",
            path: [],
          },
        ]);
      }
    });

    test("should accept string", () => {
      const schema = ez.file();
      const result = schema.safeParse("some string");
      expect(result).toEqual({
        success: true,
        data: "some string",
      });
    });

    test("should accept Buffer", () => {
      const schema = ez.file("buffer"); //.buffer();
      const subject = Buffer.from("test", "utf-8");
      const result = schema.safeParse(subject);
      expect(result).toEqual({
        success: true,
        data: subject,
      });
    });

    test("should accept binary read string", async () => {
      const schema = ez.file("binary"); //.binary();
      const data = await readFile("logo.svg", "binary");
      const result = schema.safeParse(data);
      expect(result).toEqual({
        success: true,
        data,
      });
    });

    test("should accept base64 read string", async () => {
      const schema = ez.file("base64"); // .base64();
      const data = await readFile("logo.svg", "base64");
      const result = schema.safeParse(data);
      expect(result).toEqual({
        success: true,
        data,
      });
    });
  });
});
