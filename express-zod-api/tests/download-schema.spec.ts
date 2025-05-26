import { z } from "zod/v4";
import { ezDownloadBrand } from "../src/download-schema";
import { ez } from "../src";
import { readFile } from "node:fs/promises";
import { getBrand } from "../src/metadata";

describe("ez.download()", () => {
  describe("creation", () => {
    test("should create an instance being string by default", () => {
      const schema = ez.download();
      expect(schema).toBeInstanceOf(z.ZodString);
      expect(getBrand(schema)).toBe(ezDownloadBrand);
    });

    test("should create a string download", () => {
      const schema = ez.download("string");
      expect(schema).toBeInstanceOf(z.ZodString);
      expectTypeOf(schema._zod.output).toBeString();
    });

    test("should create a buffer download", () => {
      const schema = ez.download("buffer");
      expect(schema).toBeInstanceOf(z.ZodCustom);
      expectTypeOf(schema._zod.output).toExtend<Buffer>();
    });

    test("should create a binary download", () => {
      const schema = ez.download("binary");
      expect(schema).toBeInstanceOf(z.ZodUnion);
      expectTypeOf(schema._zod.output).toExtend<Buffer | string>();
    });

    test("should create a base64 download", () => {
      const schema = ez.download("base64");
      expect(schema).toBeInstanceOf(z.ZodBase64);
      expectTypeOf(schema._zod.output).toBeString();
    });
  });

  describe("parsing", () => {
    test.each([
      {
        schema: ez.download(),
        subject: 123,
        code: "invalid_type",
        expected: "string",
        message: "Invalid input: expected string, received number",
      },
      {
        schema: ez.download("buffer"),
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

    test("should perform additional check for base64 download", () => {
      const schema = ez.download("base64");
      const result = schema.safeParse("~~~~");
      expect(result.success).toBeFalsy();
      if (!result.success) expect(result.error.issues).toMatchSnapshot();
    });

    test("should accept string", () => {
      const schema = ez.download();
      const result = schema.safeParse("some string");
      expect(result).toEqual({
        success: true,
        data: "some string",
      });
    });

    test("should accept Buffer", () => {
      const schema = ez.download("buffer");
      const subject = Buffer.from("test", "utf-8");
      const result = schema.safeParse(subject);
      expect(result).toEqual({
        success: true,
        data: subject,
      });
    });

    test("should accept binary read string", async () => {
      const schema = ez.download("binary");
      const data = await readFile("../logo.svg", "binary");
      const result = schema.safeParse(data);
      expect(result).toEqual({
        success: true,
        data,
      });
    });

    test("should accept base64 read string", async () => {
      const schema = ez.download("base64");
      const data = await readFile("../logo.svg", "base64");
      const result = schema.safeParse(data);
      expect(result).toEqual({
        success: true,
        data,
      });
    });
  });
});
