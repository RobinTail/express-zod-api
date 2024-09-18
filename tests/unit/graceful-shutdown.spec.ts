import forge from "node-forge";
import http from "node:http";
import https from "node:https";
import { Agent } from "undici";
import { setTimeout } from "node:timers/promises";
import { monitor } from "../../src/graceful-shutdown";
import { givePort } from "../helpers";

describe("monitor()", () => {
  const makeHttpServer = (handler: http.RequestListener) =>
    new Promise<[http.Server, number]>((resolve) => {
      const subject = http.createServer(handler);
      const port = givePort();
      subject.listen(port, () => resolve([subject, port]));
    });

  const signCert = () => {
    (forge as any).options.usePureJavaScript = true;
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = "01";
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(
      cert.validity.notBefore.getFullYear() + 1,
    );
    const attrs = [
      { name: "commonName", value: "localhost" },
      { name: "countryName", value: "DE" },
      { name: "organizationName", value: "ExpressZodAPI" },
      { shortName: "OU", value: "DEV" },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([
      { name: "basicConstraints", cA: true },
      {
        name: "keyUsage",
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true,
      },
      { name: "extKeyUsage", serverAuth: true, clientAuth: true },
      {
        name: "subjectAltName",
        altNames: [{ type: 2, value: "localhost" }],
      },
    ]);
    cert.sign(keys.privateKey, forge.md.sha256.create());
    return {
      cert: forge.pki.certificateToPem(cert),
      key: forge.pki.privateKeyToPem(keys.privateKey),
    };
  };

  const makeHttpsServer = (handler: http.RequestListener) =>
    new Promise<[https.Server, number]>((resolve) => {
      const subject = https.createServer(signCert(), handler);
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
      const graceful = monitor({ server: httpServer });
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
      const graceful = monitor({
        timeout: 150,
        server: httpServer,
      });
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
      const graceful = monitor({
        timeout: 150,
        server: httpServer,
      });
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
      const graceful = monitor({
        timeout: 150,
        server: httpServer,
      });
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
      const graceful = monitor({
        timeout: 150,
        server: httpServer,
      });
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
    const graceful = monitor({
      timeout: 150,
      server: httpServer,
    });
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
      const graceful = monitor({
        timeout: 150,
        server: httpsServer,
      });
      await fetch(`https://localhost:${port}`, {
        dispatcher: new Agent({ connect: { rejectUnauthorized: false } }),
        headers: { connection: "close" },
      });
      await setTimeout(50);
      expect(graceful.sockets.size).toBe(0);
      await graceful.shutdown();
    },
  );

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
      const graceful = monitor({
        timeout: 500,
        server: httpServer,
      });
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
