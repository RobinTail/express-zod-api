import { WriteStream } from "node:tty";
import { printStartupLogo } from "../../express-zod-api/src/startup-logo";

describe("Startup logo", () => {
  describe("printStartupLogo()", () => {
    test("does nothing when TTY is too narrow", () => {
      const streamMock = { write: vi.fn(), columns: 131 };
      printStartupLogo(streamMock as unknown as WriteStream);
      expect(streamMock.write).not.toHaveBeenCalled();
    });

    test("should print the logo when it fits", () => {
      const streamMock = { write: vi.fn(), columns: 132 };
      printStartupLogo(streamMock as unknown as WriteStream);
      expect(streamMock.write).toHaveBeenCalledWith(expect.any(String));
      expect(streamMock.write.mock.lastCall![0].split("\n")).toHaveLength(14);
    });
  });
});
