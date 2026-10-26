import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

async function actualHealthcheck(tls: boolean, status: number) {
  const source = readFileSync("services/app/healthcheck.mjs", "utf8").replace(
    /^import .*;\n/gm,
    "",
  );
  const urls: string[] = [];
  const requests: Record<string, unknown>[] = [];
  const reads: string[] = [];
  let finish: (value: number) => void = () => {};
  const ended = new Promise<number>((resolve) => {
    finish = resolve;
  });
  const env = tls
    ? {
        PORT: "3001",
        KLARWERK_TLS_CERT_FILE: "synthetic-cert",
        KLARWERK_TLS_CA_FILE: "synthetic-ca",
        KLARWERK_TLS_SERVERNAME: "app.example.test",
      }
    : { PORT: "3001" };
  const processPort = { env, exit: (code: number) => finish(code) };
  const fetchPort = (url: string) => {
    urls.push(url);
    return Promise.resolve({ ok: status === 200 });
  };
  const requestPort = (options: Record<string, unknown>, callback: (response: unknown) => void) => {
    requests.push(options);
    return {
      on: () => {},
      destroy: () => {},
      end: () => queueMicrotask(() => callback({ statusCode: status, resume: () => {} })),
    };
  };
  const readPort = (path: string) => {
    reads.push(path);
    return Buffer.from("SYNTHETIC-CA");
  };
  new Function("process", "fetch", "request", "readFileSync", source)(
    processPort,
    fetchPort,
    requestPort,
    readPort,
  );
  return { exit: await ended, urls, requests, reads };
}
describe("W4.7 echter Container-Caller mit kontrollierten Inprozessports", () => {
  it("Klartext fragt ausschliesslich die lokale Readiness ab und wertet 503 rot", async () => {
    const good = await actualHealthcheck(false, 200);
    expect(good.exit).toBe(0);
    expect(good.urls).toEqual(["http://127.0.0.1:3001/ready"]);
    expect(good.requests).toEqual([]);
    expect((await actualHealthcheck(false, 503)).exit).toBe(1);
  });
  it("TLS behaelt CA, Servername und normale Zertifikatspruefung auf /ready", async () => {
    const result = await actualHealthcheck(true, 200);
    expect(result.exit).toBe(0);
    expect(result.urls).toEqual([]);
    expect(result.reads).toEqual(["synthetic-ca"]);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]).toMatchObject({
      host: "127.0.0.1",
      port: "3001",
      path: "/ready",
      servername: "app.example.test",
      timeout: 3000,
      ca: Buffer.from("SYNTHETIC-CA"),
    });
    expect(result.requests[0]?.rejectUnauthorized).not.toBe(false);
    expect((await actualHealthcheck(true, 503)).exit).toBe(1);
  });
});
