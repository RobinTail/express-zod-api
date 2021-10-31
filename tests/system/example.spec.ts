import fetch from "node-fetch";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { mimeMultipart } from "../../src/mime";
import { waitFor } from "../helpers";
import crypto from "crypto";
import FormData from "form-data";
import { readFileSync } from "fs";

describe("Example", () => {
  let example: ChildProcessWithoutNullStreams;
  let out = "";
  const listener = (chunk: Buffer) => {
    out += chunk.toString();
  };

  beforeAll(() => {
    example = spawn("ts-node", ["example/index.ts"]);
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
      const response = await fetch("http://localhost:8090/v2/user", {
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
        "POST, OPTIONS"
      );
      expect(response.headers.get("access-control-allow-headers")).toBe(
        "content-type"
      );
    });

    test("Should handle valid POST request", async () => {
      const response = await fetch("http://localhost:8090/v2/user", {
        method: "POST",
        headers: {
          token: "456",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "123",
          id: 50,
          name: "John Doe",
        }),
      });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toMatchObject({
        status: "success",
        data: {
          name: "John Doe",
          timestamp: expect.any(Number),
        },
      });
      await waitFor(() => /v2\/user/.test(out));
      await waitFor(() => /50, 123, 456/.test(out));
      expect(true).toBeTruthy();
    });

    test("Should handle valid GET request", async () => {
      const response = await fetch(
        "http://localhost:8090/v1/user/retrieve?test=123&id=50"
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        status: "success",
        data: {
          id: 50,
          name: "John Doe",
        },
      });
      await waitFor(() => /v1\/user\/retrieve/.test(out));
      await waitFor(() => /50, method get/.test(out));
      expect(true).toBeTruthy();
    });

    test("Should send an image with a correct header", async () => {
      const response = await fetch(
        "http://localhost:8090/v1/avatar/send?userId=123"
      );
      expect(response.status).toBe(200);
      expect(response.headers.has("Content-type")).toBeTruthy();
      expect(response.headers.get("Content-type")).toBe(
        "image/svg+xml; charset=utf-8"
      );
      expect(response.headers.has("Content-length")).toBeTruthy();
      const hash = crypto
        .createHash("sha1")
        .update(await response.text())
        .digest("hex");
      expect(hash).toMatchSnapshot();
    });

    test("Should stream an image with a correct header", async () => {
      const response = await fetch(
        "http://localhost:8090/v1/avatar/stream?userId=123"
      );
      expect(response.status).toBe(200);
      expect(response.headers.has("Content-type")).toBeTruthy();
      expect(response.headers.get("Content-type")).toBe("image/svg+xml");
      expect(response.headers.has("Transfer-encoding")).toBeTruthy();
      expect(response.headers.get("Transfer-encoding")).toBe("chunked");
      const hash = crypto
        .createHash("sha1")
        .update(await response.text())
        .digest("hex");
      expect(hash).toMatchSnapshot();
    });

    test("Should upload the file", async () => {
      const filename = "logo.svg";
      const logo = readFileSync(filename, "utf-8");
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
        body: data,
      });
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });
  });

  describe("Negative", () => {
    test("GET request should fail on missing input param", async () => {
      const response = await fetch(
        "http://localhost:8090/v1/user/retrieve?test=123"
      );
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });

    test("GET request should fail on specific value in handler implementation", async () => {
      const response = await fetch(
        "http://localhost:8090/v1/user/retrieve?test=123&id=101"
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
      const response = await fetch("http://localhost:8090/v2/user", {
        method: "POST",
        headers: {
          token: "456",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "456",
          id: 50,
          name: "John Doe",
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
      const response = await fetch("http://localhost:8090/v2/user", {
        method: "POST",
        headers: {
          token: "123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "123",
          id: 50,
          name: "John Doe",
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
      const response = await fetch("http://localhost:8090/v2/user", {
        method: "POST",
        headers: {
          token: "456",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "123",
          id: -50,
          name: "John Doe",
        }),
      });
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });

    test("POST request should fail on specific value in handler implementation", async () => {
      const response = await fetch("http://localhost:8090/v2/user", {
        method: "POST",
        headers: {
          token: "456",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "123",
          id: 101,
          name: "John Doe",
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
  });
});
