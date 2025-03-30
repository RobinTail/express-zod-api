import assert from "node:assert/strict";
import { parentPort } from "./threads-mock";
import { setTimeout } from "node:timers/promises";

describe("Logger worker", async () => {
  // @ts-expect-error -- JS file without declaration
  await import("../src/logger-worker");
  const logger = vi.spyOn(console, "log").mockImplementation(() => {});

  afterEach(() => {
    logger.mockClear();
  });

  const onMessage = parentPort.on.mock.calls.find(
    ([event]) => event === "message",
  )?.[1];
  const onClose = parentPort.on.mock.calls.find(
    ([event]) => event === "close",
  )?.[1];

  if (!onMessage || !onClose) throw new Error("Handlers not installed");

  test("should handle incoming message", async () => {
    onMessage("test");
    await vi.waitFor(() => assert.equal(logger.mock.calls.length, 1));
    expect(logger).toHaveBeenLastCalledWith("test");
  });

  test("should maintain the queue", async () => {
    onMessage("one");
    onMessage("two");
    onMessage("three");
    await vi.waitFor(() => assert.equal(logger.mock.calls.length, 1));
    expect(logger).toHaveBeenLastCalledWith("one\ntwo\nthree");
  });

  test("should flush and stop listening on closing", async () => {
    onMessage("one");
    expect(logger).not.toHaveBeenCalled();
    onClose();
    expect(parentPort.off).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
    await vi.waitFor(() => assert.equal(logger.mock.calls.length, 1));
    expect(logger).toHaveBeenLastCalledWith("one");
    onMessage("two");
    onMessage("three");
    await setTimeout(300);
    expect(logger).toHaveBeenCalledOnce();
  });
});
