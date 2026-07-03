const expressJsonMock = vi.fn();
const expressRawMock = vi.fn();
const expressUrlencodedMock = vi.fn();

const staticHandler = vi.fn();
const staticMock = vi.fn(() => staticHandler);

const appMock = {
  disable: vi.fn(() => appMock),
  set: vi.fn(() => appMock),
  use: vi.fn(() => appMock),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  options: vi.fn(),
  init: vi.fn(),
  all: vi.fn(),
};

const expressMock = () => appMock;
expressMock.json = () => expressJsonMock;
expressMock.raw = () => expressRawMock;
expressMock.urlencoded = () => expressUrlencodedMock;
expressMock.static = staticMock;

vi.mock("express", () => ({ default: expressMock }));

export {
  expressMock,
  appMock,
  expressJsonMock,
  expressRawMock,
  expressUrlencodedMock,
  staticMock,
  staticHandler,
};
