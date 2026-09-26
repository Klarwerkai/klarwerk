import { X509Certificate } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { sha256, synthetischesPng } from "./kundeninstallation/datei";
import { dokumentierterBlock } from "./kundeninstallation/installation";
import {
  type Dienstmessung,
  type Inhaltsstand,
  bewerteInhalt,
  bewerteNeustart,
  entferneQuotedPrintable,
  resetZiele,
  roteNachweise,
  schwaerze,
} from "./kundeninstallation/nachweise";
import { STRECKE, streckeBenannt } from "./kundeninstallation/pflicht";
import { httpsGet, tlsErzeugen } from "./kundeninstallation/pruefplatz";

// ==================================================================================================
// KALIBRIERUNG DER KUNDENINSTALLATIONS-STRECKE — was die Nachweise sagen, ohne Pruefplatz gemessen.
// ==================================================================================================
//
// Die Strecke selbst (`kundeninstallation-strecke.integration.test.ts`) braucht Docker, HTTPS und
// Chromium und laeuft nur auf dem Linux-Pruefplatz. Ihre BEWERTUNG ist reine Logik und wird hier in
// jedem Tor gemessen: jede Verstellung trifft GENAU ihren Nachweis (die Grundlage der Gegenproben K7),
// der Kennwort-Link wird aus einer echten nodemailer-Kodierung richtig gelesen, Geheimnisse
// verschwinden aus Belegen. Dazu die Verdrahtung: wann die Strecke Pflicht ist, und dass sie
// ihre Proxy-Konfiguration aus der Anleitung liest statt aus einer Kopie.
const WURZEL = resolve(import.meta.dirname, "../..");

const container = (id: string, startedAt: string, pid: number) => ({
  id,
  status: "running",
  startedAt,
  pid,
});
const VORHER: Dienstmessung = {
  app: container("a1", "2026-09-25T10:00:00Z", 101),
  db: container("d1", "2026-09-25T09:59:50Z", 99),
  pgStart: "2026-09-25 09:59:51+00",
  volume: { name: "kn_pgdata", createdAt: "2026-09-25T09:59:40Z" },
};
const ECHTER_NEUSTART: Dienstmessung = {
  app: container("a1", "2026-09-25T10:05:00Z", 301),
  db: container("d1", "2026-09-25T10:04:50Z", 299),
  pgStart: "2026-09-25 10:04:51+00",
  volume: VORHER.volume,
};

const SOLL: Inhaltsstand = {
  kennung: "k-1",
  fassung: "1",
  titel: "Abnahme „Größe“",
  text: "Grüße · 東京 · 😀",
  quellen: ["Protokoll ⟶ beleg.png ⟶ Seite 1"],
  dateiSha256: "ab".repeat(32),
};

