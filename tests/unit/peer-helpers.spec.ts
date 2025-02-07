import { MissingPeerError } from "../../express-zod-api/src";
import { loadPeer } from "../../express-zod-api/src/peer-helpers";

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
});
