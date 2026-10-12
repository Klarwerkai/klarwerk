// ================================================================================================
// R-2057 / NFR-SEC-02 — „Transport durchgängig TLS", AUCH VOM PROXY ZUR ANWENDUNG.
// ================================================================================================
//
// DER BEFUND (Betriebsbefund 08.10.2026): der Proxy erreichte die Anwendung im Docker-Netz unter
// `http://<app>:3000/health` im Klartext; `https://` an denselben Port scheiterte mit „wrong version
// number" — die Anwendung konnte kein TLS. Hier steht dieselbe Frage am echten Socket, gegen den
// echten Aufbau (`buildApp` + `transport-tls.ts`), so wie der Proxy sie stellt:
//
//   T1 — HTTPS mit Prüfung gegen den Vertrauensanker und Namensprüfung → 200, `authorized`.
//   T2 — Klartext-HTTP an DENSELBEN Port → keine Antwort (der Gegenfall des Befunds).
//   T3 — Gegenprobe Zertifikatsprüfung: ein fremder Vertrauensanker → abgelehnt.
//   T4 — Gegenprobe Namensprüfung: ein anderer Servername → abgelehnt.
//   T5 — ohne TLS-Konfiguration bleibt der Port Klartext (Kalibrierung: T2 misst also TLS).
//
// Dazu die Startregeln aus `leseTransportTls` (halbe Konfiguration, unlesbare Datei, Pflicht).
//
// GRENZE: das belegt die Fähigkeit der Anwendung, nicht die Umstellung einer Installation. Den
// Proxy auf `https` mit Upstream-Prüfung umzustellen und das an der Installation zu messen, steht in
// docs/operations/tls-bis-zur-anwendung.md und ist Betriebsarbeit.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { get as httpGet } from "node:http";
import { request as httpsRequest } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TLSSocket } from "node:tls";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  TLS_CERT_ENV,
  TLS_KEY_ENV,
  TLS_PFLICHT_ENV,
  TransportTlsError,
  klartextWarnung,
  leseTransportTls,
} from "../../services/app/src/transport-tls";
import { pruefeSelbst, testzertifikat } from "./tls-testzertifikat";

const NAME = "klarwerk-app";

interface Antwort {
  status: number;
  body: string;
  protokoll: string | null;
  autorisiert: boolean;
}

function perHttps(port: number, ca: string, servername: string): Promise<Antwort> {
  return new Promise((resolve, reject) => {
    const anfrage = httpsRequest(
      { host: "127.0.0.1", port, path: "/health", ca, servername, agent: false },
      (antwort) => {
        const socket = antwort.socket as TLSSocket;
        const protokoll = socket.getProtocol();
        const autorisiert = socket.authorized;
        let body = "";
        antwort.setEncoding("utf8");
        antwort.on("data", (teil: string) => {
          body += teil;
        });
        antwort.on("end", () =>
          resolve({ status: antwort.statusCode ?? 0, body, protokoll, autorisiert }),
        );
      },
    );
    anfrage.setTimeout(5000, () => anfrage.destroy(new Error("Zeitüberschreitung")));
    anfrage.on("error", reject);
    anfrage.end();
  });
}

function perKlartext(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const anfrage = httpGet({ host: "127.0.0.1", port, path: "/health", agent: false }, (a) => {
      a.resume();
      resolve(a.statusCode ?? 0);
    });
    anfrage.setTimeout(5000, () => anfrage.destroy(new Error("Zeitüberschreitung")));
    anfrage.on("error", reject);
  });
}

