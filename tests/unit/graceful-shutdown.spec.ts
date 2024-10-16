import http from "node:http";
import https from "node:https";
import http2 from "node:http2";
import { Agent, fetch } from "undici";
import { setTimeout } from "node:timers/promises";
import { monitor } from "../../src/graceful-shutdown";
import { givePort, signCert } from "../helpers";

describe("monitor()", () => {
  const cert = signCert();

  const makeHttpServer = (handler: http.RequestListener) =>
    new Promise<[http.Server, number]>((resolve) => {
      const subject = http.createServer(handler);
      const port = givePort();
      subject.listen(port, () => resolve([subject, port]));
    });

  const makeHttpsServer = (handler: http.RequestListener) =>
    new Promise<[https.Server, number]>((resolve) => {
      const subject = https.createServer(cert, handler);
      const port = givePort();
      subject.listen(port, () => resolve([subject, port]));
    });

  const makeHttp2Server = (
    handler: Parameters<(typeof http2)["createSecureServer"]>[1],
  ) =>
    new Promise<[http2.Http2SecureServer, number]>((resolve) => {
      const subject = http2.createSecureServer(cert, handler);
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
    "shuts down HTTP server with no connections",
    { timeout: 100 },
    async () => {
      const [httpServer] = await makeHttpServer(vi.fn());
      expect(httpServer.listening).toBeTruthy();
      const graceful = monitor([httpServer]);
      await graceful.shutdown();
      expect(httpServer.listening).toBeFalsy();
    },
  );

  test(
    "shuts down hanging sockets after defined timeout",
    { timeout: 500 },
    async () => {
      const handler = vi.fn();
      const [httpServer, port] = await makeHttpServer(handler);
      const graceful = monitor([httpServer], { timeout: 150 });
      void fetch(`http://localhost:${port}`, {
        headers: { connection: "close" },
      }).catch(vi.fn());
      await setTimeout(50);
      expect(handler).toHaveBeenCalled();
      const pending0 = graceful.shutdown();
      const pending1 = graceful.shutdown();
      expect(pending1).toBe(pending0);
      await setTimeout(100);
      await expect(getConnections(httpServer)).resolves.toBe(1);
      await setTimeout(100);
      await expect(getConnections(httpServer)).resolves.toBe(0);
    },
  );

  test(
    "server stops accepting new connections after .shutdown() called",
    { timeout: 500 },
    async () => {
      const [httpServer, port] = await makeHttpServer(async ({}, res) => {
        await setTimeout(100);
        res.end("foo");
      });
      const graceful = monitor([httpServer], { timeout: 150 });
      const request0 = fetch(`http://localhost:${port}`, {
        headers: { connection: "close" },
      });
      await setTimeout(50);
      void graceful.shutdown();
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
      const [httpServer, port] = await makeHttpServer(async ({}, res) => {
        await setTimeout(100);
        res.end("foo");
      });
      const graceful = monitor([httpServer], { timeout: 150 });
      const request = fetch(`http://localhost:${port}`, { keepalive: true });
      await setTimeout(50);
      void graceful.shutdown();
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
        .fn<http.RequestListener>()
        .mockImplementationOnce(async ({}, res) => {
          res.write("foo");
          await setTimeout(50);
          res.end("bar");
        })
        .mockImplementationOnce(async ({}, res) => {
          await setTimeout(50);
          res.end("baz");
        });
      const [httpServer, port] = await makeHttpServer(handler);
      const graceful = monitor([httpServer], { timeout: 150 });
      const dispatcher = new Agent({ pipelining: 5, keepAliveTimeout: 5e3 });
      const request0 = fetch(`http://localhost:${port}`, { dispatcher });
      await setTimeout(50);
      void graceful.shutdown();
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
    const [httpServer, port] = await makeHttpServer(({}, res) => {
      res.end("foo");
    });
    const graceful = monitor([httpServer], { timeout: 150 });
    await fetch(`http://localhost:${port}`, {
      headers: { connection: "close" },
    });
    await setTimeout(50);
    expect(graceful.sockets.size).toBe(0);
    await graceful.shutdown();
  });

  test(
    "empties internal socket collection for https server",
    { timeout: 500 },
    async () => {
      const [httpsServer, port] = await makeHttpsServer(({}, res) => {
        res.end("foo");
      });
      const graceful = monitor([httpsServer], { timeout: 150 });
      await fetch(`https://localhost:${port}`, {
        dispatcher: new Agent({ connect: { rejectUnauthorized: false } }),
        headers: { connection: "close" },
      });
      await setTimeout(50);
      expect(graceful.sockets.size).toBe(0);
      await graceful.shutdown();
    },
  );

  test("terminates http2 server", { timeout: 500 }, async () => {
    const handler = (async (req, res) => {
      expect(req.httpVersion).toBe("2.0");
      await setTimeout(350);
      res.end("foo");
    }) as Parameters<typeof makeHttp2Server>[0];
    const [httpsServer, port] = await makeHttp2Server(handler);
    const graceful = monitor([httpsServer], { timeout: 150 });
    void fetch(`https://localhost:${port}`, {
      dispatcher: new Agent({
        connect: { rejectUnauthorized: false },
        allowH2: true,
      }),
    }).catch(vi.fn());
    await setTimeout(50);
    expect(graceful.sockets.size).toBeGreaterThan(0);
    void graceful.shutdown();
    await setTimeout(150);
    expect(graceful.sockets.size).toBe(0);
    await graceful.shutdown();
  });

  test(
    "closes immediately after in-flight connections are closed (#16)",
    { timeout: 1e3 },
    async () => {
      const spy = vi.fn<http.RequestListener>(async ({}, res) => {
        await setTimeout(100);
        res.end("foo");
      });
      const [httpServer, port] = await makeHttpServer(spy);
      expect(httpServer.listening).toBeTruthy();
      const graceful = monitor([httpServer], { timeout: 500 });
      void fetch(`http://localhost:${port}`, {
        headers: { connection: "close" },
      });
      await setTimeout(50);
      await expect(getConnections(httpServer)).resolves.toBe(1);
      void graceful.shutdown();
      await setTimeout(75);
      await expect(getConnections(httpServer)).resolves.toBe(0);
    },
  );
});
