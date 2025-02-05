import { expectTypeOf } from "vitest";
import { z } from "zod";
import {
  FlatObject,
  Middleware,
  ResultHandler,
  testEndpoint,
  testMiddleware,
  EventStreamFactory,
  EndpointsFactory,
} from "../../src";
import {
  Emitter,
  ensureStream,
  formatEvent,
  makeEventSchema,
  makeMiddleware,
  makeResultHandler,
} from "../../src/sse";
import {
  makeLoggerMock,
  makeRequestMock,
  makeResponseMock,
} from "../../src/testing";
import { AbstractEndpoint } from "../../src/endpoint";

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
      expect(response.headersSent).toBeTruthy();
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

  describe("makeMiddleware()", () => {
    // with and without response.flush()
    test.each([vi.fn(), undefined])(
      "should create a Middleware providing options for emission %#",
      async (flushMock) => {
        const middleware = makeMiddleware({ test: z.string() });
        expect(middleware).toBeInstanceOf(Middleware);
        expectTypeOf(middleware).toEqualTypeOf<
          Middleware<FlatObject, Emitter<{ test: z.ZodString }>, string>
        >();
        const { output, responseMock } = await testMiddleware({ middleware });
        if (flushMock) responseMock.flush = flushMock;
        expect(output).toEqual({
          isClosed: expect.any(Function),
          emit: expect.any(Function),
        });
        const { isClosed, emit } = output as Emitter<{ test: z.ZodString }>;
        expect(isClosed()).toBeFalsy();
        emit("test", "something");
        expect(responseMock._getData()).toBe(
          `event: test\ndata: "something"\n\n`,
        );
        if (flushMock) expect(flushMock).toHaveBeenCalled();
        responseMock.end();
        expect(isClosed()).toBeTruthy();
      },
    );
  });

  describe("makeResultHandler()", () => {
    test("should create ResultHandler describing possible events and handling generic errors", () => {
      const resultHandler = makeResultHandler({
        test: z.string(),
        another: z.number(),
      });
      expect(resultHandler).toBeInstanceOf(ResultHandler);
      expect(resultHandler.getPositiveResponse(z.object({}))).toMatchSnapshot();
      expect(resultHandler.getNegativeResponse()).toMatchSnapshot();
      const positiveResponse = makeResponseMock();
      const commons = {
        input: {},
        output: {},
        options: {},
        request: makeRequestMock(),
        logger: makeLoggerMock(),
      };
      resultHandler.execute({
        ...commons,
        response: positiveResponse,
        error: null,
      });
      expect(positiveResponse.statusCode).toBe(200);
      expect(positiveResponse._getData()).toBe("");
      expect(positiveResponse.writableEnded).toBeTruthy();
      const negativeResponse = makeResponseMock();
      resultHandler.execute({
        ...commons,
        response: negativeResponse,
        error: new Error("failure"),
      });
      expect(negativeResponse.statusCode).toBe(500);
      expect(negativeResponse._getData()).toBe("failure");
      expect(negativeResponse.writableEnded).toBeTruthy();
    });
  });

  describe("EventStreamFactory()", () => {
    test("should inherit from EndpointsFactory", () => {
      expect(new EventStreamFactory({})).toBeInstanceOf(EndpointsFactory);
    });

    test("should combine SSE Middlware with corresponding ResultHandler and return Endpoint", async () => {
      const endpoint = new EventStreamFactory({ test: z.string() }).buildVoid({
        input: z.object({ some: z.string().optional() }),
        handler: async ({ input, options }) => {
          expectTypeOf(input).toMatchTypeOf<{ some?: string }>();
          expectTypeOf(options.emit)
            .parameter(0)
            .toEqualTypeOf("test" as const);
        },
      });
      expect(endpoint).toBeInstanceOf(AbstractEndpoint);
      const { responseMock } = await testEndpoint({ endpoint });
      expect(responseMock.statusCode).toBe(200);
      expect(responseMock.writableEnded).toBeTruthy();
    });
  });
});
