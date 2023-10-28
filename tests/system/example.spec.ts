import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { expectType } from "tsd";
import { config } from "../../example/config";
import {
  ExpressZodAPIClient,
  Implementation,
  jsonEndpoints,
} from "../../example/example.client";
import { mimeMultipart } from "../../src/mime";
import { waitFor } from "../helpers";
import { createHash } from "node:crypto";
import FormData from "form-data";
import { readFile } from "node:fs/promises";

describe("Example", () => {
  let example: ChildProcessWithoutNullStreams;
  let out = "";
  const listener = (chunk: Buffer) => {
    out += chunk.toString();
  };

  beforeAll(() => {
    example = spawn("node", ["-r", "@swc-node/register", "example/index.ts"]);
    example.stdout.on("data", listener);
  });

  afterAll(async () => {
    example.stdout.removeListener("data", listener);
    example.kill();
    await waitFor(() => example.killed);
  });

  afterEach(() => {
    out = "";
  });

  describe("Positive", () => {
    test("Should listen", async () => {
      await waitFor(() => /Listening 8090/.test(out));
      expect(true).toBeTruthy();
    });

    test("Should handle OPTIONS request", async () => {
      const response = await fetch("http://localhost:8090/v1/user/100", {
        method: "OPTIONS",
      });
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe("");
      expect(response.headers).toBeTruthy();
      expect(response.headers.has("access-control-allow-origin")).toBeTruthy();
      expect(response.headers.has("access-control-allow-methods")).toBeTruthy();
      expect(response.headers.has("access-control-allow-headers")).toBeTruthy();
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("access-control-allow-methods")).toBe(
        "POST, OPTIONS",
      );
      expect(response.headers.get("access-control-allow-headers")).toBe(
        "content-type",
      );
    });

    test("Should handle valid POST request", async () => {
      const response = await fetch("http://localhost:8090/v1/user/50", {
        method: "POST",
        headers: {
          token: "456",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "123",
          name: "John Doe",
          birthday: "1974-10-28",
        }),
      });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toMatchObject({
        status: "success",
        data: {
          name: "John Doe",
          createdAt: "2022-01-22T00:00:00.000Z",
        },
      });
      await waitFor(() => /v1\/user/.test(out));
      await waitFor(() => /50, 123, 456/.test(out));
      expect(true).toBeTruthy();
    });

    test("Should handle valid GET request", async () => {
      const response = await fetch(
        "http://localhost:8090/v1/user/retrieve?test=123&id=50",
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        status: "success",
        data: {
          id: 50,
          name: "John Doe",
          features: [
            {
              title: "Tall",
              features: [{ title: "Above 180cm", features: [] }],
            },
            { title: "Young", features: [] },
            {
              title: "Cute",
              features: [
                {
                  title: "Tells funny jokes",
                  features: [{ title: "About Typescript", features: [] }],
                },
              ],
            },
          ],
        },
      });
      await waitFor(() => /v1\/user\/retrieve/.test(out));
      await waitFor(() => /50, method get/.test(out));
      expect(true).toBeTruthy();
    });

    test("Should respond with array (legacy API ResultHandler)", async () => {
      const response = await fetch("http://localhost:8090/v1/user/list");
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual([
        { name: "Maria Merian" },
        { name: "Mary Anning" },
        { name: "Marie Skłodowska Curie" },
        { name: "Henrietta Leavitt" },
        { name: "Lise Meitner" },
        { name: "Alice Ball" },
        { name: "Gerty Cori" },
        { name: "Helen Taussig" },
      ]);
    });

    test("Should send an image with a correct header", async () => {
      const response = await fetch(
        "http://localhost:8090/v1/avatar/send?userId=123",
      );
      expect(response.status).toBe(200);
      expect(response.headers.has("Content-type")).toBeTruthy();
      expect(response.headers.get("Content-type")).toBe(
        "image/svg+xml; charset=utf-8",
      );
      expect(response.headers.has("Content-encoding")).toBeTruthy();
      expect(response.headers.get("Content-encoding")).toBe("gzip");
      expect(response.headers.has("Transfer-encoding")).toBeTruthy();
      expect(response.headers.get("Transfer-encoding")).toBe("chunked");
      const hash = createHash("sha1")
        .update(await response.text())
        .digest("hex");
      expect(hash).toMatchSnapshot();
    });

    test("Should stream an image with a correct header", async () => {
      const response = await fetch(
        "http://localhost:8090/v1/avatar/stream?userId=123",
      );
      expect(response.status).toBe(200);
      expect(response.headers.has("Content-type")).toBeTruthy();
      expect(response.headers.get("Content-type")).toBe("image/svg+xml");
      expect(response.headers.has("Transfer-encoding")).toBeTruthy();
      expect(response.headers.get("Transfer-encoding")).toBe("chunked");
      const hash = createHash("sha1")
        .update(await response.text())
        .digest("hex");
      expect(hash).toMatchSnapshot();
    });

    test("Should serve static files", async () => {
      const response = await fetch("http://localhost:8090/public/logo.svg");
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-type")).toBe("image/svg+xml");
      const hash = createHash("sha1")
        .update(await response.text())
        .digest("hex");
      expect(hash).toMatchSnapshot();
    });

    test("Should upload the file", async () => {
      const filename = "logo.svg";
      const logo = await readFile(filename, "utf-8");
      const data = new FormData();
      data.append("avatar", logo, { filename });
      data.append("str", "test string value");
      data.append("num", 123);
      data.append("arr[0]", 456);
      data.append("arr[1]", 789);
      data.append("obj[some]", "thing");
      const response = await fetch("http://localhost:8090/v1/avatar/upload", {
        method: "POST",
        headers: {
          "Content-Type": `${mimeMultipart}; boundary=${data.getBoundary()}`,
        },
        body: data.getBuffer().toString("utf8"),
      });
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });
  });

  describe("Negative", () => {
    test("GET request should fail on missing input param", async () => {
      const response = await fetch(
        "http://localhost:8090/v1/user/retrieve?test=123",
      );
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });

    test("GET request should fail on specific value in handler implementation", async () => {
      const response = await fetch(
        "http://localhost:8090/v1/user/retrieve?test=123&id=101",
      );
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json).toEqual({
        status: "error",
        error: {
          message: "User not found",
        },
      });
      await waitFor(() => /101, method get/.test(out));
      expect(true).toBeTruthy();
    });

    test("POST request should fail on auth middleware key check", async () => {
      const response = await fetch("http://localhost:8090/v1/user/50", {
        method: "POST",
        headers: {
          token: "456",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "456",
          name: "John Doe",
          birthday: "1974-10-28",
        }),
      });
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toEqual({
        status: "error",
        error: {
          message: "Invalid key",
        },
      });
    });

    test("POST request should fail on auth middleware token check", async () => {
      const response = await fetch("http://localhost:8090/v1/user/50", {
        method: "POST",
        headers: {
          token: "123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "123",
          name: "John Doe",
          birthday: "1974-10-28",
        }),
      });
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toEqual({
        status: "error",
        error: {
          message: "Invalid token",
        },
      });
    });

    test("POST request should fail on schema validation", async () => {
      const response = await fetch("http://localhost:8090/v1/user/-50", {
        method: "POST",
        headers: {
          token: "456",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "123",
          name: "John Doe",
          birthday: "1974-10-28",
        }),
      });
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });

    test("POST request should fail on specific value in handler implementation", async () => {
      const response = await fetch("http://localhost:8090/v1/user/101", {
        method: "POST",
        headers: {
          token: "456",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "123",
          name: "John Doe",
          birthday: "1974-10-28",
        }),
      });
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json).toEqual({
        status: "error",
        error: {
          message: "User not found",
        },
      });
    });

    test("Should respond with error to the missing static file request", async () => {
      const response = await fetch("http://localhost:8090/public/missing.svg");
      expect(response.status).toBe(404);
      expect(response.headers.get("Content-type")).toBe(
        "application/json; charset=utf-8",
      );
      expect(await response.json()).toMatchSnapshot();
    });
  });

  describe("Client", () => {
    const createDefaultImplementation =
      (host: string): Implementation =>
      async (method, path, params) => {
        const searchParams =
          method === "get" ? `?${new URLSearchParams(params)}` : "";
        const response = await fetch(`${host}${path}${searchParams}`, {
          method: method.toUpperCase(),
          headers:
            method === "get"
              ? undefined
              : { "Content-Type": "application/json" },
          body: method === "get" ? undefined : JSON.stringify(params),
        });
        if (`${method} ${path}` in jsonEndpoints) {
          return response.json();
        }
        return response.text();
      };

    const client = new ExpressZodAPIClient(
      createDefaultImplementation(`http://localhost:${config.server.listen}`),
    );

    test("Should perform the request with a positive response", async () => {
      const response = await client.provide("get", "/v1/user/retrieve", {
        id: "10",
      });
      expect(response).toMatchSnapshot();
      expectType<
        | { status: "success"; data: { id: number; name: string } }
        | { status: "error"; error: { message: string } }
      >(response);
    });
  });
});
