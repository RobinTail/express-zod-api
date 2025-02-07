import { contentTypes } from "../../express-zod-api/src/content-type";

describe("contentTypes", () => {
  test("should has predefined properties", () => {
    expect(contentTypes).toEqual({
      json: "application/json",
      upload: "multipart/form-data",
      raw: "application/octet-stream",
      sse: "text/event-stream",
    });
  });
});
