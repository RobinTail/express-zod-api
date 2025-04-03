import { contentTypes } from "../src/content-type";

describe("contentTypes", () => {
  test("should have predefined properties", () => {
    expect(contentTypes).toEqual({
      json: "application/json",
      multipart: "multipart/form-data",
      raw: "application/octet-stream",
      sse: "text/event-stream",
    });
  });
});
