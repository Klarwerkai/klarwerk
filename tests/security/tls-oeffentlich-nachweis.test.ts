// ================================================================================================
// Aufnahme `gesamt-tls-betrieb` — die Probe für den ÖFFENTLICHEN Betriebsweg (R-0816, R-0822,
// NFR-SEC-02): `scripts/betrieb/tls-oeffentlich-nachweis.mjs`.
// ================================================================================================
//
// Die Probe läuft im Betrieb gegen klarwerk.ai und app.klarwerk.ai. Hier läuft sie gegen echte
// Sockets auf 127.0.0.1 — die HTTPS-Seite ist die ECHTE Anwendung (`buildApp` mit TLS und
// `registerSecurityHeaders`), die Klartextseite einmal ein umleitender Vermittler und einmal die
// Anwendung selbst im Klartext. Geprüft wird, dass jede Probe zwischen bestanden, durchgefallen und
// ungeklärt richtig unterscheidet; ungeklärt darf nie als bestanden durchgehen.
//
// GRENZE: Das belegt die Probe, nicht den Betrieb. Gemessen ist der laufende Vermittler erst, wenn
// Ops/Pedi die Probe gegen die Installation fahren (docs/operations/tls-bis-zur-anwendung.md).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  type IncomingMessage,
  type ServerResponse,
  createServer as createHttpServer,
} from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { type Server, createServer as createNetServer } from "node:net";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  HSTS_MINDEST_MAX_AGE,
  KLARTEXT_PFADE,
  MAX_WEITERLEITUNGEN,
  type ProbenZiel,
  TASKPANE_PFAD,
  nachweis,
  pruefeHost,
  pruefeKlartext,
  pruefeStartweg,
  pruefeZertifikat,
} from "../../scripts/betrieb/tls-oeffentlich-nachweis.mjs";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { registerSecurityHeaders } from "../../services/app/src/security-headers";
import { repoPfad } from "../support/repoPfad";
import { pruefeSelbst, testzertifikat } from "./tls-testzertifikat";

const NAME = "klarwerk-test";
const PROBE = repoPfad("scripts/betrieb/tls-oeffentlich-nachweis.mjs");

function lausche(server: Server): Promise<number> {
  return new Promise((fertig) => {
    server.listen(0, "127.0.0.1", () => {
      const adresse = server.address();
      fertig(typeof adresse === "object" && adresse ? adresse.port : 0);
    });
  });
}

function schliesse(server: Server): Promise<void> {
  return new Promise((fertig) => server.close(() => fertig()));
}

// Ein Port, an dem garantiert niemand lauscht: kurz belegen, wieder freigeben.
async function geschlossenerPort(): Promise<number> {
  const server = createNetServer();
  const port = await lausche(server);
  await schliesse(server);
  return port;
}

async function anwendung(tls?: { cert: string; key: string }): Promise<FastifyInstance> {
  const app = buildApp(buildServices(), {
    tls: tls ? { cert: Buffer.from(tls.cert), key: Buffer.from(tls.key) } : undefined,
  });
  await registerSecurityHeaders(app);
  app.get(TASKPANE_PFAD, async (_request, reply) => reply.type("text/html").send("Taskpane"));
  await app.listen({ port: 0, host: "127.0.0.1" });
  return app;
}

// Leitet jede Anfrage pfaderhaltend auf `<schema>://NAME:<port>` um. Der Port wird erst beim Aufruf
// gelesen, weil er erst nach `listen` feststeht.
function weiter(status: number, schema: "http" | "https", port: () => number) {
  return (anfrage: IncomingMessage, antwort: ServerResponse): void => {
    const ort = `${schema}://${NAME}:${port()}${anfrage.url ?? "/"}`;
    antwort.writeHead(status, { Location: ort }).end();
  };
}

function portVon(app: FastifyInstance): number {
  const adresse = app.server.address();
  return typeof adresse === "object" && adresse ? adresse.port : 0;
}

