import "../../src/zod-plugin"; // required for this test // @todo until import from index
import { z } from "zod";
import { ensureStream, formatEvent, makeEventSchema } from "../../src/sse";
import { makeResponseMock } from "../../src/testing";

describe("SSE", () => {
  describe("makeEventSchema()", () => {
    test("should make a valid schema of SSE event", () => {
      expect(makeEventSchema("test", z.string())).toMatchSnapshot();
    });
  });

  describe("formatEvent()", () => {
    test("should format a valid event into string", () => {
      expect(formatEvent({ test: z.string() }, "test", "something")).toBe(
        `event: test\ndata: "something"\n\n`,
      );
    });
    test("should withstand newlines", () => {
      expect(formatEvent({ test: z.string() }, "test", "some\ntext")).toBe(
        `event: test\ndata: "some\\ntext"\n\n`,
      );
    });
    test("should fail for unknown event", () => {
      expect(() =>
        formatEvent({ test: z.string() }, "another" as "test", "text"),
      ).toThrowError();
    });
    test("should fail for invalid data", () => {
      expect(() =>
        formatEvent({ test: z.string() }, "test", 123),
      ).toThrowError();
    });
  });

  describe("ensureStream()", () => {
    test("should set valid headers if they are not yet sent", () => {
      const response = makeResponseMock();
      ensureStream(response);
      expect(response.statusCode).toBe(200);
      // @todo enable when this one merged: https://github.com/eugef/node-mocks-http/issues/312
      // expect(response.headersSent).toBeTruthy();
      expect(response._getHeaders()).toEqual({
        connection: "keep-alive",
        "cache-control": "no-cache",
        "content-type": "text/event-stream",
      });
    });
    test("should do nothing when headers are already sent", () => {
      const response = makeResponseMock();
      response.headersSent = true;
      ensureStream(response);
      expect(response._getHeaders()).toEqual({});
    });
  });
});
