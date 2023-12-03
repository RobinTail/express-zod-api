import { mimeJson, mimeMultipart, mimeRaw } from "./mime";

describe("Mime", () => {
  test("should export predefined types", () => {
    expect(mimeJson).toBe("application/json");
    expect(mimeMultipart).toBe("multipart/form-data");
    expect(mimeRaw).toBe("application/octet-stream");
  });
});