describe("R-2057 · der App-Port spricht TLS, wenn er dafür eingerichtet ist", () => {
  const z = testzertifikat(NAME);
  const fremd = testzertifikat(NAME);
  let app: FastifyInstance | undefined;
  let port = 0;

  beforeAll(async () => {
    // Kalibrierung des Hilfsmittels: Node liest beide Zertifikate als wohlgeformt.
    pruefeSelbst(z, NAME);
    pruefeSelbst(fremd, NAME);
    const tlsApp = buildApp(buildServices(), {
      tls: { cert: Buffer.from(z.cert), key: Buffer.from(z.key) },
    });
    app = tlsApp;
    await tlsApp.listen({ port: 0, host: "127.0.0.1" });
    const adresse = tlsApp.server.address();
    port = typeof adresse === "object" && adresse ? adresse.port : 0;
  });

  afterAll(async () => {
    await app?.close();
  });

  it("T1 · HTTPS mit Zertifikats- und Namensprüfung → 200 über TLS", async () => {
    const a = await perHttps(port, z.cert, NAME);
    expect(a.status).toBe(200);
    expect((JSON.parse(a.body) as { status: string }).status).toBe("ok");
    expect(a.autorisiert).toBe(true);
    expect(a.protokoll).toMatch(/^TLSv1\.[23]$/);
  });

  it("T2 · Klartext-HTTP an denselben Port bekommt keine Antwort", async () => {
    await expect(perKlartext(port)).rejects.toThrow();
  });

  it("T3 · Gegenprobe: ein fremder Vertrauensanker wird abgelehnt", async () => {
    await expect(perHttps(port, fremd.cert, NAME)).rejects.toMatchObject({
      code: expect.stringMatching(/CERT|SIGNATURE|SELF_SIGNED|ISSUER/),
    });
  });

  it("T4 · Gegenprobe: ein anderer Servername wird abgelehnt", async () => {
    await expect(perHttps(port, z.cert, "anderer-name")).rejects.toMatchObject({
      code: "ERR_TLS_CERT_ALTNAME_INVALID",
    });
  });

  it("T5 · Kalibrierung: ohne TLS-Konfiguration antwortet derselbe Aufbau im Klartext", async () => {
    const klar = buildApp(buildServices());
    try {
      await klar.listen({ port: 0, host: "127.0.0.1" });
      const adresse = klar.server.address();
      const p = typeof adresse === "object" && adresse ? adresse.port : 0;
      expect(await perKlartext(p)).toBe(200);
    } finally {
      await klar.close();
    }
  });
});

describe("R-2057 · Startregeln für TLS am App-Port", () => {
  const ordner = mkdtempSync(join(tmpdir(), "klarwerk-tls-"));
  const certPfad = join(ordner, "cert.pem");
  const keyPfad = join(ordner, "key.pem");
  const z = testzertifikat(NAME);
  writeFileSync(certPfad, z.cert);
  writeFileSync(keyPfad, z.key);

  afterAll(() => rmSync(ordner, { recursive: true, force: true }));

  it("beide Dateien gesetzt → Zertifikat und Schlüssel werden gelesen", () => {
    const tls = leseTransportTls({ [TLS_CERT_ENV]: certPfad, [TLS_KEY_ENV]: keyPfad });
    expect(tls?.cert.toString()).toBe(z.cert);
    expect(tls?.key.toString()).toBe(z.key);
  });

  it("nichts gesetzt → Klartext wie bisher (undefined)", () => {
    expect(leseTransportTls({})).toBeUndefined();
  });

  it("nur eine Variable gesetzt → Startabbruch mit beiden Namen", () => {
    for (const env of [{ [TLS_CERT_ENV]: certPfad }, { [TLS_KEY_ENV]: keyPfad }]) {
      expect(() => leseTransportTls(env)).toThrow(TransportTlsError);
      expect(() => leseTransportTls(env)).toThrow(new RegExp(`${TLS_CERT_ENV}.*${TLS_KEY_ENV}`));
    }
  });

  it("unlesbare Datei → Startabbruch, die Meldung nennt die Variable, nicht den Inhalt", () => {
    const env = { [TLS_CERT_ENV]: join(ordner, "fehlt.pem"), [TLS_KEY_ENV]: keyPfad };
    expect(() => leseTransportTls(env)).toThrow(
      `${TLS_CERT_ENV} zeigt auf eine nicht lesbare Datei.`,
    );
  });

  it(`${TLS_PFLICHT_ENV}=1 ohne Zertifikat → Startabbruch; mit Zertifikat → TLS`, () => {
    expect(() => leseTransportTls({ [TLS_PFLICHT_ENV]: "1" })).toThrow(TransportTlsError);
    const env = { [TLS_PFLICHT_ENV]: "1", [TLS_CERT_ENV]: certPfad, [TLS_KEY_ENV]: keyPfad };
    expect(leseTransportTls(env)).toBeDefined();
  });

  it("Klartext in Produktion wird laut gemeldet; mit TLS oder ausserhalb Produktion nicht", () => {
    expect(klartextWarnung(undefined, { NODE_ENV: "production" })).toContain("R-2057");
    expect(klartextWarnung(undefined, { NODE_ENV: "test" })).toBeUndefined();
    const tls = { cert: Buffer.from(z.cert), key: Buffer.from(z.key) };
    expect(klartextWarnung(tls, { NODE_ENV: "production" })).toBeUndefined();
  });
});
