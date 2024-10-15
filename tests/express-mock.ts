import { makeRequestMock, makeResponseMock } from "../src/testing";

const expressJsonMock = vi.fn();
const expressRawMock = vi.fn();
const compressionMock = vi.fn();
const fileUploadMock = vi.fn();

vi.mock("compression", () => ({ default: compressionMock }));
vi.mock("express-fileupload", () => ({ default: fileUploadMock }));

const staticHandler = vi.fn();
const staticMock = vi.fn(() => staticHandler);

const appMock = {
  disable: vi.fn(() => appMock),
  use: vi.fn(() => appMock),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  options: vi.fn(),
  init: vi.fn(),
};

const resetAppMock = () => {
  for (const key in appMock) {
    const prop = appMock[key as keyof typeof appMock];
    if (prop && "mockClear" in prop && typeof prop.mockClear === "function") {
      prop.mockClear();
    }
  }
};

const expressMock = () => appMock;
expressMock.json = () => expressJsonMock;
expressMock.raw = () => expressRawMock;
expressMock.static = staticMock;
expressMock.application = appMock;
expressMock.request = makeRequestMock();
expressMock.response = makeResponseMock();

vi.mock("express", () => ({ default: expressMock }));

export {
  compressionMock,
  fileUploadMock,
  expressMock,
  appMock,
  expressJsonMock,
  expressRawMock,
  staticMock,
  staticHandler,
  resetAppMock,
};
