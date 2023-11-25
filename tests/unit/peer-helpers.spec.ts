import { MissingPeerError } from "../../src";
import { loadAlternativePeer, loadPeer } from "../../src/peer-helpers";

describe("Peer loading helpers", () => {
  describe("loadPeer()", () => {
    test("should load the module", async () => {
      expect(await loadPeer("compression")).toBeTruthy();
    });
    test("should throw when module not found", async () => {
      await expect(async () => loadPeer("missing")).rejects.toThrow(
        new MissingPeerError("missing"),
      );
    });
  });

  describe("loadAltPeer()", () => {
    test("should load an alternative module", async () => {
      expect(
        await loadAlternativePeer([
          { moduleName: "vitest", moduleExport: "vi" },
          { moduleName: "@jest/globals", moduleExport: "jest" },
        ]),
      ).toBeTruthy();
    });
    test("should throw when no alternatives found", async () => {
      await expect(async () =>
        loadAlternativePeer([
          { moduleName: "vitest" },
          { moduleName: "@also/missing" },
        ]),
      ).rejects.toThrow(new MissingPeerError(["vitest", "@also/missing"]));
    });
  });
});