describe("Kundeninstallation · die Nachweise treffen genau ihren Fehlerfall", () => {
  it("N · ein echter Neustart beider Dienste ist in allen vier Nachweisen gruen", () => {
    expect(roteNachweise(bewerteNeustart(VORHER, ECHTER_NEUSTART))).toEqual([]);
  });

  it("N · ausgelassener DB-Neustart: nur `dbNeustart` rot", () => {
    const nurApp: Dienstmessung = { ...ECHTER_NEUSTART, db: VORHER.db, pgStart: VORHER.pgStart };
    expect(roteNachweise(bewerteNeustart(VORHER, nurApp))).toEqual(["dbNeustart"]);
  });

  it("N · neuer DB-Container, aber derselbe PostgreSQL-Start zaehlt NICHT als DB-Neustart", () => {
    const ohnePg: Dienstmessung = { ...ECHTER_NEUSTART, pgStart: VORHER.pgStart };
    expect(roteNachweise(bewerteNeustart(VORHER, ohnePg))).toEqual(["dbNeustart"]);
  });

  it("N · ausgelassener App-Neustart: nur `appNeustart` rot", () => {
    const nurDb: Dienstmessung = { ...ECHTER_NEUSTART, app: VORHER.app };
    expect(roteNachweise(bewerteNeustart(VORHER, nurDb))).toEqual(["appNeustart"]);
  });

  it("N · ersetztes Volume oder neu angelegte Container fallen einzeln auf", () => {
    const neuesVolume: Dienstmessung = {
      ...ECHTER_NEUSTART,
      volume: { name: "kn_pgdata", createdAt: "2026-09-25T10:04:40Z" },
    };
    expect(roteNachweise(bewerteNeustart(VORHER, neuesVolume))).toEqual(["volumeErhalten"]);
    const neuerContainer: Dienstmessung = {
      ...ECHTER_NEUSTART,
      app: { ...ECHTER_NEUSTART.app, id: "a2" },
    };
    expect(roteNachweise(bewerteNeustart(VORHER, neuerContainer))).toEqual(["containerErhalten"]);
  });

  it("I · unveraenderter Inhalt ist gruen; fehlende Datei macht NUR `datei` rot", () => {
    expect(roteNachweise(bewerteInhalt(SOLL, { ...SOLL }))).toEqual([]);
    expect(roteNachweise(bewerteInhalt(SOLL, { ...SOLL, dateiSha256: null }))).toEqual(["datei"]);
    expect(roteNachweise(bewerteInhalt(SOLL, { ...SOLL, dateiSha256: "cd".repeat(32) }))).toEqual([
      "datei",
    ]);
  });

  it("I · jede andere Abweichung trifft genau ihren Nachweis", () => {
    expect(roteNachweise(bewerteInhalt(SOLL, { ...SOLL, kennung: "k-2" }))).toEqual(["kennung"]);
    expect(roteNachweise(bewerteInhalt(SOLL, { ...SOLL, fassung: "2" }))).toEqual(["fassung"]);
    expect(roteNachweise(bewerteInhalt(SOLL, { ...SOLL, text: "Gruesse" }))).toEqual(["text"]);
    expect(roteNachweise(bewerteInhalt(SOLL, { ...SOLL, quellen: [] }))).toEqual(["quelle"]);
    expect(
      roteNachweise(bewerteInhalt(SOLL, { ...SOLL, quellen: ["Protokoll ⟶  ⟶ Seite 1"] })),
      "Eine Quelle, die ihren Anhang verloren hat, ist nicht dieselbe Quellenzuordnung",
    ).toEqual(["quelle"]);
  });

  it("I · ein Soll ohne Datei-Pruefsumme kann nie gruen sein", () => {
    const leer = { ...SOLL, dateiSha256: null };
    expect(bewerteInhalt(leer, leer).datei).toBe(false);
  });
});

describe("Kundeninstallation · Kennwort-Link und Belege", () => {
  it("M · der Link wird aus Quoted-Printable mit weichem Umbruch richtig gelesen, ohne Token", () => {
    // So kodiert nodemailer einen Text mit Umlauten: `=3D` fuer `=`, `=\r\n` als weicher Umbruch.
    const roh =
      "Content-Transfer-Encoding: quoted-printable\r\n\r\nzum Zur=C3=BCcksetzen =C3=B6ffne:\r\n" +
      "https://kundeninstanz.pruefplatz.test/reset?token=3Dabc123def456abc123def4=\r\n56abc\r\n";
    expect(entferneQuotedPrintable("Zur=C3=BCck")).toBe("Zurück");
    expect(resetZiele(roh)).toEqual([
      { origin: "https://kundeninstanz.pruefplatz.test", pfad: "/reset" },
    ]);
    expect(JSON.stringify(resetZiele(roh))).not.toContain("abc123");
  });

  it("M · ein Link auf eine fremde Instanz ist als fremd erkennbar", () => {
    const ziele = resetZiele("https://app.klarwerk.ai/reset?token=x\n");
    expect(ziele).toEqual([{ origin: "https://app.klarwerk.ai", pfad: "/reset" }]);
  });

  it("B · Geheimnisse verschwinden aus Belegen", () => {
    const text = schwaerze('{"url":"postgres://k:GEHEIM-123456@db"}', ["GEHEIM-123456"]);
    expect(text).not.toContain("GEHEIM-123456");
    expect(text).toContain("‹geschwaerzt›");
  });
});

