import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KNOWN_PERMISSIONS,
  MUTATING_METHODS,
  type Protection,
  ROUTE_GUARD_MATRIX,
  routeKey,
  routeSourceFiles,
  scanAllRoutes,
  scanRouteFile,
  schutzartVon,
} from "./routeGuardAudit";
import {
  erhebeRegistrierungen,
  erhebeSchnittstellen,
  routenquellen,
} from "./schnittstellenErhebung";

// Erlaubt öffentlich-mutierend sind ausschließlich die Auth-Einstiegspunkte (sie SIND der
// Login-/Recovery-/SSO-Mechanismus). R-1165: herausgezogen, damit die selbst erhobene Grundmenge
// unten dieselbe Liste prüft und keine zweite.
const OEFFENTLICH_MUTIEREND_ERLAUBT = new Set([
  "POST /api/auth/register",
  "POST /api/auth/login",
  "POST /api/auth/logout",
  "POST /api/auth/forgot",
  "POST /api/auth/reset",
  "POST /api/auth/oidc",
  // R-0560: der SAML-Rücksprung ist derselbe Auth-Einstieg wie der OIDC-Callback darüber; sein
  // Nachweis ist die signierte Antwort des Anbieters.
  "POST /api/auth/saml/acs",
  "POST /api/auth/setup",
  // JOB 4076 (OFFICE-WEB-ANMELDUNG): das Einlösen des Übergabecodes IST ein Auth-Einstieg —
  // derselbe Grund, aus dem `POST /api/auth/reset` hier steht: der Aufruf bringt seinen
  // Nachweis mit (einmaliger, 120-s-Code aus einer angemeldeten Sitzung) und kann keinen
  // Sitzungsnachweis mitbringen, weil er aus einem Rahmen fremder Herkunft kommt.
  "POST /api/auth/office-handover/redeem",
  // R-0562: der zweite Anmeldeschritt IST ein Auth-Einstieg — es gibt noch keine Sitzung; der
  // Nachweis sind die Anmeldeanfrage aus dem Passwortschritt (5 min, einmalig, höchstens fünf
  // Versuche) und der Code vom zweiten Gerät. Je IP gedrosselt.
  "POST /api/auth/login/second-factor",
]);

// R-1165: die selbst erhobene Grundmenge — der ganze Server, nicht eine Dateiauswahl
// (Begründung und benannte Grenzen im Kopf von schnittstellenErhebung.ts).
const ERHEBUNG = erhebeSchnittstellen();

// Untergrenzen mit Abstand unter dem Stand 41ba0b7f (Quelleninspektion per Textsuche, nicht aus
// einem Lauf: über 50 Dateien mit Registrierungen, über 240 Registrierungen). Sie dürfen steigen,
// aber nie unbemerkt fallen.
const MINDESTZAHL_DATEIEN = 40;
const MINDESTZAHL_REGISTRIERUNGEN = 200;

