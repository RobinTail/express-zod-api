import type { Mock } from "vitest";

const expressJsonMock = vi.fn();
const expressRawMock = vi.fn();
const compressionMock = vi.fn();
const fileUploadMock = vi.fn();

vi.mock("compression", () => ({ default: compressionMock }));
vi.mock("express-fileupload", () => ({ default: fileUploadMock }));

const staticHandler = vi.fn();
const staticMock = vi.fn(() => staticHandler);

let appMock: Record<
  "disable" | "use" | "get" | "post" | "put" | "patch" | "delete" | "options",
  Mock
>;

const expressMock = () => {
  appMock = {
    disable: vi.fn(() => appMock),
    use: vi.fn(() => appMock),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    options: vi.fn(),
  };
  return appMock;
};
expressMock.json = () => expressJsonMock;
expressMock.raw = () => expressRawMock;
expressMock.static = staticMock;

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
};
