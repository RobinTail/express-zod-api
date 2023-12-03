import { ZodUpload } from "./upload-schema";

describe("ZodUpload", () => {
  describe("static::create()", () => {
    test("should create an instance", () => {
      const schema = ZodUpload.create();
      expect(schema).toBeInstanceOf(ZodUpload);
      expect(schema._def.typeName).toEqual("ZodUpload");
    });
  });

  describe("_parse()", () => {
    test("should handle wrong parsed type", () => {
      const schema = ZodUpload.create();
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

    test("should accept UploadedFile", () => {
      const schema = ZodUpload.create();
      const buffer = Buffer.from("something");
      const result = schema.safeParse({
        name: "avatar.jpg",
        mv: jest.fn(async () => Promise.resolve()),
        encoding: "utf-8",
        mimetype: "image/jpeg",
        data: buffer,
        tempFilePath: "",
        truncated: false,
        size: 100500,
        md5: "",
      });
      expect(result).toMatchSnapshot();
    });
  });
});
