import { contentTypes } from "../../src/content-type";
import { describe, expect, test } from "vitest";

describe("contentTypes", () => {
  test("should has predefined properties", () => {
    expect(contentTypes).toEqual({
      json: "application/json",
      upload: "multipart/form-data",
      raw: "application/octet-stream",
    });
  });
});
