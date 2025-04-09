import cors from "cors";
import depd from "depd";
import express from "express";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import {
  EndpointsFactory,
  Method,
  createServer,
  defaultResultHandler,
  ResultHandler,
  BuiltinLogger,
  Middleware,
  ez,
} from "../../src";
import { givePort } from "../helpers";
import { setTimeout } from "node:timers/promises";

describe("App in production mode", async () => {
  vi.stubEnv("TSUP_STATIC", "production");
  vi.stubEnv("NODE_ENV", "production");
  const port = givePort();
  const logger = new BuiltinLogger({ level: "silent" });
  const infoMethod = vi.spyOn(logger, "info");
  const warnMethod = vi.spyOn(logger, "warn");
  const errorMethod = vi.spyOn(logger, "error");
  const corsedEndpoint = new EndpointsFactory(defaultResultHandler)
    .use(
      cors({
        credentials: true,
        exposedHeaders: ["Content-Range", "X-Content-Range"],
      }),
      { provider: () => ({ corsDone: true }) },
    )
    .build({
      method: "get",
      output: z.object({ corsDone: z.boolean() }),
      handler: async ({ options: { corsDone } }) => ({ corsDone }),
    });
  const faultyResultHandler = new ResultHandler({
    positive: z.object({}),
    negative: z.object({}),
    handler: () => assert.fail("I am faulty"),
  });
  const faultyMiddleware = new Middleware({
    input: z.object({
      mwError: z
        .any()
        .optional()
        .transform((value) =>
          assert(!value, "Custom error in the Middleware input validation"),
        ),
    }),
    handler: async () => ({}),
  });
  const faultyEndpoint = new EndpointsFactory(faultyResultHandler)
    .addMiddleware(faultyMiddleware)
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
      output: z.object({ test: z.string() }),
      handler: async () => ({ test: "Should not work" }),
    });
  const testEndpoint = new EndpointsFactory(defaultResultHandler)
    .addMiddleware({
      input: z.object({
        key: z.string().refine((v) => v === "123", "Invalid key"),
      }),
      handler: async () => ({ user: { id: 354 } }),
    })
    .addMiddleware({
      handler: async ({ request, options: { user } }) => ({
        method: request.method.toLowerCase() as Method,
        permissions: user.id === 354 ? ["any"] : [],
      }),
    })
    .build({
      methods: ["get", "post"],
      input: z.object({ something: z.string() }),
      output: z.object({ anything: z.number().positive() }).passthrough(), // allow excessive keys
      handler: async ({
        input: { key, something },
        options: { user, permissions, method },
      }) => {
        // Problem 787: should lead to ZodError that is NOT considered as the IOSchema validation error
        if (something === "internal_zod_error") z.number().parse("");
        return {
          anything: something === "joke" ? 300 : -100500,
          doubleKey: key.repeat(2),
          userId: user.id,
          permissions,
          method,
        };
      },
    });
  const longEndpoint = new EndpointsFactory(defaultResultHandler).build({
    method: "get",
    output: z.object({}),
    handler: async () => setTimeout(5000, {}),
  });
  const rawEndpoint = new EndpointsFactory(defaultResultHandler).build({
    method: "post",
    input: ez.raw(),
    output: z.object({ crc: z.number() }),
    handler: async ({ input: { raw } }) => ({ crc: raw.length }),
  });
  const uploadEndpoint = new EndpointsFactory(defaultResultHandler).build({
    method: "post",
    input: z.object({ avatar: ez.upload() }),
    output: z.object({}),
    handler: async () => ({}),
  });
  const routing = {
    v1: {
      corsed: corsedEndpoint,
      faulty: faultyEndpoint,
      test: testEndpoint,
      long: longEndpoint,
      raw: rawEndpoint,
      upload: uploadEndpoint,
    },
  };
  vi.spyOn(process.stdout, "write").mockImplementation(vi.fn()); // mutes logo output
  const server = (
    await createServer(
      {
        server: {
          listen: port,
          compression: { threshold: 1 },
          rawParser: express.raw({ limit: 20 }),
          upload: {
            beforeUpload: ({ request }) => {
              if ("trigger" in request.query)
                throw new Error("beforeUpload failure");
            },
          },
          beforeRouting: ({ app, getChildLogger }) => {
            depd("express")("Sample deprecation message");
            app.use((req, {}, next) => {
              const childLogger = getChildLogger(req);
              assert("isChild" in childLogger && childLogger.isChild);
              if (req.path === "/trigger/beforeRouting")
                return next(new Error("Failure of beforeRouting triggered"));
              next();
            });
          },
        },
        cors: false,
        startupLogo: true,
        gracefulShutdown: { events: ["FAKE"] },
        logger,
        childLoggerProvider: ({ parent }) =>
          Object.defineProperty(parent, "isChild", { value: true }),
        inputSources: {
          post: ["query", "body", "files"],
        },
      },
      routing,
    )
  ).httpServer;
  await vi.waitFor(() => assert(server.listening), { timeout: 1e4 });
  expect(warnMethod).toHaveBeenCalledWith(
    "DeprecationError (express): Sample deprecation message",
    expect.any(Array), // stack
  );

  afterAll(async () => {
    server.close();
    // this approach works better than .close() callback
    await vi.waitFor(() => assert(!server.listening), { timeout: 1e4 });
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
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

    test("Should handle raw request", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/v1/raw`, {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: Buffer.from("testing"),
      });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ status: "success", data: { crc: 7 } });
    });

    test("Should handle upload request", async () => {
      const filename = "logo.svg";
      const logo = await readFile(filename, "utf-8");
      const data = new FormData();
      data.append(
        "avatar",
        new Blob([logo], { type: "image/svg+xml" }),
        filename,
      );
      const response = await fetch(`http://localhost:${port}/v1/upload`, {
        method: "POST",
        body: data,
      });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ data: {}, status: "success" });
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
      expect(text).toBe("Internal Server Error");
      expect(errorMethod.mock.lastCall).toMatchSnapshot();
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
      expect(text).toBe("Internal Server Error");
      expect(errorMethod.mock.lastCall).toMatchSnapshot();
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
      expect(text).toBe("Internal Server Error");
      expect(errorMethod.mock.lastCall).toMatchSnapshot();
    });

    test("Should treat beforeRouting error as internal", async () => {
      const response = await fetch(
        `http://127.0.0.1:${port}/trigger/beforeRouting`,
      );
      expect(await response.json()).toEqual({
        status: "error",
        error: { message: "Internal Server Error" },
      });
      expect(response.status).toBe(500);
    });

    test("Should treat beforeUpload error as internal", async () => {
      const filename = "logo.svg";
      const logo = await readFile(filename, "utf-8");
      const data = new FormData();
      data.append(
        "avatar",
        new Blob([logo], { type: "image/svg+xml" }),
        filename,
      );
      const response = await fetch(
        `http://localhost:${port}/v1/upload?trigger=beforeUpload`,
        { method: "POST", body: data },
      );
      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json).toEqual({
        error: { message: "Internal Server Error" },
        status: "error",
      });
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

    test("Should handle JSON parser failures", async () => {
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

    test("Should handle Raw parser failures", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/v1/raw`, {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: Buffer.alloc(100),
      });
      expect(response.status).toBe(413);
      const json = await response.json();
      expect(json).toEqual({
        status: "error",
        error: { message: "request entity too large" },
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
      expect(errorMethod.mock.lastCall).toMatchSnapshot();
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
      expect(errorMethod.mock.lastCall).toMatchSnapshot();
    });
  });

  describe("Shutdown", () => {
    test("should terminate suspended request gracefully on signal", async () => {
      const spy = vi
        .spyOn(process, "exit")
        .mockImplementation(vi.fn<typeof process.exit>());
      fetch(`http://127.0.0.1:${port}/v1/long`).catch((err) =>
        expect(err).toHaveProperty("message", "fetch failed"),
      );
      await setTimeout(500);
      process.emit("FAKE" as "SIGTERM");
      expect(infoMethod).toHaveBeenCalledWith("Graceful shutdown", {
        sockets: expect.any(Number),
        timeout: 1000,
      });
      await setTimeout(1500);
      expect(server.listening).toBeFalsy();
      expect(spy).toHaveBeenCalled();
    });
  });
});
