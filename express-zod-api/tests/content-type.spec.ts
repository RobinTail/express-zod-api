import { contentTypes } from "../src/content-type";

describe("contentTypes", () => {
  test("should has predefined properties", () => {
    expect(contentTypes).toEqual({
      form: "application/x-www-form-urlencoded",
      json: "application/json",
      upload: "multipart/form-data",
      raw: "application/octet-stream",
      sse: "text/event-stream",
    });
  });
});
