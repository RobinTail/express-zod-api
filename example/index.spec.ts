import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createReadStream, readFileSync } from "node:fs";
import { Client, Subscription } from "./example.client";
import { givePort } from "../tools/ports";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

describe("Example", async () => {
  let out = "";
  const listener = (chunk: Buffer) => {
    out += chunk.toString();
  };
  const matchOut = (regExp: RegExp) => regExp.test(out);
  const example = spawn("tsx", ["index.ts"]);
  example.stdout.on("data", listener);
  const port = givePort("example");
  await vi.waitFor(() => assert(out.includes(`Listening`)), { timeout: 1e4 });

  afterAll(async () => {
    example.stdout.removeListener("data", listener);
    example.kill();
    await vi.waitFor(() => assert(example.killed), { timeout: 1e4 });
  });

  afterEach(() => {
    out = "";
  });

  describe("Positive", () => {
    test("Should handle OPTIONS request", async () => {
      const response = await fetch(`http://localhost:${port}/v1/user/100`, {
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
        "PATCH, OPTIONS",
      );
      expect(response.headers.get("access-control-allow-headers")).toBe(
        "content-type",
      );
    });

    test("Should handle valid POST request", async () => {
      const response = await fetch(`http://localhost:${port}/v1/user/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "John Doe" }),
      });
      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json).toMatchObject({
        status: "created",
        data: { id: 16 },
      });
    });

    test("Should handle valid PATCH request", async () => {
      const response = await fetch(`http://localhost:${port}/v1/user/50`, {
        method: "PATCH",
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
      await vi.waitFor(() =>
        assert([/v1\/user\/50/, /123, 456/, /Jane Doe/, /#50/].every(matchOut)),
      );
      expect(true).toBeTruthy();
    });

    test("Should handle valid GET request", async () => {
      const response = await fetch(
        `http://localhost:${port}/v1/user/retrieve?test=123&id=50`,
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toMatchSnapshot();
      await vi.waitFor(() =>
        assert([/v1\/user\/retrieve/, /50, method get/].every(matchOut)),
      );
      expect(true).toBeTruthy();
    });

    test("Should respond with array (legacy API ResultHandler)", async () => {
      const response = await fetch(`http://localhost:${port}/v1/user/list`);
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
        `http://localhost:${port}/v1/avatar/send?userId=123`,
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

    test("Should inform on content length for sendable image", async () => {
      const response = await fetch(
        `http://localhost:${port}/v1/avatar/send?userId=123`,
        { method: "HEAD" },
      );
      expect(response.status).toBe(200);
      expect(response.headers.has("Content-type")).toBeTruthy();
      expect(response.headers.get("Content-type")).toBe(
        "image/svg+xml; charset=utf-8",
      );
      expect(response.headers.has("Content-Length")).toBeTruthy();
      expect(response.headers.get("Content-Length")).toBe("48687");
    });

    test("Should stream an image with a correct header", async () => {
      const response = await fetch(
        `http://localhost:${port}/v1/avatar/stream?userId=123`,
        { headers: { "Accept-Encoding": "br, gzip, deflate" } },
      );
      expect(response.status).toBe(200);
      expect(response.headers.has("Content-type")).toBeTruthy();
      expect(response.headers.get("Content-type")).toBe("image/svg+xml");
      expect(response.headers.get("Content-Disposition")).toBe(
        `attachment; filename="logo.svg"`,
      );
      expect(response.headers.has("Transfer-encoding")).toBeTruthy();
      expect(response.headers.get("Transfer-encoding")).toBe("chunked");
      expect(response.headers.has("Content-Encoding")).toBeTruthy();
      expect(response.headers.get("Content-Encoding")).toBeOneOf([
        "br",
        "gzip",
      ]);
      const hash = createHash("sha1")
        .update(await response.text())
        .digest("hex");
      expect(hash).toMatchSnapshot();
    });

    test("Should inform on content length for streaming image", async () => {
      const response = await fetch(
        `http://localhost:${port}/v1/avatar/stream?userId=123`,
        { method: "HEAD" },
      );
      expect(response.status).toBe(200);
      expect(response.headers.has("Content-type")).toBeTruthy();
      expect(response.headers.get("Content-type")).toBe("image/svg+xml");
      expect(response.headers.get("Content-Disposition")).toBe(
        `attachment; filename="logo.svg"`,
      );
      expect(response.headers.has("Content-Length")).toBeTruthy();
      expect(response.headers.get("Content-Length")).toBe("48687");
    });

    test("Should serve static files", async () => {
      const response = await fetch(`http://localhost:${port}/public/logo.svg`);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-type")).toBe("image/svg+xml");
      const hash = createHash("sha1")
        .update(await response.text())
        .digest("hex");
      expect(hash).toMatchSnapshot();
    });

    test("Should upload the file", async () => {
      const filename = "assets/logo.svg";
      const logo = await readFile(filename, "utf-8");
      const data = new FormData();
      data.append(
        "avatar",
        new Blob([logo], { type: "image/svg+xml" }),
        filename,
      );
      data.append("str", "test string value");
      data.append("num", 123);
      data.append("arr[0]", 456);
      data.append("arr[1]", 789);
      data.append("obj[some]", "thing");
      const response = await fetch(
        `http://localhost:${port}/v1/avatar/upload`,
        { method: "POST", body: data },
      );
      expect(response.headers.get("access-control-allow-methods")).toBe(
        "POST, OPTIONS",
      );
      const json = await response.json();
      expect(json).toEqual({
        data: {
          hash: "f39beeff92379dc935586d726211c2620be6f879",
          mime: "image/svg+xml",
          name: "logo.svg",
          otherInputs: {
            arr: ["456", "789"],
            num: "123",
            obj: {
              some: "thing",
            },
            str: "test string value",
          },
          size: 48687,
        },
        status: "success",
      });
    });

    test.each([
      readFileSync("assets/logo.svg"),
      createReadStream("assets/logo.svg"),
    ])("Should accept raw data %#", async (subject) => {
      const response = await fetch(`http://localhost:${port}/v1/avatar/raw`, {
        method: "POST",
        body: subject,
        headers: { "Content-Type": "application/octet-stream" },
        duplex: Buffer.isBuffer(subject) ? undefined : "half",
      });
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });

    test("Should accept URL encoded HTML form", async () => {
      const data = new URLSearchParams();
      data.append("name", "John Doe");
      data.append("email", "john@example.com");
      data.append("message", "All good");
      const response = await fetch(
        `http://localhost:${port}/v1/forms/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: data.toString(),
        },
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        status: "success",
        data: { crc: 32 },
      });
    });

    test("Should handle no content", async () => {
      const response = await fetch(
        `http://localhost:${port}/v1/user/50/remove`,
        { method: "DELETE", headers: { "Content-Type": "application/json" } },
      );
      expect(response.status).toBe(204);
      expect(response.headers.get("content-type")).toBeNull();
    });

    test("Should emit SSE (server sent events)", async () => {
      const stack: number[] = [];
      const onTime = (data: number) => void stack.push(data);
      const subscription = new Subscription("get /v1/events/stream", {}).on(
        "time",
        onTime,
      );
      await vi.waitFor(() => assert(stack.length > 2), { timeout: 5e3 });
      subscription.source.close();
    });
  });

  describe("Protocol", () => {
    test("Issue #2706: Should handle parser failures but retain CORS headers", async () => {
      const response = await fetch(`http://localhost:${port}/v1/user/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"name": "Test', // no closing bracket
      });
      expect(response.status).toBe(400); // Issue #907
      expect(response.headers.get("access-control-allow-methods")).toBe(
        "POST, OPTIONS", // issue #2706
      );
      const json = await response.json();
      expect(json).toMatchSnapshot({
        error: {
          message: expect.stringMatching(
            /Unterminated string in JSON at position 14/,
          ),
        },
      });
    });
  });

  describe("Negative", () => {
    test("GET request should fail on missing input param", async () => {
      const response = await fetch(
        `http://localhost:${port}/v1/user/retrieve?test=123`,
      );
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });

    test("GET request should fail on specific value in handler implementation", async () => {
      const response = await fetch(
        `http://localhost:${port}/v1/user/retrieve?test=123&id=101`,
      );
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json).toEqual({
        status: "error",
        error: {
          message: "User not found",
        },
      });
      await vi.waitFor(() => assert(matchOut(/101, method get/)));
      expect(true).toBeTruthy();
    });

    test("POST request should respond with a conflict on assertion of uniqueness", async () => {
      const response = await fetch(`http://localhost:${port}/v1/user/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "James McGill" }),
      });
      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json).toEqual({ status: "exists", id: 16 });
    });

    test("POST request should fail on demand", async () => {
      const response = await fetch(`http://localhost:${port}/v1/user/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Gimme Jimmy" }),
      });
      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json).toEqual({ status: "error", reason: "That went wrong" });
    });

    test("PATCH request should fail on auth middleware key check", async () => {
      const response = await fetch(`http://localhost:${port}/v1/user/50`, {
        method: "PATCH",
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

    test("PATCH request should fail on auth middleware token check", async () => {
      const response = await fetch(`http://localhost:${port}/v1/user/50`, {
        method: "PATCH",
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

    test("PATCH request should fail on schema validation", async () => {
      const response = await fetch(`http://localhost:${port}/v1/user/-50`, {
        method: "PATCH",
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

    test("PATCH request should fail on specific value in handler implementation", async () => {
      const response = await fetch(`http://localhost:${port}/v1/user/101`, {
        method: "PATCH",
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
      const response = await fetch(
        `http://localhost:${port}/public/missing.svg`,
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("Content-type")).toBe(
        "application/json; charset=utf-8",
      );
      expect(await response.json()).toMatchSnapshot();
    });

    test("Should fail to upload if the file is too large", async () => {
      const filename = "assets/dataflow.svg";
      const logo = await readFile(filename, "utf-8");
      const data = new FormData();
      data.append(
        "avatar",
        new Blob([logo], { type: "image/svg+xml" }),
        filename,
      );
      const response = await fetch(
        `http://localhost:${port}/v1/avatar/upload`,
        { method: "POST", body: data },
      );
      expect(response.status).toBe(413);
      expect(response.headers.get("access-control-allow-methods")).toBe(
        "POST, OPTIONS", // issue #2706
      );
      const json = await response.json();
      expect(json).toMatchSnapshot();
    });

    test("Should handle errors for SSE endpoints", async () => {
      const response = await fetch(
        `http://localhost:${port}/v1/events/stream?trigger=failure`,
      );
      expect(response.status).toBe(500);
      expect(response.headers.get("content-type")).toBe(
        "text/plain; charset=utf-8",
      );
      await expect(response.text()).resolves.toBe("Intentional failure");
    });
  });

  describe("OpenAPI Documentation", () => {
    test("should be valid", { retry: 3 }, async () => {
      const data = await readFile("example.documentation.yaml", "utf-8");
      const response = await fetch(
        "https://validator.swagger.io/validator/debug",
        {
          method: "POST",
          headers: { "Content-Type": "application/yaml" },
          body: data,
        },
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      if (
        typeof json === "object" &&
        json !== null &&
        "schemaValidationMessages" in json &&
        Array.isArray(json.schemaValidationMessages) &&
        json.schemaValidationMessages.length
      ) {
        console.warn(json);
        json.schemaValidationMessages.every(({ level }) =>
          expect(level).not.toBe("error"),
        );
      }
    });
  });

  describe("Client", () => {
    const client = new Client();

    test("Should perform the request with a positive response", async () => {
      const response = await client.provide("get /v1/user/retrieve", {
        id: "10",
      });
      expect(response).toMatchSnapshot();
      expectTypeOf(response).toExtend<
        | { status: "success"; data: { id: number; name: string } }
        | { status: "error"; error: { message: string } }
      >();
    });

    test("Issue #2177: should handle path params correctly", async () => {
      const response = await client.provide("patch /v1/user/:id", {
        key: "123",
        token: "456",
        id: "12",
        name: "Alan Turing",
        birthday: "1912-06-23",
      });
      expect(typeof response).toBe("object");
      expect(response).toMatchSnapshot();
      expectTypeOf<{
        status: "success";
        data: { name: string; createdAt: string };
      }>().toExtend<typeof response>();
      expectTypeOf<{
        status: "error";
        error: { message: string };
      }>().toExtend<typeof response>();
    });

    test("Issue #2182: should deny unlisted combination of path and method", async () => {
      expectTypeOf(client.provide).toBeCallableWith("post /v1/user/create", {});
      // @ts-expect-error -- can't use .toBeCallableWith with .not, see https://github.com/mmkal/expect-type
      expectTypeOf(client.provide).toBeCallableWith("get /v1/user/create", {});
    });

    test("should handle no content (no response body)", async () => {
      const response = await client.provide("delete /v1/user/:id/remove", {
        id: "12",
      });
      expect(response).toBeUndefined();
      expectTypeOf(response).toBeUndefined();
    });
  });
});
