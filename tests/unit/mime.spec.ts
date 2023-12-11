import { mimeJson, mimeMultipart, mimeRaw } from "../../src/mime";
import { describe, expect, test } from "vitest";

describe("Mime", () => {
  test("should export predefined types", () => {
    expect(mimeJson).toBe("application/json");
    expect(mimeMultipart).toBe("multipart/form-data");
    expect(mimeRaw).toBe("application/octet-stream");
  });
});
