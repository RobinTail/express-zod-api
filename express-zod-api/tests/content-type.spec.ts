import { contentTypes, ContentType } from "../src/content-type";

describe("contentTypes", () => {
  test("should has predefined properties", () => {
    expect(contentTypes).toEqual({
      json: "application/json",
      upload: "multipart/form-data",
      raw: "application/octet-stream",
    });
  });
});

describe("ContentType", () => {
  test("should accept keys of contentTypes", () => {
    expectTypeOf<ContentType>().toEqualTypeOf<"json" | "upload" | "raw">();
  });
});
