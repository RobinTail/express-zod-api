import { spawn } from "node:child_process";
import { createReadStream, readFileSync } from "node:fs";
import { expectType } from "tsd";
import {
  ExpressZodAPIClient,
  Implementation,
  jsonEndpoints,
} from "../../example/example.client";
import { givePort, waitFor } from "../helpers";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, afterEach, describe, expect, test } from "vitest";

describe("Example", async () => {
  let out = "";
  const listener = (chunk: Buffer) => {
    out += chunk.toString();
  };
  const example = spawn("tsx", ["example/index.ts"]);
  example.stdout.on("data", listener);
  const port = givePort("example");
  await waitFor(() => out.indexOf(`Listening`) > -1);

  afterAll(async () => {
    example.stdout.removeListener("data", listener);
    example.kill();
    await waitFor(() => example.killed);
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
      await waitFor(() => /v1\/user\/50/.test(out));
      await waitFor(() => /50, 123, 456/.test(out));
      expect(true).toBeTruthy();
    });

    test("Should handle valid GET request", async () => {
      const response = await fetch(
        `http://localhost:${port}/v1/user/retrieve?test=123&id=50`,
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
        `http://localhost:${port}/v1/avatar/send?user_id=123`,
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
        `http://localhost:${port}/v1/avatar/stream?userId=123`,
        { headers: { "Accept-Encoding": "gzip, deflate" } },
      );
      expect(response.status).toBe(200);
      expect(response.headers.has("Content-type")).toBeTruthy();
      expect(response.headers.get("Content-type")).toBe("image/svg+xml");
      expect(response.headers.has("Transfer-encoding")).toBeTruthy();
      expect(response.headers.get("Transfer-encoding")).toBe("chunked");
      expect(response.headers.has("Content-Encoding")).toBeTruthy();
      expect(response.headers.get("Content-Encoding")).toBe("gzip");
      const hash = createHash("sha1")
        .update(await response.text())
        .digest("hex");
      expect(hash).toMatchSnapshot();
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
      const filename = "logo.svg";
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

    test.each([readFileSync("logo.svg"), createReadStream("logo.svg")])(
      "Should accept raw data %#",
      async (subject) => {
        const response = await fetch(`http://localhost:${port}/v1/avatar/raw`, {
          method: "POST",
          body: subject,
          headers: { "Content-Type": "application/octet-stream" },
          duplex: Buffer.isBuffer(subject) ? undefined : "half",
        });
        const json = await response.json();
        expect(json).toMatchSnapshot();
      },
    );
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
      await waitFor(() => /101, method get/.test(out));
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
      const filename = "dataflow.svg";
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
      const json = await response.json();
      expect(json).toMatchSnapshot();
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
      createDefaultImplementation(`http://localhost:${port}`),
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
