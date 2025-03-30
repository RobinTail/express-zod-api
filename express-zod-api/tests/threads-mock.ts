const parentPort = {
  on: vi.fn(),
  off: vi.fn(),
  postMessage: vi.fn(),
};

vi.mock("node:worker_threads", () => ({
  parentPort,
  workerData: { interval: 100 },
}));

export { parentPort };
