import { setTimeout } from "node:timers/promises";
import http, { RequestListener } from "node:http";
import { Agent } from "undici";
import { graceful } from "../../src/graceful-shutdown";
import { givePort } from "../helpers";

describe("graceful()", () => {
  const makeServer = (handler: RequestListener) =>
    new Promise<[http.Server, number]>((resolve) => {
      const subject = http.createServer(handler);
      const port = givePort();
      subject.listen(port, () => resolve([subject, port]));
    });

  const getConnections = (server: http.Server) =>
    new Promise<number>((resolve, reject) => {
      server.getConnections((err, count) =>
        err ? reject(err) : resolve(count),
      );
    });

  test(
    "terminates HTTP server with no connections",
    { timeout: 100 },
    async () => {
      const [httpServer] = await makeServer(vi.fn());
      expect(httpServer.listening).toBeTruthy();
      const terminator = graceful({ server: httpServer });
      await terminator.terminate();
      expect(httpServer.listening).toBeFalsy();
    },
  );

  test(
    "terminates hanging sockets after httpResponseTimeout",
    { timeout: 500 },
    async () => {
      const handler = vi.fn();
      const [httpServer, port] = await makeServer(handler);
      const terminator = graceful({
        gracefulTerminationTimeout: 150,
        server: httpServer,
      });
      void fetch(`http://localhost:${port}`, {
        headers: { connection: "close" },
      }).catch(vi.fn());
      await setTimeout(50);
      expect(handler).toHaveBeenCalled();
      void terminator.terminate();
      await setTimeout(100);
      await expect(getConnections(httpServer)).resolves.toBe(1);
      await setTimeout(100);
      await expect(getConnections(httpServer)).resolves.toBe(0);
    },
  );

  test(
    "server stops accepting new connections after terminator.terminate() is called",
    { timeout: 500 },
    async () => {
      const [httpServer, port] = await makeServer(async ({}, res) => {
        await setTimeout(100);
        res.end("foo");
      });
      const terminator = graceful({
        gracefulTerminationTimeout: 150,
        server: httpServer,
      });
      const request0 = fetch(`http://localhost:${port}`, {
        headers: { connection: "close" },
      });
      await setTimeout(50);
      void terminator.terminate();
      await setTimeout(50);
      const request1 = fetch(`http://localhost:${port}`, {
        headers: { connection: "close" },
      });
      await expect(request1).rejects.toThrowError();
      const response0 = await request0;
      expect(response0.headers.get("connection")).toBe("close");
      await expect(response0.text()).resolves.toBe("foo");
    },
  );

  test(
    "ongoing requests receive {connection: close} header",
    { timeout: 500 },
    async () => {
      const [httpServer, port] = await makeServer(async ({}, res) => {
        await setTimeout(100);
        res.end("foo");
      });
      const terminator = graceful({
        gracefulTerminationTimeout: 150,
        server: httpServer,
      });
      const request = fetch(`http://localhost:${port}`, { keepalive: true });
      await setTimeout(50);
      void terminator.terminate();
      const response = await request;
      expect(response.headers.get("connection")).toBe("close");
      await expect(response.text()).resolves.toBe("foo");
    },
  );

  test(
    "ongoing requests receive {connection: close} header (new request reusing an existing socket)",
    { timeout: 1e3 },
    async () => {
      const handler = vi
        .fn<RequestListener>()
        .mockImplementationOnce(async ({}, res) => {
          res.write("foo");
          await setTimeout(50);
          res.end("bar");
        })
        .mockImplementationOnce(async ({}, res) => {
          // @todo Unable to intercept the response without the delay.
          // When `end()` is called immediately, the `request` event
          // already has `headersSent=true`. It is unclear how to intercept
          // the response beforehand.
          await setTimeout(50);
          res.end("baz");
        });

      const [httpServer, port] = await makeServer(handler);

      const terminator = graceful({
        gracefulTerminationTimeout: 150,
        server: httpServer,
      });

      const dispatcher = new Agent({ pipelining: 5, keepAliveTimeout: 5e3 });
      const request0 = fetch(`http://localhost:${port}`, { dispatcher });

      await setTimeout(50);

      void terminator.terminate();

      const request1 = fetch(`http://localhost:${port}`, { dispatcher });

      await setTimeout(50);

      expect(handler).toHaveBeenCalledTimes(2);

      const response0 = await request0;

      expect(response0.headers.get("connection")).toBe("keep-alive");
      await expect(response0.text()).resolves.toBe("foobar");

      const response1 = await request1;

      expect(response1.headers.get("connection")).toBe("close");
      await expect(response1.text()).resolves.toBe("baz");
    },
  );

  test("empties internal socket collection", { timeout: 500 }, async () => {
    const [httpServer, port] = await makeServer(({}, res) => {
      res.end("foo");
    });

    const terminator = graceful({
      gracefulTerminationTimeout: 150,
      server: httpServer,
    });

    await fetch(`http://localhost:${port}`, {
      headers: { connection: "close" },
    });

    await setTimeout(50);

    expect(terminator.sockets.size).toBe(0);
    expect(terminator.secureSockets.size).toBe(0);

    await terminator.terminate();
  });
});

/*
test("empties internal socket collection for https server", async (t) => {
  t.timeout(500);

  const httpsServer = await createHttpsServer((serverResponse) => {
    serverResponse.end("foo");
  });

  const terminator = createInternalHttpTerminator({
    gracefulTerminationTimeout: 150,
    server: httpsServer.server,
  });

  await fetch(httpsServer.url);

  await setTimeout(50);

  t.is(terminator.secureSockets.size, 0);

  await terminator.terminate();
});

test("closes immediately after in-flight connections are closed (#16)", async (t) => {
  t.timeout(1_000);

  const spy = sinon.spy((serverResponse) => {
    setTimeout(() => {
      serverResponse.end("foo");
    }, 100);
  });

  const httpServer = await createHttpServer(spy);

  t.true(httpServer.server.listening);

  const terminator = createInternalHttpTerminator({
    gracefulTerminationTimeout: 500,
    server: httpServer.server,
  });

  fetch(httpServer.url);

  await setTimeout(50);

  t.is(await httpServer.getConnections(), 1);

  void terminator.terminate();

  // Wait for serverResponse.end to be called, plus a few extra ms for the
  // terminator to finish polling in-flight connections. (Do not, however, wait
  // long enough to trigger graceful termination.)
  await setTimeout(75);

  t.is(await httpServer.getConnections(), 0);
});
*/
