import { z } from "zod/v4";
import { ez } from "../src";
import { ezUploadBrand } from "../src/upload-schema";

describe("ez.upload()", () => {
  describe("creation", () => {
    test("should create an instance", () => {
      const schema = ez.upload();
      expect(schema).toBeInstanceOf(z.ZodCustom);
      expect(schema._zod.bag).toHaveProperty("brand", ezUploadBrand);
    });
  });

  describe("parsing", () => {
    test("should handle wrong parsed type", () => {
      const schema = ez.upload();
      const result = schema.safeParse(123);
      expect(result.success).toBeFalsy();
      if (!result.success) {
        expect(result.error.issues).toEqual([
          {
            code: "custom",
            message: "Expected file upload, received number",
            path: [],
          },
        ]);
      }
    });

    test.each([vi.fn(async () => {}), vi.fn(() => {})])(
      "should accept UploadedFile %#",
      (mv) => {
        const schema = ez.upload();
        const buffer = Buffer.from("something");
        const result = schema.safeParse({
          name: "avatar.jpg",
          mv,
          encoding: "utf-8",
          mimetype: "image/jpeg",
          data: buffer,
          tempFilePath: "",
          truncated: false,
          size: 100500,
          md5: "",
        });
        expect(result).toMatchSnapshot();
      },
    );
  });
});
