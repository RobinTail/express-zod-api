import { z } from "zod/v4";
import { ezFileBrand } from "../src/file-schema";
import { ez } from "../src";
import { readFile } from "node:fs/promises";

describe("ez.file()", () => {
  describe("creation", () => {
    test("should create an instance being string by default", () => {
      const schema = ez.file();
      expect(schema).toBeInstanceOf(z.ZodString);
      expect(schema._zod.bag).toHaveProperty("brand", ezFileBrand);
    });

    test("should create a string file", () => {
      const schema = ez.file("string");
      expect(schema).toBeInstanceOf(z.ZodString);
      expectTypeOf(schema._zod.output).toBeString();
    });

    test("should create a buffer file", () => {
      const schema = ez.file("buffer");
      expect(schema).toBeInstanceOf(z.ZodCustom);
      expectTypeOf(schema._zod.output).toExtend<Buffer>();
    });

    test("should create a binary file", () => {
      const schema = ez.file("binary");
      expect(schema).toBeInstanceOf(z.ZodUnion);
      expectTypeOf(schema._zod.output).toExtend<Buffer | string>();
    });

    test("should create a base64 file", () => {
      const schema = ez.file("base64");
      expect(schema).toBeInstanceOf(z.ZodBase64);
      expectTypeOf(schema._zod.output).toBeString();
    });
  });

  describe("parsing", () => {
    test.each([
      {
        schema: ez.file(),
        subject: 123,
        code: "invalid_type",
        expected: "string",
        message: "Invalid input: expected string, received number",
      },
      {
        schema: ez.file("buffer"),
        subject: "123",
        code: "custom",
        message: "Expected Buffer",
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
      const schema = ez.file("base64");
      const result = schema.safeParse("~~~~");
      expect(result.success).toBeFalsy();
      if (!result.success) expect(result.error.issues).toMatchSnapshot();
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
      const schema = ez.file("buffer");
      const subject = Buffer.from("test", "utf-8");
      const result = schema.safeParse(subject);
      expect(result).toEqual({
        success: true,
        data: subject,
      });
    });

    test("should accept binary read string", async () => {
      const schema = ez.file("binary");
      const data = await readFile("../logo.svg", "binary");
      const result = schema.safeParse(data);
      expect(result).toEqual({
        success: true,
        data,
      });
    });

    test("should accept base64 read string", async () => {
      const schema = ez.file("base64");
      const data = await readFile("../logo.svg", "base64");
      const result = schema.safeParse(data);
      expect(result).toEqual({
        success: true,
        data,
      });
    });
  });
});
