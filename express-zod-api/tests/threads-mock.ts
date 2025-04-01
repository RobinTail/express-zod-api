const parentPort = {
  on: vi.fn(),
  off: vi.fn(),
  postMessage: vi.fn(),
};

vi.mock("node:worker_threads", () => ({
  parentPort,
  workerData: { interval: 100, fd: 0 },
}));

const writeMock = vi.fn();

vi.mock("fs", () => ({
  write: writeMock,
}));

export { parentPort, writeMock };