// SCRUM-367 / AG-11 / FR-RBAC-04 / NFR-SEC-04: RBAC-Route-Guard-Audit als Regression. Der Scanner liest
// die ECHTEN Route-Quelldateien; die Erwartung steht in routeGuardAudit.ts. Diese Tests belegen, dass
// jede kritische mutierende Route serverseitig geschützt ist und keine Route unauditiert/heruntergestuft
// durchrutscht.
describe("SCRUM-367: RBAC route guard audit", () => {
  const scanned = scanAllRoutes();
  const scannedByKey = new Map(scanned.map((r) => [routeKey(r.method, r.url), r]));
  const erhobeneSchluessel = new Set(
    ERHEBUNG.registrierungen.map((r) => routeKey(r.methode, r.pfad)),
  );

  it("findet eine plausible Anzahl Routen (Scanner funktioniert)", () => {
    expect(scanned.length).toBeGreaterThan(60);
    // Keine unbekannten URLs durchgerutscht.
    expect(scanned.every((r) => r.url.startsWith("/"))).toBe(true);
  });

  it("jede tatsächlich verdrahtete Route ist in der Audit-Matrix erfasst (keine blinde Route)", () => {
    const missing = [...scannedByKey.keys()].filter((k) => !(k in ROUTE_GUARD_MATRIX));
    expect(missing).toEqual([]);
  });

  it("die Audit-Matrix enthält keine veralteten Einträge (jede erwartete Route existiert real)", () => {
    // R-1165: „existiert real" heißt: der Block-Scanner ODER die selbst erhobene Grundmenge findet
    // sie. Zwei Einträge (`GET /addin/*`, `GET /word-addin/taskpane.html`) sieht nur die zweite.
    const stale = Object.keys(ROUTE_GUARD_MATRIX).filter(
      (k) => !scannedByKey.has(k) && !erhobeneSchluessel.has(k),
    );
    expect(stale).toEqual([]);
  });

  it("die verdrahtete Schutzart entspricht der Erwartung (kein stilles Downgrade)", () => {
    const mismatches: string[] = [];
    for (const [key, expectedEntry] of Object.entries(ROUTE_GUARD_MATRIX)) {
      const actual = scannedByKey.get(key);
      if (actual && actual.protection !== expectedEntry.protection) {
        mismatches.push(`${key}: erwartet ${expectedEntry.protection}, ist ${actual.protection}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("JEDE mutierende Route (POST/PUT/DELETE/PATCH) ist NICHT öffentlich — außer den bewussten Auth-Endpunkten", () => {
    const mutating = scanned.filter((r) =>
      (MUTATING_METHODS as readonly string[]).includes(r.method),
    );
    const publicMutating = mutating
      .filter((r) => r.protection === "public")
      .map((r) => routeKey(r.method, r.url));
    const unexpected = publicMutating.filter((k) => !OEFFENTLICH_MUTIEREND_ERLAUBT.has(k));
    expect(unexpected).toEqual([]);
  });

  it("jede öffentliche Route trägt eine Begründung (bewusste public-Entscheidung)", () => {
    const undocumented = Object.entries(ROUTE_GUARD_MATRIX)
      .filter(([, e]) => e.protection === "public" && !e.reason)
      .map(([k]) => k);
    expect(undocumented).toEqual([]);
  });

  it("alle Permission-Schutzarten sind gültige RBAC-Rechte", () => {
    const permLike = Object.values(ROUTE_GUARD_MATRIX)
      .map((e) => e.protection)
      .filter((p) => p.includes("."));
    const valid = new Set<Protection>(KNOWN_PERMISSIONS);
    expect(permLike.every((p) => valid.has(p))).toBe(true);
  });

  it("die action-dispatched Route (PUT /api/kos/:id) ist niemals öffentlich", () => {
    const put = scannedByKey.get("PUT /api/kos/:id");
    expect(put?.protection).toBe("action-dispatched");
  });

  it("POST /api/ask wird nur aus ask-routes.ts erfasst (keine Weiterleitungs-URL als Route)", () => {
    const ask = scanned.filter((r) => routeKey(r.method, r.url) === "POST /api/ask");
    expect(ask.map((r) => `${r.file}=${r.protection}`)).toEqual([
      "services/app/src/routes/ask-routes.ts=ko.read",
    ]);
  });

  it("die Routen hinter Dienst-Schlüssel (/mcp) sind erfasst und nicht öffentlich", () => {
    expect(scannedByKey.get("GET /mcp")?.protection).toBe("dienst-schluessel");
    expect(scannedByKey.get("POST /mcp")?.protection).toBe("dienst-schluessel");
  });
});

// Gegenproben für den Scanner selbst: er darf weder einer URL aus dem Handler-Rumpf glauben noch
// einer Torwache ihren Namen.
describe("Route-Guard-Scanner · Pfad aus dem Registrierungskopf, Torwache aus ihrem Rumpf", () => {
  const WACHE = `
    const zugang = (request: FastifyRequest, reply: FastifyReply) => {
      const schluessel = request.headers[DIENST_SCHLUESSEL_HEADER];
      if (auth?.authKind !== "addon" || !auth.principal.dienst || typeof schluessel !== "string") {
        reply.code(401).send({ error: "UNAUTHENTICATED" });
        return null;
      }
      return { schluessel };
    };`;

  it("Konstante als Pfad: die URL einer internen Weiterleitung im Rumpf wird NICHT übernommen", () => {
    const text = `export const PFAD = "/werkzeug";${WACHE}
    app.post<{ Body: unknown }>(PFAD, optionen, async (request, reply) => {
      if (!zugang(request, reply)) { return; }
      await weiterleiten({ method: "POST", url: "/api/ask" });
    });`;
    expect(scanRouteFile(text, "x.ts")).toEqual([
      { method: "POST", url: "/werkzeug", protection: "dienst-schluessel", file: "x.ts" },
    ]);
  });

  it("Gegenprobe: eine gleichnamige Wache OHNE Schlüsselprüfung zählt als öffentlich", () => {
    const text = `
    const zugang = (request: FastifyRequest, reply: FastifyReply) => {
      return { ok: true };
    };
    app.get("/werkzeug", async (request, reply) => {
      zugang(request, reply);
    });`;
    expect(scanRouteFile(text, "x.ts")[0]?.protection).toBe("public");
  });

  it("Gegenprobe: ein unauflösbarer Pfad wird übergangen statt aus dem Rumpf geraten", () => {
    const text = `app.get(irgendwo(), async () => ({ url: "/api/geraten" }));`;
    expect(scanRouteFile(text, "x.ts")).toEqual([]);
  });
});

// ================================================================================================
// R-1165 (aufnahme:20260922:gesamt-rechte-inventar) — DER PRÜFER LIEST ALLE SCHNITTSTELLEN.
// ================================================================================================
//
// Der Block oben prüft, was `scanAllRoutes()` findet — und der findet nur in einer Dateiauswahl und
// überspringt jede URL, die er nicht liest, still. Dieser Block prüft gegen die SELBST ERHOBENE
// Grundmenge über `services/**` (schnittstellenErhebung.ts): Was sie nicht lesen kann, ist rot mit
// Datei und Zeile; jede gefundene Registrierung muss in der Matrix stehen; und wo sie etwas findet,
// das der Block-Scanner nicht liefert, wird die Schutzart am Aufruf selbst gemessen.
describe("R-1165 · die Erhebung über alle Schnittstellen des Servers", () => {
  const scannedPaare = new Set(
    scanAllRoutes().map((r) => `${r.file} ${routeKey(r.method, r.url)}`),
  );
  const erhobenePaare = new Set(
    ERHEBUNG.registrierungen.map((r) => `${r.datei} ${routeKey(r.methode, r.pfad)}`),
  );

  it("nichts ist unlesbar — jede Bauform, die die Erhebung nicht liest, steht mit Datei und Zeile da", () => {
    expect(
      ERHEBUNG.unlesbar,
      `Diese Stellen konnte die Erhebung nicht lesen — dort könnte eine ungeprüfte Schnittstelle stehen:\n${ERHEBUNG.unlesbar.join("\n")}`,
    ).toEqual([]);
  });

  it("die Erhebung ist nicht geschrumpft — Untergrenzen und keine Datei des Block-Scanners fehlt", () => {
    expect(ERHEBUNG.dateien.length).toBeGreaterThanOrEqual(MINDESTZAHL_DATEIEN);
    expect(ERHEBUNG.registrierungen.length).toBeGreaterThanOrEqual(MINDESTZAHL_REGISTRIERUNGEN);
    const fehlend = routeSourceFiles().filter((f) => !ERHEBUNG.dateien.includes(f));
    expect(
      fehlend,
      "die selbst erhobene Grundmenge ist kleiner als die alte Dateiauswahl (routeSourceFiles) — sie ist geschrumpft",
    ).toEqual([]);
    const nichtErhoben = [...scannedPaare].filter((paar) => !erhobenePaare.has(paar));
    expect(
      nichtErhoben,
      "der Block-Scanner (scanAllRoutes) sieht eine Route, die die selbst erhobene Grundmenge nicht sieht",
    ).toEqual([]);
  });

  it("jede erhobene Schnittstelle ist in der Matrix eingetragen — eine neue muss eingetragen werden", () => {
    const ohneEintrag = ERHEBUNG.registrierungen
      .filter((r) => !(routeKey(r.methode, r.pfad) in ROUTE_GUARD_MATRIX))
      .map((r) => `${r.datei}:${r.zeile} — ${routeKey(r.methode, r.pfad)}`);
    expect(
      ohneEintrag,
      `Diese Schnittstellen stehen nicht in ROUTE_GUARD_MATRIX (routeGuardAudit.ts):\n${ohneEintrag.join("\n")}`,
    ).toEqual([]);
  });

  it("wo nur die Erhebung eine Registrierung findet, stimmt die gemessene Schutzart mit der Matrix", () => {
    const abweichend = ERHEBUNG.registrierungen
      .filter((r) => !scannedPaare.has(`${r.datei} ${routeKey(r.methode, r.pfad)}`))
      .map((r) => ({ r, ist: schutzartVon(r.aufruf) }))
      // Auch ein Schlüssel, den die Matrix gar nicht führt, ist hier eine Abweichung (`undefined`).
      .filter(({ r, ist }) => ROUTE_GUARD_MATRIX[routeKey(r.methode, r.pfad)]?.protection !== ist)
      .map(({ r, ist }) => `${r.datei}:${r.zeile} — ${routeKey(r.methode, r.pfad)}: ist ${ist}`);
    expect(abweichend).toEqual([]);
  });

  it("keine erhobene mutierende Schnittstelle ist öffentlich — außer den Auth-Einstiegspunkten", () => {
    const offen = ERHEBUNG.registrierungen
      .filter((r) => (MUTATING_METHODS as readonly string[]).includes(r.methode))
      .filter((r) => ROUTE_GUARD_MATRIX[routeKey(r.methode, r.pfad)]?.protection === "public")
      .map((r) => routeKey(r.methode, r.pfad))
      .filter((k) => !OEFFENTLICH_MUTIEREND_ERLAUBT.has(k));
    expect(offen).toEqual([]);
  });

  it("KALIBRIERUNG — eine neue, ungeschützte Schnittstelle fällt auf", () => {
    // Ohne diesen Fall wäre jede grüne Farbe oben wertlos: sie könnte auch davon kommen, dass die
    // Erhebung nichts erhebt. Die erfundene Route steht nicht in der Matrix und ist öffentlich.
    const neu = erhebeRegistrierungen(
      "services/app/src/routes/erfunden-routes.ts",
      'app.get("/api/erfundene-tuer", async (_request, reply) => {\n  reply.send({ ok: true });\n});',
    );
    expect(neu.unlesbar).toEqual([]);
    expect(neu.registrierungen.map((r) => routeKey(r.methode, r.pfad))).toEqual([
      "GET /api/erfundene-tuer",
    ]);
    expect(ROUTE_GUARD_MATRIX["GET /api/erfundene-tuer"]).toBeUndefined();
    expect(schutzartVon(neu.registrierungen[0]?.aufruf ?? "")).toBe("public");
  });

  it("KALIBRIERUNG — der Block-Scanner nimmt die URL aus dem ersten Argument, nicht aus dem Rumpf", () => {
    // Nacharbeit 1: die Bauform aus mcp-routes.ts. Vorher wurde daraus eine öffentliche
    // `POST /api/ask` (das erste `"/…"` im Block), die in scanAllRoutes() die echte überschrieb.
    const quelle = [
      'const PFAD = "/mcp";',
      "const zugang = (request, reply) => {",
      "  const auth = request.authContext;",
      '  if (auth?.authKind !== "addon" || !auth.principal.dienst) { reply.code(401).send(); return null; }',
      "  return auth;",
      "};",
      "app.post(PFAD, async (request, reply) => {",
      "  if (!zugang(request, reply)) { return; }",
      '  await weiterleiten({ method: "POST", url: "/api/ask" });',
      "});",
      'app.get("/api/offen", async (_request, reply) => { reply.send({ ok: true }); });',
    ].join("\n");
    const routen = scanRouteFile(quelle, "probe-routes.ts").map(
      (r) => `${routeKey(r.method, r.url)} ${r.protection}`,
    );
    expect(routen).toEqual(["POST /mcp dienst-schluessel", "GET /api/offen public"]);
  });

  it("KALIBRIERUNG — Konstantenpfad wird gelesen, unauflösbarer Pfad und `.route` sind rot mit Zeile", () => {
    const konstante = erhebeRegistrierungen(
      "konstante.ts",
      'const PFAD = "/api/aus-konstante";\napp.get(PFAD, async () => {});',
    );
    expect(konstante.unlesbar).toEqual([]);
    expect(konstante.registrierungen.map((r) => `${r.pfad}:${r.zeile}`)).toEqual([
      "/api/aus-konstante:2",
    ]);

    const zusammengesetzt = erhebeRegistrierungen(
      "zusammengesetzt.ts",
      'import { BASIS } from "./basis";\n\napp.post(BASIS + "/x", async () => {});',
    );
    expect(zusammengesetzt.registrierungen).toEqual([]);
    expect(zusammengesetzt.unlesbar.join("\n")).toContain("zusammengesetzt.ts:3");

    const route = erhebeRegistrierungen(
      "route.ts",
      'app.route({ method: "GET", url: "/api/x", handler: async () => {} });',
    );
    expect(route.unlesbar.join("\n")).toContain("route.ts:1");

    // GEGENPROBE: eine Registrierung, die nur im KOMMENTAR steht, ist keine.
    const kommentar = erhebeRegistrierungen("kommentar.ts", '// app.get("/api/nur-erwaehnt")\n');
    expect(kommentar.registrierungen).toEqual([]);
    expect(kommentar.unlesbar).toEqual([]);
  });

  it("KALIBRIERUNG (Nacharbeit 2) — `scope.get(PFAD, …)` außerhalb der Routenverzeichnisse fällt auf", () => {
    // Befund ben: genau diese Bauform traf keines der alten Suchmuster und blieb ohne Matrixeintrag
    // und ohne rote Meldung.
    const wurzel = mkdtempSync(join(tmpdir(), "kw-r1165-scope-"));
    try {
      mkdirSync(join(wurzel, "irgendwo"));
      const quelle = 'const PFAD = "/api/neu";\nscope.get(PFAD, handler);\n';
      writeFileSync(join(wurzel, "irgendwo", "neu.ts"), quelle);
      expect(routenquellen(wurzel, wurzel)).toEqual(["irgendwo/neu.ts"]);
      const neu = erhebeRegistrierungen("irgendwo/neu.ts", quelle);
      expect(neu.unlesbar).toEqual([]);
      expect(neu.registrierungen.map((r) => `${routeKey(r.methode, r.pfad)}:${r.zeile}`)).toEqual([
        "GET /api/neu:2",
      ]);
      // … und ist damit rot: kein Matrixeintrag, gemessen öffentlich.
      expect(ROUTE_GUARD_MATRIX["GET /api/neu"]).toBeUndefined();
      expect(schutzartVon(neu.registrierungen[0]?.aufruf ?? "")).toBe("public");
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });

  it("KALIBRIERUNG (Nacharbeit 2) — Pluginparameter jedes Namens sind Serverinstanzen; Unlesbares ist rot", () => {
    const formen: Array<[string, string, number]> = [
      [
        "getypt.ts",
        'import type { FastifyPluginAsync } from "fastify";\nimport { PFAD } from "./pfade";\n' +
          "export const plugin: FastifyPluginAsync = async (scope) => {\n" +
          "  scope.get(PFAD, async () => ({}));\n};\n",
        4,
      ],
      [
        "zurueckgegeben.ts",
        'import type { FastifyPluginAsync } from "fastify";\n' +
          "export function routen(): FastifyPluginAsync {\n" +
          '  return async (srv) => {\n    srv.delete(BASIS + "/x", h);\n  };\n}\n',
        4,
      ],
      [
        "registriert.ts",
        "export function bau(server) {\n" +
          "  server.register(async (s) => {\n    s.post(`/api/${teil}`, h);\n  });\n}\n",
        3,
      ],
      [
        "instanz.ts",
        'import type { FastifyInstance } from "fastify";\n' +
          "export function haenge(f: FastifyInstance): void {\n  f.put(ZIEL, h);\n}\n",
        3,
      ],
    ];
    for (const [datei, quelle, zeile] of formen) {
      const erhebung = erhebeRegistrierungen(datei, quelle);
      expect(erhebung.registrierungen, datei).toEqual([]);
      expect(erhebung.unlesbar.join("\n"), datei).toContain(`${datei}:${zeile} —`);
    }
  });

  it("KALIBRIERUNG — die Dateierhebung folgt keiner Liste: sie steigt ab und nimmt jede Routendatei", () => {
    const wurzel = mkdtempSync(join(tmpdir(), "kw-r1165-"));
    try {
      mkdirSync(join(wurzel, "tief", "tiefer"), { recursive: true });
      writeFileSync(join(wurzel, "tief", "tiefer", "irgendwas.ts"), 'scope.get("/api/x", h);');
      writeFileSync(join(wurzel, "tief", "ohne-route.ts"), "export const a = 1;");
      writeFileSync(join(wurzel, "tief", "routen.test.ts"), 'app.get("/api/test", h);');
      expect(routenquellen(wurzel, wurzel)).toEqual(["tief/tiefer/irgendwas.ts"]);
    } finally {
      rmSync(wurzel, { recursive: true, force: true });
    }
  });
});