describe("R-0816 / R-0822 · Probe am öffentlichen Betriebsweg", () => {
  const z = testzertifikat(NAME);
  const fremd = testzertifikat(NAME);
  let tlsApp: FastifyInstance | undefined;
  let klarApp: FastifyInstance | undefined;
  const server: Server[] = [];
  let httpsPort = 0;
  let klarPort = 0;
  let umleitungPort = 0;
  let httpUmleitungPort = 0;
  let ohneHstsPort = 0;
  let zuPort = 0;
  // Nacharbeit 2 (Ben): Ketten mit HTTPS-Zwischenstation.
  let zwischenGutPort = 0;
  let zumZwischenGutPort = 0;
  let rueckfallStationPort = 0;
  let zurRueckfallPort = 0;
  let fremdStationPort = 0;
  let zurFremdStationPort = 0;
  let schleifePort = 0;
  let zurSchleifePort = 0;

  beforeAll(async () => {
    pruefeSelbst(z, NAME);
    tlsApp = await anwendung(z);
    httpsPort = portVon(tlsApp);
    klarApp = await anwendung();
    klarPort = portVon(klarApp);

    const tls = { cert: z.cert, key: z.key };
    // Ein Vermittler, wie er sein soll: jede Klartext-Anfrage geht auf die echte Anwendung über TLS.
    const umleitung = createHttpServer(weiter(308, "https", () => httpsPort));
    // Ein Vermittler, der nur auf einen anderen Klartext-Ort umleitet.
    const httpUmleitung = createHttpServer(weiter(301, "http", () => 8080));
    // Eine HTTPS-Gegenstelle mit gültigem Zertifikat, aber ohne HSTS.
    const ohneHsts = createHttpsServer(tls, (_anfrage, antwort) => {
      antwort.writeHead(200, { "Content-Type": "text/html" }).end("Taskpane");
    });
    // HTTP → HTTPS-Zwischenstation → HTTPS-Anwendung (zwei Schritte, alles verschlüsselt).
    const zwischenGut = createHttpsServer(
      tls,
      weiter(302, "https", () => httpsPort),
    );
    const zumZwischenGut = createHttpServer(weiter(301, "https", () => zwischenGutPort));
    // HTTP → HTTPS-Zwischenstation → HTTP: der Rückfall in den Klartext hinter dem ersten Schritt.
    const rueckfallStation = createHttpsServer(
      tls,
      weiter(302, "http", () => klarPort),
    );
    const zurRueckfall = createHttpServer(weiter(301, "https", () => rueckfallStationPort));
    // HTTP → HTTPS-Ziel mit einem Zertifikat, dem der Anker nicht traut.
    const fremdStation = createHttpsServer({ cert: fremd.cert, key: fremd.key }, (_a, antwort) => {
      antwort.writeHead(200, { "Content-Type": "text/html" }).end("Taskpane");
    });
    const zurFremdStation = createHttpServer(weiter(301, "https", () => fremdStationPort));
    // HTTP → HTTPS-Station, die immer wieder auf sich selbst umleitet.
    const schleife = createHttpsServer(
      tls,
      weiter(302, "https", () => schleifePort),
    );
    const zurSchleife = createHttpServer(weiter(301, "https", () => schleifePort));

    server.push(umleitung, httpUmleitung, ohneHsts, zwischenGut, zumZwischenGut, rueckfallStation);
    server.push(zurRueckfall, fremdStation, zurFremdStation, schleife, zurSchleife);
    umleitungPort = await lausche(umleitung);
    httpUmleitungPort = await lausche(httpUmleitung);
    ohneHstsPort = await lausche(ohneHsts);
    zwischenGutPort = await lausche(zwischenGut);
    zumZwischenGutPort = await lausche(zumZwischenGut);
    rueckfallStationPort = await lausche(rueckfallStation);
    zurRueckfallPort = await lausche(zurRueckfall);
    fremdStationPort = await lausche(fremdStation);
    zurFremdStationPort = await lausche(zurFremdStation);
    schleifePort = await lausche(schleife);
    zurSchleifePort = await lausche(zurSchleife);
    zuPort = await geschlossenerPort();
  });

  afterAll(async () => {
    await tlsApp?.close();
    await klarApp?.close();
    await Promise.all(server.map(schliesse));
  });

  const ziel = (zusatz: Partial<ProbenZiel> = {}): ProbenZiel => ({
    host: NAME,
    adresse: "127.0.0.1",
    ca: z.cert,
    mindestRestTage: 0,
    ...zusatz,
  });

  describe("O1 · das ausgelieferte Zertifikat", () => {
    it("gültig mit Namensprüfung → bestanden; Aussteller, Laufzeit und Protokoll stehen im Beleg", async () => {
      const p = await pruefeZertifikat(ziel({ httpsPort }));
      expect(p.ergebnis, p.grund).toBe("bestanden");
      expect(p.protokoll).toMatch(/^TLSv1\.[23]$/);
      expect(p.aussteller_cn).toBe(NAME);
      expect(p.laufzeit_tage).toBe(0);
      expect(p.gueltig_bis).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("Restlaufzeit unter der Grenze → durchgefallen (die Erneuerung greift nicht rechtzeitig)", async () => {
      const p = await pruefeZertifikat(ziel({ httpsPort, mindestRestTage: 14 }));
      expect(p.ergebnis).toBe("durchgefallen");
      expect(p.grund).toContain("Restlaufzeit");
    });

    it("fremder Vertrauensanker → durchgefallen als abgelehntes Zertifikat", async () => {
      const p = await pruefeZertifikat(ziel({ httpsPort, ca: fremd.cert }));
      expect(p.ergebnis).toBe("durchgefallen");
      expect(p.grund).toMatch(/^Zertifikat abgelehnt: /);
    });

    it("falscher Name → durchgefallen (ERR_TLS_CERT_ALTNAME_INVALID)", async () => {
      const p = await pruefeZertifikat(ziel({ httpsPort, host: "anderer-name" }));
      expect(p.ergebnis).toBe("durchgefallen");
      expect(p.grund).toContain("ERR_TLS_CERT_ALTNAME_INVALID");
    });

    it("niemand lauscht → ungeklärt, nicht bestanden und nicht durchgefallen", async () => {
      const p = await pruefeZertifikat(ziel({ httpsPort: zuPort }));
      expect(p.ergebnis).toBe("ungeklaert");
    });
  });

  describe("O2 · kein Klartext-Startweg für den Word-Zusatz", () => {
    it("Umleitung auf die Anwendung über TLS → bestanden für das Taskpane und /health", async () => {
      expect(KLARTEXT_PFADE).toContain(TASKPANE_PFAD);
      for (const pfad of KLARTEXT_PFADE) {
        const p = await pruefeKlartext(ziel({ httpPort: umleitungPort }), pfad);
        expect(p.ergebnis, `${pfad}: ${p.grund}`).toBe("bestanden");
        // Die Kette ist verfolgt, nicht nur der erste Schritt: das Ziel hat selbst geantwortet.
        expect(p.kette?.map((s) => s.status)).toEqual([308, 200]);
        expect(p.kette?.[1]?.url).toBe(`https://${NAME}:${httpsPort}${pfad}`);
      }
    });

    it("HTTP → HTTPS-Zwischenstation → HTTPS-Anwendung → bestanden (Kette mit zwei Schritten)", async () => {
      const p = await pruefeKlartext(ziel({ httpPort: zumZwischenGutPort }), TASKPANE_PFAD);
      expect(p.ergebnis, p.grund).toBe("bestanden");
      expect(p.kette?.map((s) => s.status)).toEqual([301, 302, 200]);
    });

    it("HTTP → HTTPS-Zwischenstation → HTTP → durchgefallen (HTTP-Rückfall hinter dem ersten Schritt)", async () => {
      const p = await pruefeKlartext(ziel({ httpPort: zurRueckfallPort }), TASKPANE_PFAD);
      expect(p.ergebnis).toBe("durchgefallen");
      expect(p.grund).toMatch(/^HTTP-Rückfall: /);
      expect(p.grund).toContain(`http://${NAME}:${klarPort}`);
      // Der erste Schritt allein hätte wie ein Erfolg ausgesehen — genau das darf nicht reichen.
      expect(p.kette?.[0]?.umleitung).toMatch(/^https:\/\//);
    });

    it("HTTP → HTTPS-Ziel mit nicht vertrautem Zertifikat → durchgefallen", async () => {
      const p = await pruefeKlartext(ziel({ httpPort: zurFremdStationPort }), TASKPANE_PFAD);
      expect(p.ergebnis).toBe("durchgefallen");
      expect(p.grund).toMatch(/^Zertifikat des Weiterleitungsziels abgelehnt: /);
    });

    it(`mehr als ${MAX_WEITERLEITUNGEN} Weiterleitungen → durchgefallen`, async () => {
      const p = await pruefeKlartext(ziel({ httpPort: zurSchleifePort }), TASKPANE_PFAD);
      expect(p.ergebnis).toBe("durchgefallen");
      expect(p.grund).toContain(`mehr als ${MAX_WEITERLEITUNGEN}`);
      expect(p.kette).toHaveLength(MAX_WEITERLEITUNGEN + 1);
    });

    it("die Anwendung selbst im Klartext liefert das Taskpane aus → durchgefallen", async () => {
      const p = await pruefeKlartext(ziel({ httpPort: klarPort }), TASKPANE_PFAD);
      expect(p.ergebnis).toBe("durchgefallen");
      expect(p.kette?.[0]?.status).toBe(200);
    });

    it("Umleitung auf einen anderen Klartext-Ort → durchgefallen", async () => {
      const p = await pruefeKlartext(ziel({ httpPort: httpUmleitungPort }), TASKPANE_PFAD);
      expect(p.ergebnis).toBe("durchgefallen");
      expect(p.grund).toMatch(/^Umleitung nicht auf https:\/\/: http:\/\//);
    });

    it("niemand lauscht → ungeklärt", async () => {
      const p = await pruefeKlartext(ziel({ httpPort: zuPort }), TASKPANE_PFAD);
      expect(p.ergebnis).toBe("ungeklaert");
    });
  });

  describe("O3 · der verschlüsselte Startweg", () => {
    it("die echte Anwendung über TLS: Taskpane 200 mit HSTS von mindestens einem Jahr", async () => {
      const p = await pruefeStartweg(ziel({ httpsPort }));
      expect(p.ergebnis, p.grund).toBe("bestanden");
      expect(p.hsts).toBe(`max-age=${HSTS_MINDEST_MAX_AGE}; includeSubDomains; preload`);
    });

    it("gültiges TLS ohne HSTS → durchgefallen", async () => {
      const p = await pruefeStartweg(ziel({ httpsPort: ohneHstsPort }));
      expect(p.ergebnis).toBe("durchgefallen");
      expect(p.grund).toContain("HSTS");
    });

    it("fremder Vertrauensanker → ungeklärt (das Zertifikat bewertet O1)", async () => {
      const p = await pruefeStartweg(ziel({ httpsPort, ca: fremd.cert }));
      expect(p.ergebnis).toBe("ungeklaert");
    });
  });

  describe("Gesamtbeleg", () => {
    it("alle Proben bestanden → bestanden; vier Proben je Host", async () => {
      const proben = await pruefeHost(ziel({ httpsPort, httpPort: umleitungPort }));
      expect(proben.map((p) => p.probe)).toEqual(["O1", "O2", "O2", "O3"]);
      const beleg = await nachweis([NAME], {
        adresse: "127.0.0.1",
        ca: z.cert,
        mindestRestTage: 0,
        httpsPort,
        httpPort: umleitungPort,
      });
      expect(beleg.bestanden).toBe(true);
      expect(beleg.anforderung).toContain("R-0822");
    });

    it("eine einzige ungeklärte Probe → nicht bestanden", async () => {
      const beleg = await nachweis([NAME], {
        adresse: "127.0.0.1",
        ca: z.cert,
        mindestRestTage: 0,
        httpsPort,
        httpPort: zuPort,
      });
      expect(beleg.proben.some((p) => p.ergebnis === "ungeklaert")).toBe(true);
      expect(beleg.bestanden).toBe(false);
    });
  });

  it("R-0822 · das Manifest des Word-Zusatzes nennt ausschließlich https://-Adressen", () => {
    // Office lädt Taskpane, Symbole und Domains genau von hier — ein http:// wäre ein Startweg ohne TLS.
    const xml = readFileSync(repoPfad("docs/word-addin/klara-manifest.xml"), "utf8");
    const adressen = [
      ...[...xml.matchAll(/DefaultValue="([^"]*:\/\/[^"]*)"/g)].map((m) => m[1] ?? ""),
      ...[...xml.matchAll(/<AppDomain>([^<]*)<\/AppDomain>/g)].map((m) => m[1] ?? ""),
    ];
    expect(adressen.length).toBeGreaterThanOrEqual(6);
    for (const adresse of adressen) {
      expect(adresse).toMatch(/^https:\/\//);
    }
    // Die Version der Taskpane-Adresse pinnt `word-addin-taskpane-cache.test.ts`, nicht dieser Fall.
    const taskpane = `https://app.klarwerk.ai${TASKPANE_PFAD}`;
    expect(adressen.some((a) => a.startsWith(taskpane))).toBe(true);
  });

  it("keine abgeschaltete Prüfung, gültige Syntax", () => {
    const quelle = readFileSync(PROBE, "utf8");
    expect(quelle).not.toContain("rejectUnauthorized");
    expect(quelle).not.toContain("NODE_TLS_REJECT_UNAUTHORIZED");
    expect(quelle).not.toMatch(/insecure/i);
    const lauf = spawnSync(process.execPath, ["--check", PROBE], { encoding: "utf8" });
    expect(lauf.status, lauf.stderr).toBe(0);
  });
});
