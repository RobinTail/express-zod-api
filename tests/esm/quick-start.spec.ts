import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { givePort, waitFor } from "../helpers";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

describe("ESM Test", () => {
  let quickStart: ChildProcessWithoutNullStreams;
  let out = "";
  const listener = (chunk: Buffer) => {
    out += chunk.toString();
  };
  const port = givePort("esm");

  beforeAll(() => {
    quickStart = spawn(
      "node",
      ["--loader", "@swc-node/register/esm", "quick-start.ts"],
      { cwd: "./tests/esm" },
    );
    quickStart.stdout.on("data", listener);
    quickStart.stderr.on("data", listener);
  });

  afterAll(async () => {
    quickStart.stdout.removeListener("data", listener);
    quickStart.stderr.removeListener("data", listener);
    quickStart.kill();
    await waitFor(() => quickStart.killed);
  });

  afterEach(() => {
    console.log(out);
    out = "";
  });

  describe("Quick Start from Readme", () => {
    test("Should listen", async () => {
      await waitFor(() => out.indexOf(`Listening ${port}`) > -1);
      expect(true).toBeTruthy();
    });

    test("Should handle valid GET request", async () => {
      const response = await fetch(
        `http://localhost:${port}/v1/hello?name=Rick`,
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        status: "success",
        data: {
          greetings: "Hello, Rick. Happy coding!",
        },
      });
    });
  });
});
