import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import fetch from "node-fetch";
import { esmTestPort, waitFor } from "../helpers.js";

describe("ESM Test", () => {
  let quickStart: ChildProcessWithoutNullStreams;
  let out = "";
  const listener = (chunk: Buffer) => {
    out += chunk.toString();
  };

  beforeAll(() => {
    quickStart = spawn("yarn", ["start"], { cwd: "./tests/esm" });
    quickStart.stdout.on("data", listener);
    quickStart.stdout.on("data", listener);
  });

  afterAll(async () => {
    quickStart.stdout.removeListener("data", listener);
    quickStart.kill();
    await waitFor(() => quickStart.killed);
  });

  afterEach(() => {
    out = "";
  });

  describe("Quick Start from Readme", () => {
    test("Should listen", async () => {
      await waitFor(() => out.indexOf(`Listening ${esmTestPort}`) > -1);
      expect(true).toBeTruthy();
    });

    test("Should handle valid GET request", async () => {
      const response = await fetch(
        `http://localhost:${esmTestPort}/v1/hello?name=Rick`
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
