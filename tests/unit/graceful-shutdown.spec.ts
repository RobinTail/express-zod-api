import https from "node:https";
import { setTimeout } from "node:timers/promises";
import http, { RequestListener } from "node:http";
import { Agent } from "undici";
import { graceful } from "../../src/graceful-shutdown";
import { givePort } from "../helpers";
import forge from "node-forge";

describe("graceful()", () => {
  const makeHttpServer = (handler: RequestListener) =>
    new Promise<[http.Server, number]>((resolve) => {
      const subject = http.createServer(handler);
      const port = givePort();
      subject.listen(port, () => resolve([subject, port]));
    });

  const makeHttpsServer = (handler: RequestListener) =>
    new Promise<[https.Server, number]>((resolve) => {
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
      const subject = https.createServer(
        {
          cert: forge.pki.certificateToPem(cert),
          key: forge.pki.privateKeyToPem(keys.privateKey),
        },
        handler,
      );
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
      const [httpServer] = await makeHttpServer(vi.fn());
      expect(httpServer.listening).toBeTruthy();
      const terminator = graceful({ server: httpServer });
      await terminator.shutdown();
      expect(httpServer.listening).toBeFalsy();
    },
  );

  test(
    "terminates hanging sockets after httpResponseTimeout",
    { timeout: 500 },
    async () => {
      const handler = vi.fn();
      const [httpServer, port] = await makeHttpServer(handler);
      const terminator = graceful({
        timeout: 150,
        server: httpServer,
      });
      void fetch(`http://localhost:${port}`, {
        headers: { connection: "close" },
      }).catch(vi.fn());
      await setTimeout(50);
      expect(handler).toHaveBeenCalled();
      void terminator.shutdown();
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
      const [httpServer, port] = await makeHttpServer(async ({}, res) => {
        await setTimeout(100);
        res.end("foo");
      });
      const terminator = graceful({
        timeout: 150,
        server: httpServer,
      });
      const request0 = fetch(`http://localhost:${port}`, {
        headers: { connection: "close" },
      });
      await setTimeout(50);
      void terminator.shutdown();
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
      const terminator = graceful({
        timeout: 150,
        server: httpServer,
      });
      const request = fetch(`http://localhost:${port}`, { keepalive: true });
      await setTimeout(50);
      void terminator.shutdown();
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
          // Unable to intercept the response without the delay.
          // When `end()` is called immediately, the `request` event
          // already has `headersSent=true`. It is unclear how to intercept
          // the response beforehand.
          await setTimeout(50);
          res.end("baz");
        });
      const [httpServer, port] = await makeHttpServer(handler);
      const terminator = graceful({
        timeout: 150,
        server: httpServer,
      });
      const dispatcher = new Agent({ pipelining: 5, keepAliveTimeout: 5e3 });
      const request0 = fetch(`http://localhost:${port}`, { dispatcher });
      await setTimeout(50);
      void terminator.shutdown();
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
    const terminator = graceful({
      timeout: 150,
      server: httpServer,
    });
    await fetch(`http://localhost:${port}`, {
      headers: { connection: "close" },
    });
    await setTimeout(50);
    expect(terminator.sockets.size).toBe(0);
    await terminator.shutdown();
  });

  test(
    "empties internal socket collection for https server",
    { timeout: 500 },
    async () => {
      const [httpsServer, port] = await makeHttpsServer(({}, res) => {
        res.end("foo");
      });
      const terminator = graceful({
        timeout: 150,
        server: httpsServer,
      });
      await fetch(`https://localhost:${port}`, {
        dispatcher: new Agent({ connect: { rejectUnauthorized: false } }),
        headers: { connection: "close" },
      });
      await setTimeout(50);
      expect(terminator.sockets.size).toBe(0);
      await terminator.shutdown();
    },
  );

  test(
    "closes immediately after in-flight connections are closed (#16)",
    { timeout: 1e3 },
    async () => {
      const spy = vi.fn<RequestListener>(async ({}, res) => {
        await setTimeout(100);
        res.end("foo");
      });
      const [httpServer, port] = await makeHttpServer(spy);
      expect(httpServer.listening).toBeTruthy();
      const terminator = graceful({
        timeout: 500,
        server: httpServer,
      });
      void fetch(`http://localhost:${port}`, {
        headers: { connection: "close" },
      });
      await setTimeout(50);
      await expect(getConnections(httpServer)).resolves.toBe(1);
      void terminator.shutdown();
      // Wait for serverResponse.end to be called, plus a few extra ms for the
      // terminator to finish polling in-flight connections. (Do not, however, wait
      // long enough to trigger graceful termination.)
      await setTimeout(75);
      await expect(getConnections(httpServer)).resolves.toBe(0);
    },
  );
});
