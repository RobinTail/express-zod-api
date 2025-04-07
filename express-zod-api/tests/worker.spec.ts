import assert from "node:assert/strict";
import { parentPort, writeMock } from "./threads-mock";
import { setTimeout } from "node:timers/promises";

describe("Worker", async () => {
  await import("../src/worker");

  afterEach(() => {
    writeMock.mockClear();
  });

  const onMessage = parentPort.on.mock.calls[0][1];

  if (!onMessage) throw new Error("Handler is not installed");

  test("should handle incoming message", async () => {
    onMessage({ command: "log", line: "test" });
    await vi.waitFor(() => assert.equal(writeMock.mock.calls.length, 1));
    expect(writeMock).toHaveBeenLastCalledWith(
      0,
      "test\n",
      expect.any(Function),
    );
  });

  test("should maintain the queue", async () => {
    onMessage({ command: "log", line: "one" });
    onMessage({ command: "log", line: "two" });
    onMessage({ command: "log", line: "three" });
    await vi.waitFor(() => assert.equal(writeMock.mock.calls.length, 1));
    expect(writeMock).toHaveBeenLastCalledWith(
      0,
      "one\ntwo\nthree\n",
      expect.any(Function),
    );
  });

  test("should flush immediately when buffer overflows", async () => {
    onMessage({ command: "log", line: "1" });
    onMessage({ command: "log", line: "2" });
    onMessage({ command: "log", line: "3" });
    onMessage({ command: "log", line: "4" });
    onMessage({ command: "log", line: "5" });
    onMessage({ command: "log", line: "6" });
    await vi.waitFor(() => assert.equal(writeMock.mock.calls.length, 1));
    expect(writeMock).toHaveBeenLastCalledWith(
      0,
      "1\n2\n3\n4\n5\n",
      expect.any(Function),
    );
    await vi.waitFor(() => assert.equal(writeMock.mock.calls.length, 2));
    expect(writeMock).toHaveBeenLastCalledWith(0, "6\n", expect.any(Function));
  });

  test("should flush and stop listening on closing", async () => {
    onMessage({ command: "log", line: "one" });
    expect(writeMock).not.toHaveBeenCalled();
    onMessage({ command: "close" });
    expect(parentPort.off).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
    await vi.waitFor(() => assert.equal(writeMock.mock.calls.length, 1));
    expect(writeMock).toHaveBeenLastCalledWith(
      0,
      "one\n",
      expect.any(Function),
    );
    expect(parentPort.postMessage).toHaveBeenCalledWith("done");
    onMessage({ command: "log", line: "two" });
    onMessage({ command: "log", line: "three" });
    await setTimeout(300);
    expect(writeMock).toHaveBeenCalledOnce();
  });
});
