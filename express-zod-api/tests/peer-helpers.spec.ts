import { MissingPeerError } from "../src";
import { loadPeer } from "../src/peer-helpers";

describe("Peer loading helpers", () => {
  describe("loadPeer()", () => {
    test("should load the module", () => {
      expect(loadPeer("compression")).toBeTruthy();
    });
    test("should throw when module not found", () => {
      expect(() => loadPeer("missing")).toThrow(
        new MissingPeerError("missing"),
      );
    });
  });
});
