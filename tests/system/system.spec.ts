import cors from "cors";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  EndpointsFactory,
  Method,
  createServer,
  defaultResultHandler,
  ResultHandler,
} from "../../src";
import { givePort, waitFor } from "../helpers";
import { afterAll, describe, expect, test, vi } from "vitest";

describe("App", async () => {
  const port = givePort();

  const routing = {
    v1: {
      corsed: new EndpointsFactory(defaultResultHandler)
        .use(
          cors({
            credentials: true,
            exposedHeaders: ["Content-Range", "X-Content-Range"],
          }),
          {
            provider: () => ({ corsDone: true }),
          },
        )
        .build({
          method: "get",
          input: z.object({}),
          output: z.object({ corsDone: z.boolean() }),
          handler: async ({ options }) => ({
            corsDone: options.corsDone,
          }),
        }),
      faulty: new EndpointsFactory(
        new ResultHandler({
          positive: z.object({}),
          negative: z.object({}),
          handler: () => assert.fail("I am faulty"),
        }),
      )
        .addMiddleware({
          input: z.object({
            mwError: z
              .any()
              .optional()
              .transform((value) =>
                assert(
                  !value,
                  "Custom error in the Middleware input validation",
                ),
              ),
          }),
          handler: async () => ({}),
        })
        .build({
          method: "get",
          input: z.object({
            epError: z
              .any()
              .optional()
              .transform((value) =>
                assert(!value, "Custom error in the Endpoint input validation"),
              ),
          }),
          output: z.object({
            test: z.string(),
          }),
          handler: async () => ({
            test: "Should not work",
          }),
        }),
      test: new EndpointsFactory(defaultResultHandler)
        .addMiddleware({
          input: z.object({
            key: z.string().refine((v) => v === "123", "Invalid key"),
          }),
          handler: async () => ({
            user: {
              id: 354,
            },
          }),
        })
        .addMiddleware({
          input: z.object({}),
          handler: async ({ request, options: { user } }) => ({
            method: request.method.toLowerCase() as Method,
            permissions: user.id === 354 ? ["any"] : [],
          }),
        })
        .build({
          methods: ["get", "post"],
          input: z.object({
            something: z.string(),
          }),
          output: z
            .object({
              anything: z.number().positive(),
            })
            .passthrough(), // allow excessive keys
          handler: async ({
            input: { key, something },
            options: { user, permissions, method },
          }) => {
            // Problem 787: should lead to ZodError that is NOT considered as the IOSchema validation error
            if (something === "internal_zod_error") {
              z.number().parse("");
            }
            return {
              anything: something === "joke" ? 300 : -100500,
              doubleKey: key.repeat(2),
              userId: user.id,
              permissions,
              method,
            };
          },
        }),
    },
  };
  vi.spyOn(global.console, "log").mockImplementation(vi.fn());
  const server = (
    await createServer(
      {
        server: {
          listen: port,
          compression: { threshold: 1 },
        },
        cors: false,
        startupLogo: true,
        logger: { level: "silent" },
        inputSources: {
          post: ["query", "body", "files"],
        },
      },
      routing,
    )
  ).httpServer;
  await waitFor(() => server.listening);

  afterAll(async () => {
    server.close();
    // this approach works better than .close() callback
    await waitFor(() => !server.listening);
    vi.restoreAllMocks();
  });

  describe("Positive", () => {
    test("Should handle valid GET request", async () => {
      const response = await fetch(
        `http://127.0.0.1:${port}/v1/test?key=123&something=joke`,
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        status: "success",
        data: {
          anything: 300,
          doubleKey: "123123",
          userId: 354,
          permissions: ["any"],
          method: "get",
        },
      });
    });

    test("Should handle valid POST request", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/v1/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "123",
          something: "joke",
        }),
      });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        status: "success",
        data: {
          anything: 300,
          doubleKey: "123123",
          userId: 354,
          permissions: ["any"],
          method: "post",
        },
      });
    });

    test("Issue 158: should use query for POST on demand", async () => {
      const response = await fetch(
        `http://127.0.0.1:${port}/v1/test?key=123&something=joke`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        status: "success",
        data: {
          anything: 300,
          doubleKey: "123123",
          userId: 354,
          permissions: ["any"],
          method: "post",
        },
      });
    });

    test("Should compress the response in case it is supported by client", async () => {
      const response = await fetch(
        `http://127.0.0.1:${port}/v1/test?key=123&something=joke`,
        {
          headers: {
            "Accept-Encoding": "gzip, deflate",
          },
        },
      );
      expect(response.status).toBe(200);
      console.log(response.headers);
      expect(response.headers.get("Content-Encoding")).toBe("gzip");
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });

    test("Should execute native express middleware", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/v1/corsed`, {
        method: "GET",
      });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        status: "success",
        data: { corsDone: true },
      });
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
        "true",
      );
      expect(response.headers.get("Access-Control-Expose-Headers")).toBe(
        "Content-Range,X-Content-Range",
      );
    });
  });

  describe("Negative", () => {
    test("Should call Last Resort Handler in case of faulty ResultHandler", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/v1/faulty`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      expect(response.status).toBe(500);
      expect(response.headers.get("content-type")).toBe(
        "text/plain; charset=utf-8",
      );
      const text = await response.text();
      expect(text).toBe(
        "An error occurred while serving the result: I am faulty.",
      );
    });

    test("Should treat custom errors in middleware input validations as they are", async () => {
      const response = await fetch(
        `http://127.0.0.1:${port}/v1/faulty?mwError=1`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toBe(
        "An error occurred while serving the result: I am faulty.\n" +
          "Original error: Custom error in the Middleware input validation.",
      );
    });

    test("Should treat custom errors in endpoint input validations as they are", async () => {
      const response = await fetch(
        `http://127.0.0.1:${port}/v1/faulty?epError=1`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toBe(
        "An error occurred while serving the result: I am faulty.\n" +
          "Original error: Custom error in the Endpoint input validation.",
      );
    });
  });

  describe("Protocol", () => {
    test("Should fail on invalid method", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/v1/test`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "123",
          something: "joke",
        }),
      });
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });

    test("Should fail on malformed body", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/v1/test`, {
        method: "POST", // valid method this time
        headers: {
          "Content-Type": "application/json",
        },
        body: '{"key": "123", "something', // no closing bracket
      });
      expect(response.status).toBe(400); // Issue #907
      const json = await response.json();
      expect(json).toMatchSnapshot({
        error: {
          message: expect.stringMatching(
            // @todo revisit when Node 18 dropped
            // the 2nd option is for Node 20+
            /(Unexpected end of JSON input|Unterminated string in JSON at position 25)/,
          ),
        },
      });
    });

    test("Should fail when missing content type header", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/v1/test`, {
        method: "POST",
        body: JSON.stringify({
          key: "123",
          something: "joke",
        }),
      });
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });
  });

  describe("Validation", () => {
    test("Should fail on middleware input type mismatch", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/v1/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: 123,
          something: "joke",
        }),
      });
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });

    test("Should fail on middleware refinement mismatch", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/v1/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "456",
          something: "joke",
        }),
      });
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });

    test("Should fail on handler input type mismatch", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/v1/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "123",
          something: 123,
        }),
      });
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });

    test("Should fail on handler output type mismatch", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/v1/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "123",
          something: "gimme fail",
        }),
      });
      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });

    test("Problem 787: Should NOT treat ZodError thrown from within the handler as IOSchema validation error", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/v1/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "123",
          something: "internal_zod_error",
        }),
      });
      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });
  });
});
