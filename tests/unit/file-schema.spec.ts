import { ZodFile } from "../../src/file-schema";
import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

describe("ZodFile", () => {
  describe("static::create()", () => {
    test("should create an instance being string by default", () => {
      const schema = ZodFile.create();
      expect(schema).toBeInstanceOf(ZodFile);
      expect(schema._def.encoding).toBeUndefined();
      expect(schema._def.typeName).toEqual("ZodFile");
      expect(schema.isBinary).toBeFalsy();
      expect(schema.isBase64).toBeFalsy();
      expect(schema.isString).toBeTruthy();
      expect(schema.isBuffer).toBeFalsy();
    });
  });

  describe(".string()", () => {
    test("should create a string file", () => {
      const schema = ZodFile.create().string();
      expect(schema).toBeInstanceOf(ZodFile);
      expect(schema._def.encoding).toBeUndefined();
      expect(schema.isString).toBeTruthy();
      expect(schema.isBuffer).toBeFalsy();
    });
  });

  describe(".buffer()", () => {
    test("should create a buffer file", () => {
      const schema = ZodFile.create().buffer();
      expect(schema).toBeInstanceOf(ZodFile);
      expect(schema._def.encoding).toBeUndefined();
      expect(schema.isBuffer).toBeTruthy();
      expect(schema.isString).toBeFalsy();
    });
  });

  describe(".binary()", () => {
    test("should create a binary file", () => {
      const schema = ZodFile.create().binary("test message");
      expect(schema).toBeInstanceOf(ZodFile);
      expect(schema.isBinary).toBeTruthy();
      expect(schema._def.encoding).toBe("binary");
      expect(schema._def.message).toBe("test message");
    });
  });

  describe(".base64()", () => {
    test("should create a base64 file", () => {
      const schema = ZodFile.create().base64("test message");
      expect(schema).toBeInstanceOf(ZodFile);
      expect(schema.isBase64).toBeTruthy();
      expect(schema._def.encoding).toBe("base64");
      expect(schema._def.message).toBe("test message");
    });
  });

  describe("_parse()", () => {
    test.each([
      {
        schema: ZodFile.create(),
        subject: 123,
        expected: "string",
        received: "number",
        message: "Expected string, received number",
      },
      {
        schema: ZodFile.create().buffer(),
        subject: "123",
        expected: "object",
        received: "string",
        message: "Expected Buffer",
      },
    ])(
      "should invalidate wrong types",
      ({ schema, subject, expected, received, message }) => {
        const result = schema.safeParse(subject);
        expect(result.success).toBeFalsy();
        if (!result.success) {
          expect(result.error.issues).toEqual([
            {
              code: "invalid_type",
              expected,
              message,
              path: [],
              received,
            },
          ]);
        }
      },
    );

    test("should perform additional check for base64 file", () => {
      const schema = ZodFile.create().base64();
      const result = schema.safeParse("~~~~");
      expect(result.success).toBeFalsy();
      if (!result.success) {
        expect(result.error.issues).toEqual([
          {
            code: "custom",
            message: "Does not match base64 encoding",
            path: [],
          },
        ]);
      }
    });

    test("should accept string", () => {
      const schema = ZodFile.create();
      const result = schema.safeParse("some string");
      expect(result).toEqual({
        success: true,
        data: "some string",
      });
    });

    test("should accept Buffer", () => {
      const schema = ZodFile.create().buffer();
      const subject = Buffer.from("test", "utf-8");
      const result = schema.safeParse(subject);
      expect(result).toEqual({
        success: true,
        data: subject,
      });
    });

    test("should accept binary read string", async () => {
      const schema = ZodFile.create().binary();
      const data = await readFile("logo.svg", "binary");
      const result = schema.safeParse(data);
      expect(result).toEqual({
        success: true,
        data,
      });
    });

    test("should accept base64 read string", async () => {
      const schema = ZodFile.create().base64();
      const data = await readFile("logo.svg", "base64");
      const result = schema.safeParse(data);
      expect(result).toEqual({
        success: true,
        data,
      });
    });
  });
});
