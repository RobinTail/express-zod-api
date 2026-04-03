import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import { setTimeout } from "node:timers/promises";
import { monitor } from "../src/graceful-shutdown";
import { givePort } from "../../tools/ports";
import { signCert } from "./ssl-helpers";

interface HttpResult {
  res: http.IncomingMessage;
  body: string;
  headers: http.IncomingHttpHeaders;
}

describe("monitor()", () => {
  const sslOptions = signCert();

  const makeHttpServer = (handler: http.RequestListener) => {
    const { promise, resolve } = Promise.withResolvers<[http.Server, number]>();
    const subject = http.createServer(handler);
    const port = givePort();
    subject.listen(port, () => resolve([subject, port]));
    return promise;
  };

  const makeHttpsServer = (handler: http.RequestListener) => {
    const { promise, resolve } =
      Promise.withResolvers<[https.Server, number]>();
    const subject = https.createServer(sslOptions, handler);
    const port = givePort();
    subject.listen(port, () => resolve([subject, port]));
    return promise;
  };

  const getConnections = (server: http.Server) => {
    const { promise, resolve, reject } = Promise.withResolvers<number>();
    server.getConnections((err, count) => (err ? reject(err) : resolve(count)));
    return promise;
  };

  const handleResponse = (
    resolve: (value: HttpResult) => void,
    res: http.IncomingMessage,
  ) => {
    const chunks: Buffer[] = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () =>
      resolve({
        res,
        body: Buffer.concat(chunks).toString(),
        headers: res.headers,
      }),
    );
  };

  const makeHttpRequest = (
    port: number,
    options?: http.RequestOptions,
  ): Promise<HttpResult> => {
    const { promise, resolve, reject } = Promise.withResolvers<HttpResult>();
    const req = http.request({ ...options, port }, (res) =>
      handleResponse(resolve, res),
    );
    req.on("error", reject);
    req.end();
    return promise;
  };

  const makeHttpsRequest = (
    port: number,
    options?: https.RequestOptions,
  ): Promise<HttpResult> => {
    const { promise, resolve, reject } = Promise.withResolvers<HttpResult>();
    const req = https.request({ ...sslOptions, ...options, port }, (res) =>
      handleResponse(resolve, res),
    );
    req.on("error", reject);
    req.end();
    return promise;
  };

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
    { timeout: 1000 }, // increased from 500 for stability
    async () => {
      const handler = vi.fn();
      const [httpServer, port] = await makeHttpServer(handler);
      const graceful = monitor([httpServer], { timeout: 150 });
      makeHttpRequest(port, { headers: { connection: "close" } }).catch(
        vi.fn(),
      );
      await vi.waitFor(() => assert(handler.mock.calls.length === 1), {
        interval: 30, // unstable
      });
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
      const request0 = makeHttpRequest(port, {
        headers: { connection: "close" },
      });
      await setTimeout(50);
      void graceful.shutdown();
      await setTimeout(50);
      const request1 = makeHttpRequest(port, {
        headers: { connection: "close" },
      });
      await expect(request1).rejects.toThrowError();
      const response0 = await request0;
      expect(response0.headers.connection).toBe("close");
      expect(response0.body).toBe("foo");
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
      const request = makeHttpRequest(port, {
        headers: { connection: "keep-alive" },
      });
      await setTimeout(50);
      void graceful.shutdown();
      const response = await request;
      expect(response.headers.connection).toBe("close");
      expect(response.body).toBe("foo");
    },
  );

  test(
    "new request fails after graceful shutdown",
    { timeout: 500 },
    async () => {
      const [httpServer, port] = await makeHttpServer(async ({}, res) => {
        await setTimeout(100);
        res.end("foo");
      });
      const graceful = monitor([httpServer], { timeout: 150 });
      await setTimeout(50);
      void graceful.shutdown();
      await setTimeout(50);
      const request = makeHttpRequest(port);
      await expect(request).rejects.toThrowError();
    },
  );

  test("empties internal socket collection", { timeout: 500 }, async () => {
    const [httpServer, port] = await makeHttpServer(({}, res) => {
      res.end("foo");
    });
    const graceful = monitor([httpServer], { timeout: 150 });
    await makeHttpRequest(port, { headers: { connection: "close" } });
    await setTimeout(50);
    expect(graceful.sockets.size).toBe(0);
    await graceful.shutdown();
  });

  describe("https", async () => {
    const [httpsServer, port] = await makeHttpsServer(({}, res) => {
      res.end("foo");
    });

    test(
      "empties internal socket collection for https server",
      { timeout: 500 },
      async () => {
        const graceful = monitor([httpsServer], { timeout: 150 });
        await makeHttpsRequest(port, { headers: { connection: "close" } });
        await setTimeout(50);
        expect(graceful.sockets.size).toBe(0);
        await graceful.shutdown();
      },
    );
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
      makeHttpRequest(port, { headers: { connection: "close" } }).catch(
        vi.fn(),
      );
      await setTimeout(50);
      await expect(getConnections(httpServer)).resolves.toBe(1);
      void graceful.shutdown();
      await setTimeout(75);
      await expect(getConnections(httpServer)).resolves.toBe(0);
    },
  );
});
