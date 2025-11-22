import {
  hasResponse,
  hasHttpServer,
  closeAsync,
  weAreClosed,
  isEncrypted,
} from "../src/graceful-helpers";
import http from "node:http";
import { makeRequestMock } from "../src/testing";
import { Socket } from "node:net";

describe("Graceful helpers", () => {
  describe("hasResponse()", () => {
    test("should ensure _httpMessage prop to be instance of http.ServerResponse", () => {
      const subject = {
        _httpMessage: new http.ServerResponse(makeRequestMock()),
      };
      expect(hasResponse(subject as unknown as Socket)).toBeTruthy();
    });
    test.each([{}, { _httpResponse: undefined }, { _httpResponse: {} }])(
      "should decline otherwise %#",
      (subject) => {
        expect(hasResponse(subject as Socket)).toBeFalsy();
      },
    );
  });

  describe("hasHttpServer()", () => {
    test("should ensure server prop to be instance of http.Server", () => {
      const subject = { server: http.createServer() };
      expect(hasHttpServer(subject as unknown as Socket)).toBeTruthy();
    });
    test.each([{}, { server: undefined }, { server: {} }])(
      "should decline otherwise %#",
      (subject) => {
        expect(hasHttpServer(subject as Socket)).toBeFalsy();
      },
    );
  });

  describe("isEncrypted()", () => {
    test("should ensure encrypted prop is true", () => {
      const subject = { encrypted: true };
      expect(isEncrypted(subject as unknown as Socket)).toBeTruthy();
    });
    test.each([{}, { encrypted: undefined }, { encrypted: false }])(
      "should decline otherwise %#",
      (subject) => {
        expect(isEncrypted(subject as Socket)).toBeFalsy();
      },
    );
  });

  describe("closeAsync()", () => {
    test("should promisify .close() method", async () => {
      const subject = {
        close: vi
          .fn<(cb: (err?: Error) => void) => void>()
          .mockImplementationOnce((cb) => cb())
          .mockImplementationOnce((cb) => cb(new Error("Sample"))),
      };
      await expect(
        closeAsync(subject as unknown as http.Server),
      ).resolves.toBeUndefined();
      await expect(
        closeAsync(subject as unknown as http.Server),
      ).rejects.toThrowError("Sample");
    });
  });

  describe("weAreClosed()", () => {
    test("should set connection:close header when they are not sent yet", () => {
      const subject = { headersSent: false, setHeader: vi.fn() };
      weAreClosed(
        {} as http.IncomingMessage,
        subject as unknown as http.ServerResponse,
      );
      expect(subject.setHeader).toHaveBeenCalledWith("connection", "close");
    });
    test("should be noop otherwise", () => {
      const subject = { headersSent: true, setHeader: vi.fn() };
      weAreClosed(
        {} as http.IncomingMessage,
        subject as unknown as http.ServerResponse,
      );
      expect(subject.setHeader).not.toHaveBeenCalled();
    });
  });
});
