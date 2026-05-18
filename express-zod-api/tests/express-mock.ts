const expressJsonMock = vi.fn();
const expressRawMock = vi.fn();
const expressUrlencodedMock = vi.fn();
const compressionMock = vi.fn();
const fileUploadMock = vi.fn();
const cookieParserMock = vi.fn(() => vi.fn());

vi.mock("compression", () => ({ default: compressionMock }));
vi.mock("express-fileupload", () => ({ default: fileUploadMock }));
vi.mock("cookie-parser", () => ({ default: cookieParserMock }));

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
  compressionMock,
  fileUploadMock,
  cookieParserMock,
  expressMock,
  appMock,
  expressJsonMock,
  expressRawMock,
  expressUrlencodedMock,
  staticMock,
  staticHandler,
};
