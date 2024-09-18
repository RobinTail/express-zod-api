import { Socket } from "node:net";
import { TLSSocket } from "node:tls";
import { bench } from "vitest";
import { isEncrypted } from "../../src/graceful-helpers";

const comparable = (socket: Socket): socket is TLSSocket =>
  socket instanceof TLSSocket;

describe("Experiment %s", () => {
  const a = new Socket();
  const b = new TLSSocket(a);

  bench("original", () => {
    isEncrypted(a);
    isEncrypted(b);
  });

  bench("featured", () => {
    comparable(a);
    comparable(b);
  });
});
