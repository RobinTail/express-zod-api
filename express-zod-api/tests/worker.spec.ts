import assert from "node:assert/strict";
import { parentPort } from "./threads-mock";
import { setTimeout } from "node:timers/promises";

describe("Worker", async () => {
  await import("../src/worker");
  const logger = vi.spyOn(console, "log").mockImplementation(() => {});

  afterEach(() => {
    logger.mockClear();
  });

  const onMessage = parentPort.on.mock.calls[0][1];

  if (!onMessage) throw new Error("Handler is not installed");

  test("should handle incoming message", async () => {
    onMessage({ command: "log", line: "test" });
    await vi.waitFor(() => assert.equal(logger.mock.calls.length, 1));
    expect(logger).toHaveBeenLastCalledWith("test");
  });

  test("should maintain the queue", async () => {
    onMessage({ command: "log", line: "one" });
    onMessage({ command: "log", line: "two" });
    onMessage({ command: "log", line: "three" });
    await vi.waitFor(() => assert.equal(logger.mock.calls.length, 1));
    expect(logger).toHaveBeenLastCalledWith("one\ntwo\nthree");
  });

  test("should flush and stop listening on closing", async () => {
    onMessage({ command: "log", line: "one" });
    expect(logger).not.toHaveBeenCalled();
    onMessage({ command: "close" });
    expect(parentPort.off).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
    await vi.waitFor(() => assert.equal(logger.mock.calls.length, 1));
    expect(logger).toHaveBeenLastCalledWith("one");
    expect(parentPort.postMessage).toHaveBeenCalledWith("done");
    onMessage({ command: "log", line: "two" });
    onMessage({ command: "log", line: "three" });
    await setTimeout(300);
    expect(logger).toHaveBeenCalledOnce();
  });
});
