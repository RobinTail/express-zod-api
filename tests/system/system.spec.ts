import cors from "cors";
import http from "http";
import fetch from "node-fetch";
import {
  createServer,
  EndpointsFactory,
  Method,
  z,
  defaultResultHandler,
  createResultHandler,
  createApiResponse,
} from "../../src";
import { waitFor } from "../helpers";

describe("App", () => {
  let server: http.Server;

  beforeAll(() => {
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
            }
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
          createResultHandler({
            getPositiveResponse: () => createApiResponse(z.object({})),
            getNegativeResponse: () => createApiResponse(z.object({})),
            handler: () => {
              throw new Error("I am faulty");
            },
          })
        ).build({
          method: "get",
          input: z.object({}),
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
            middleware: async () => ({
              user: {
                id: 354,
              },
            }),
          })
          .addMiddleware({
            input: z.object({}),
            middleware: async ({ request, options: { user } }) => ({
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
            }) => ({
              anything: something === "joke" ? 300 : -100500,
              doubleKey: key.repeat(2),
              userId: user.id,
              permissions,
              method,
            }),
          }),
      },
    };
    jest.spyOn(global.console, "log").mockImplementation(jest.fn());
    server = createServer(
      {
        server: {
          listen: 8055,
          compression: { threshold: 1 },
        },
        cors: false,
        startupLogo: true,
        logger: {
          level: "silent",
          color: false,
        },
        inputSources: {
          post: ["query", "body", "files"],
        },
      },
      routing
    ).httpServer;
  });

  afterAll(async () => {
    server.close();
    // this approach works better than .close() callback
    await waitFor(() => !server.listening);
    jest.restoreAllMocks();
  });

  describe("Positive", () => {
    test("Is listening", () => {
      expect(server.listening).toBeTruthy();
    });

    test("Should handle valid GET request", async () => {
      const response = await fetch(
        "http://127.0.0.1:8055/v1/test?key=123&something=joke"
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
      const response = await fetch("http://127.0.0.1:8055/v1/test", {
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
        "http://127.0.0.1:8055/v1/test?key=123&something=joke",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
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
        "http://127.0.0.1:8055/v1/test?key=123&something=joke",
        {
          headers: {
            "Accept-Encoding": "gzip, deflate",
          },
        }
      );
      expect(response.status).toBe(200);
      console.log(response.headers);
      expect(response.headers.get("Content-Encoding")).toBe("gzip");
      const json = await response.json();
      expect("status" in json).toBeTruthy();
      expect(json.status).toBe("success");
    });

    test("Should execute native express middleware", async () => {
      const response = await fetch("http://127.0.0.1:8055/v1/corsed", {
        method: "GET",
      });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        status: "success",
        data: { corsDone: true },
      });
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
        "true"
      );
      expect(response.headers.get("Access-Control-Expose-Headers")).toBe(
        "Content-Range,X-Content-Range"
      );
    });
  });

  describe("Negative", () => {
    test("Should call Last Resort Handler in case of faulty ResultHandler", async () => {
      const response = await fetch("http://127.0.0.1:8055/v1/faulty", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toBe(
        "An error occurred while serving the result: I am faulty."
      );
    });
  });

  describe("Protocol", () => {
    test("Should fail on invalid method", async () => {
      const response = await fetch("http://127.0.0.1:8055/v1/test", {
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
      const response = await fetch("http://127.0.0.1:8055/v1/test", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: '{"key": "123", "something',
      });
      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });

    test("Should fail when missing content type header", async () => {
      const response = await fetch("http://127.0.0.1:8055/v1/test", {
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
      const response = await fetch("http://127.0.0.1:8055/v1/test", {
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
      const response = await fetch("http://127.0.0.1:8055/v1/test", {
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
      const response = await fetch("http://127.0.0.1:8055/v1/test", {
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
      const response = await fetch("http://127.0.0.1:8055/v1/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "123",
          something: "gimme fail",
        }),
      });
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });
  });
});
