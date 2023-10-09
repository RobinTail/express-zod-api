import { mimeJson, mimeMultipart } from "../../src/mime";

describe("Mime", () => {
  test("should export predefined types", () => {
    expect(mimeJson).toEqual("application/json");
    expect(mimeMultipart).toEqual("multipart/form-data");
  });
});
