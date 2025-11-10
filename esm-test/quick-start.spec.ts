import { spawn } from "node:child_process";
import { givePort } from "../tools/ports";

describe("ESM Test", async () => {
  let out = "";
  const listener = (chunk: Buffer) => {
    out += chunk.toString();
  };
  const quickStart = spawn("unrun", ["quick-start.ts"]);
  quickStart.stdout.on("data", listener);
  quickStart.stderr.on("data", listener);
  const port = givePort("esm");
  await vi.waitFor(() => assert(out.includes(`Listening`)), { timeout: 1e4 });

  afterAll(async () => {
    quickStart.stdout.removeListener("data", listener);
    quickStart.stderr.removeListener("data", listener);
    quickStart.kill();
    await vi.waitFor(() => assert(quickStart.killed), { timeout: 1e4 });
  });

  afterEach(() => {
    console.log(out);
    out = "";
  });

  describe("Quick Start from Readme", () => {
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
