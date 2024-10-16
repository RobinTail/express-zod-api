import { createConfig, createServer } from "../../src";
import { givePort, signCert } from "../helpers";
import { fetch, Agent } from "undici";

describe("HTTP2", async () => {
  const port = givePort();
  const config = createConfig({
    https: { listen: port, options: signCert() },
    http2: true,
    cors: true,
    startupLogo: false,
    logger: { level: "info" },
  });
  const {
    servers: [server],
  } = await createServer(config, {});
  await vi.waitFor(() => assert(server.listening), { timeout: 1e4 });

  test("should handle requests", async () => {
    const response = await fetch(`https://localhost:${port}`, {
      dispatcher: new Agent({
        connect: { rejectUnauthorized: false },
        allowH2: true,
      }),
    });
    console.log(response);
  });
});