describe("Kundeninstallation · Datei und Verdrahtung", () => {
  it("D · die synthetische Datei ist ein echtes PNG mit festem SHA-256", () => {
    const a = synthetischesPng("probe");
    expect(a.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(sha256(a)).toBe(sha256(synthetischesPng("probe")));
    expect(sha256(a)).not.toBe(sha256(synthetischesPng("andere")));
    // IDAT laesst sich entpacken und traegt genau 48 Zeilen à (1 + 48·3) Bytes.
    const idat = a.indexOf(Buffer.from("IDAT"));
    const laenge = a.readUInt32BE(idat - 4);
    expect(inflateSync(a.subarray(idat + 4, idat + 4 + laenge)).length).toBe(48 * (1 + 48 * 3));
  });

  it("V · ausdruecklich benannt ist die Strecke Pflicht; im allgemeinen Lauf und im Tor nicht", () => {
    // Genau so ruft der gezielte Pruefweg des Testservers eine benannte Integrationsdatei auf.
    expect(
      streckeBenannt([
        "run",
        "--config",
        "vitest.integration.config.ts",
        `tests/neuinstallation/${STRECKE}`,
      ]),
    ).toBe(true);
    expect(streckeBenannt(["run", "tests/neuinstallation/kundeninstallation-strecke"])).toBe(true);
    // `npm run test:integration` ohne Filter und andere benannte Dateien: nicht Pflicht.
    expect(streckeBenannt(["run", "--config", "vitest.integration.config.ts"])).toBe(false);
    expect(
      streckeBenannt(["run", "tests/neuinstallation/erstinstallation.integration.test.ts"]),
    ).toBe(false);
    expect(existsSync(join(WURZEL, "tests/neuinstallation", STRECKE))).toBe(true);
    const konfig = readFileSync(join(WURZEL, "vitest.integration.config.ts"), "utf8");
    expect(konfig).toContain("streckeBenannt(process.argv.slice(2))");
    // Das Tor bleibt frei davon: ein Compose-Bau im Tor sperrte jeden anderen Auftrag.
    expect(readFileSync(join(WURZEL, "tools/check"), "utf8")).not.toContain("kundeninstallation");
  });

  it("V · die Proxy-Konfiguration der Strecke IST der Block aus der Anleitung", () => {
    const anleitung = readFileSync(
      join(WURZEL, "docs/operations/kundeninstanz-neuinstallation.md"),
      "utf8",
    );
    const block = dokumentierterBlock(anleitung, "caddyfile-eigenes-zertifikat");
    expect(block).toContain("https://kundeninstanz.pruefplatz.test {");
    expect(block).toContain("reverse_proxy app:3001");
    expect(block).toContain("tls /certs/instanz.pem /certs/instanz-key.pem");
  });

  it("V · `.env.example` belegt APP_BASE_URL nicht vor — sonst kaeme eine Kopie an der Pflicht vorbei", () => {
    const beispiel = readFileSync(join(WURZEL, ".env.example"), "utf8");
    const zeile = beispiel.split("\n").find((z) => z.startsWith("APP_BASE_URL="));
    expect(zeile).toBe("APP_BASE_URL=");
  });
});

describe("Kundeninstallation · TLS aus einem frischen Ausgangszustand", () => {
  // RUNDE 2 (Bens Befund K1): die Strecke uebergab einen noch NICHT vorhandenen Unterordner, und
  // openssl scheiterte mit „No such file or directory". Gemessen wird deshalb genau dieser Ausgangs-
  // zustand — und danach, dass das Zertifikat bei einem echten Handschlag nur MIT der Test-CA traegt.
  it("T · tlsErzeugen legt den Ordner selbst an; Handschlag mit Test-CA gelingt, ohne scheitert", async () => {
    const wurzel = mkdtempSync(join(tmpdir(), "kn-tls-probe-"));
    const ordner = join(wurzel, "tls", "noch-nicht-da");
    try {
      expect(existsSync(ordner)).toBe(false);
      const tls = await tlsErzeugen(ordner, "kundeninstanz.pruefplatz.test", "probe");
      const server = new X509Certificate(readFileSync(join(ordner, "instanz.pem")));
      const ca = new X509Certificate(tls.caPem);
      expect(server.verify(ca.publicKey)).toBe(true);
      expect(server.subjectAltName).toBe("DNS:kundeninstanz.pruefplatz.test");
      expect(tls.caFingerabdruck).toBe(ca.fingerprint256);

      const https = createServer(
        {
          cert: readFileSync(join(ordner, "instanz.pem")),
          key: readFileSync(join(ordner, "instanz-key.pem")),
        },
        (_anfrage, antwort) => antwort.end('{"status":"ok"}'),
      );
      await new Promise<void>((fertig) => https.listen(0, "127.0.0.1", fertig));
      const adresse = https.address();
      const port = typeof adresse === "object" && adresse ? adresse.port : 0;
      try {
        const mitCa = await httpsGet(
          "kundeninstanz.pruefplatz.test",
          "/health",
          tls.caPem,
          10_000,
          port,
        );
        expect(mitCa.status).toBe(200);
        const fremdeCa = await tlsErzeugen(
          join(wurzel, "fremd"),
          "kundeninstanz.pruefplatz.test",
          "fremd",
        );
        await expect(
          httpsGet("kundeninstanz.pruefplatz.test", "/health", fremdeCa.caPem, 10_000, port),
        ).rejects.toThrow();
        await expect(
          httpsGet("anderer.name.test", "/health", tls.caPem, 10_000, port),
        ).rejects.toThrow();
      } finally {
        await new Promise((fertig) => https.close(fertig));
      }
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  }, 60_000);
});
