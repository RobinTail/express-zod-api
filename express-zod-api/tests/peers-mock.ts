const compressionMock = vi.fn();
const fileUploadMock = vi.fn();
const cookieParserMock = vi.fn();

const limiterApiMock = { getKey: vi.fn(), resetKey: vi.fn() };
const rateLimitMock = vi.fn(({}: any) =>
  Object.assign((_req: any, _res: any, next: any) => {
    next();
  }, limiterApiMock),
);

vi.mock("../src/peer-helpers", () => ({
  loadPeer: (moduleName: string) => {
    switch (moduleName) {
      case "compression":
        return compressionMock;
      case "cookie-parser":
        return cookieParserMock;
      case "express-fileupload":
        return fileUploadMock;
      case "express-rate-limit":
        return rateLimitMock;
      default:
        throw new Error(`Unhandled peer dependency mock: ${moduleName}`);
    }
  },
}));

export {
  compressionMock,
  fileUploadMock,
  cookieParserMock,
  rateLimitMock,
  limiterApiMock,
};
