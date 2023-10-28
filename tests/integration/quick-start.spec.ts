import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { waitFor } from "../helpers";

describe("Integration Test", () => {
  let quickStart: ChildProcessWithoutNullStreams;
  let out = "";
  const listener = (chunk: Buffer) => {
    out += chunk.toString();
  };

  beforeAll(() => {
    quickStart = spawn("node", ["-r", "@swc-node/register", "quick-start.ts"], {
      cwd: "./tests/integration",
    });
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
      await waitFor(() => /Listening 8090/.test(out));
      expect(true).toBeTruthy();
    });

    test("Should handle valid GET request", async () => {
      const response = await fetch("http://localhost:8090/v1/hello?name=Rick");
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
