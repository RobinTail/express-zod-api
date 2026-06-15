const compressionMock = vi.fn();
const fileUploadMock = vi.fn();
const cookieParserMock = vi.fn();
const rateLimitMock = vi.fn();

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

export { compressionMock, fileUploadMock, cookieParserMock, rateLimitMock };
