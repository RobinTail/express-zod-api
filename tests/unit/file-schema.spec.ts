import { ZodFile } from "../../src/file-schema";
import { readFile } from "node:fs/promises";

describe("ZodFile", () => {
  describe("static::create()", () => {
    test("should create an instance", () => {
      const schema = ZodFile.create();
      expect(schema).toBeInstanceOf(ZodFile);
      expect(schema._def.encoding).toBeUndefined();
      expect(schema._def.typeName).toEqual("ZodFile");
      expect(schema.isBinary).toBeFalsy();
      expect(schema.isBase64).toBeFalsy();
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
    test("should handle wrong parsed type", () => {
      const schema = ZodFile.create();
      const result = schema.safeParse(123);
      expect(result.success).toBeFalsy();
      if (!result.success) {
        expect(result.error.issues).toEqual([
          {
            code: "invalid_type",
            expected: "string",
            message: "Expected string, received number",
            path: [],
            received: "number",
          },
        ]);
      }
    });

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
