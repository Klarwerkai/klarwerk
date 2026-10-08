// ================================================================================================
// Aufnahme gesamt-integrations-api — DIENST-SCHLÜSSEL AM ECHTEN DRAHT (buildApp + inject).
// ================================================================================================
//
//   R-0677  Andere Systeme melden sich an und können Wissen ausleiten, einliefern, Fragen stellen
//           und den Betriebszustand abfragen.
//   R-0688  Anmeldung mit Schlüssel; Fragen und Texte prüfen; Antworten ausschließlich aus
//           validiertem Wissen; jeder Schlüssel hat eigene Rechte und eine eigene Bremse.
//   R-0698  Je Zugang begrenzt; über der Grenze eine klare Abweisung mit Wartezeit.
//   R-0704  Eigene, WECHSELBARE Dienst-Schlüssel statt Menschenanmeldung.
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { ladeDienstSchluessel } from "../../services/app/src/dienst-schluessel";

const KOPF = "x-klarwerk-service-key";
const summe = (schluessel: string): string =>
  createHash("sha256").update(schluessel, "utf8").digest("hex");

const WIKI = "wiki-schluessel-0123456789abcdef0123456789abcdef";
const WIKI_NEU = "wiki-schluessel-NEU-fedcba9876543210fedcba98765432";
const BOT = "bot-schluessel-0123456789abcdef0123456789abcdef01";
const FREMD = "fremd-schluessel-nicht-konfiguriert-0123456789abcd";

const ENV = [
  "KLARWERK_SERVICE_KEYS",
  "KLARWERK_ADDON_API",
  "KLARWERK_ADDON_API_KEY",
  "KLARWERK_ADDON_AUTH_MAX",
  "KLARWERK_KI_ANFRAGEN_MAX",
];
const GESICHERT: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV) {
    GESICHERT[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV) {
    if (GESICHERT[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = GESICHERT[k];
    }
  }
});

interface Eintrag {
  id: string;
  sha256: string[];
  rechte: string[];
  max?: number;
  fensterSek?: number;
}

function konfiguriere(eintraege: Eintrag[]): void {
  process.env.KLARWERK_SERVICE_KEYS = JSON.stringify(eintraege);
}

const STANDARD: Eintrag[] = [
  {
    id: "wiki-sync",
    sha256: [summe(WIKI)],
    rechte: ["export.validated", "status.read"],
  },
  {
    id: "ticket-bot",
    sha256: [summe(BOT)],
    rechte: ["ask.validated", "checktext.validated", "import.kandidaten", "status.read"],
  },
];

// Derselbe Aufbau wie `tests/security/f0688-schluessel-api-nur-validiert.test.ts`: zwei Objekte zur
// selben Sache, eines validiert, eines nicht — sonst wäre „nur Validiertes" trivial erfüllt.
async function appMitBestand() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@integration.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@integration.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  async function anlegen(title: string, statement: string): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        confidentiality: "intern",
        title,
        statement,
        type: "best_practice",
        category: "Integration",
        neededValidations: 1,
      },
    });
    return res.json().id as string;
  }
  const validiertId = await anlegen(
    "Kesselspeisepumpe KSP-7 anfahren",
    "Die Kesselspeisepumpe KSP-7 wird ueber das Handventil HV-9 langsam angefahren.",
  );
  const ungeprueftId = await anlegen(
    "Kesselspeisepumpe KSP-7 Schnellstart",
    "Die Kesselspeisepumpe KSP-7 wird ueber den Schnellstartknopf NOTSTART-4 angefahren.",
  );
  await app.inject({
    method: "PUT",
    url: `/api/kos/${validiertId}`,
    headers,
    payload: { action: "rate", verdict: "up" },
  });
  return { app, headers, validiertId, ungeprueftId };
}

describe("R-0704 · Konfiguration: nur Prüfsummen, fehlerhafte Einträge fail-closed", () => {
  it("K1 · gültige Einträge werden geladen, jeder mit eigenen Rechten und eigener Grenze", () => {
    const lage = ladeDienstSchluessel({
      KLARWERK_SERVICE_KEYS: JSON.stringify([
        {
          id: "wiki-sync",
          sha256: summe(WIKI),
          rechte: ["export.validated"],
          max: 5,
          fensterSek: 10,
        },
        { id: "ticket-bot", sha256: [summe(BOT)], rechte: ["ask.validated"] },
      ]),
    });
    expect(lage.fehler).toEqual([]);
    expect(lage.schluessel.map((s) => [s.id, s.rechte, s.grenze])).toEqual([
      ["wiki-sync", ["export.validated"], { max: 5, fensterMs: 10_000 }],
      ["ticket-bot", ["ask.validated"], { max: 60, fensterMs: 60_000 }],
    ]);
  });

  it("K2 · unbekanntes Recht, kaputte Prüfsumme, doppelte Kennung → verworfen, ohne Prüfsumme im Grund", () => {
    const lage = ladeDienstSchluessel({
      KLARWERK_SERVICE_KEYS: JSON.stringify([
        { id: "a-eins", sha256: summe(WIKI), rechte: ["ko.validate"] },
        { id: "b-zwei", sha256: "kein-hex", rechte: ["status.read"] },
        { id: "c-drei", sha256: summe(BOT), rechte: ["status.read"] },
        { id: "c-drei", sha256: summe(FREMD), rechte: ["status.read"] },
      ]),
    });
    expect(lage.schluessel.map((s) => s.id)).toEqual(["c-drei"]);
    expect(lage.fehler).toHaveLength(3);
    for (const grund of lage.fehler) {
      expect(grund).not.toContain(summe(WIKI));
      expect(grund).not.toContain(summe(FREMD));
    }
  });

  it("K3 · kein gültiges JSON → kein Schlüssel; nicht gesetzt → kein Schlüssel", () => {
    expect(ladeDienstSchluessel({ KLARWERK_SERVICE_KEYS: "{kaputt" }).schluessel).toEqual([]);
    expect(ladeDienstSchluessel({}).schluessel).toEqual([]);
  });
});

describe("R-0677 / R-0688 · ausleiten, einliefern, fragen, prüfen, Zustand — je mit eigenem Recht", () => {
  it("D1 · Export: nur validiertes Wissen, protokolliert als dienst:wiki-sync", async () => {
    konfiguriere(STANDARD);
    const { app, headers, validiertId, ungeprueftId } = await appMitBestand();
    const res = await app.inject({
      method: "GET",
      url: "/api/library/export?format=json",
      headers: { [KOPF]: WIKI },
    });
    expect(res.statusCode).toBe(200);
    const ids = (res.json() as { id: string }[]).map((k) => k.id);
    expect(ids).toContain(validiertId);
    expect(ids, "der Export trug ein unvalidiertes Objekt nach außen").not.toContain(ungeprueftId);

    const audit = await app.inject({ method: "GET", url: "/api/audit", headers });
    expect(JSON.stringify(audit.json())).toContain("dienst:wiki-sync");
  });

  it("D2 · Einliefern: landet als Kandidat in der Prüfwarteschlange, nicht als Wissensobjekt", async () => {
    konfiguriere(STANDARD);
    const { app, headers } = await appMitBestand();
    const vorher = await app.inject({ method: "GET", url: "/api/kos", headers });
    const res = await app.inject({
      method: "POST",
      url: "/api/library/import/candidates",
      headers: { [KOPF]: BOT },
      payload: {
        items: [
          {
            title: "Ticket 4711: Druckluftleitung DL-3 entlüften",
            statement:
              "Vor dem Öffnen der Druckluftleitung DL-3 das Entlüftungsventil EV-2 öffnen.",
            type: "best_practice",
            category: "Integration",
          },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toHaveLength(1);
    const nachher = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(JSON.stringify(vorher.json())).not.toContain("DL-3");
    const bestandNachher = JSON.stringify(nachher.json());
    expect(bestandNachher, "die Einlieferung legte direkt ein Objekt an").not.toContain("DL-3");
    const warteschlange = await app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers,
    });
    expect(JSON.stringify(warteschlange.json())).toContain("DL-3");
  });

  it("D3 · Fragen: das unvalidierte Objekt kommt NIE, das validierte schon", async () => {
    konfiguriere(STANDARD);
    const { app, validiertId, ungeprueftId } = await appMitBestand();
    const nurUngeprueft = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [KOPF]: BOT },
      payload: { question: "Wozu dient der Schnellstartknopf NOTSTART-4?" },
    });
    expect(nurUngeprueft.statusCode).toBe(200);
    expect(nurUngeprueft.json().result?.sources ?? []).not.toContain(ungeprueftId);
    expect(JSON.stringify(nurUngeprueft.json())).not.toContain("NOTSTART-4");

    const breit = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [KOPF]: BOT },
      payload: { question: "Wie wird die Kesselspeisepumpe KSP-7 angefahren?" },
    });
    expect(breit.statusCode).toBe(200);
    expect(breit.json().result?.sources ?? []).toContain(validiertId);
  });

  it("D4 · Texte prüfen: 200 mit Prüfergebnis", async () => {
    konfiguriere(STANDARD);
    const { app } = await appMitBestand();
    const res = await app.inject({
      method: "POST",
      url: "/api/check-text",
      headers: { [KOPF]: BOT },
      payload: {
        text: "Die Kesselspeisepumpe KSP-7 wird ueber das Handventil HV-9 langsam angefahren.",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json()).toBe("object");
  });

  it("D5 · Betriebszustand: /health und /api/reasoner/status mit status.read", async () => {
    konfiguriere(STANDARD);
    const { app } = await appMitBestand();
    const health = await app.inject({ method: "GET", url: "/health", headers: { [KOPF]: WIKI } });
    expect(health.statusCode).toBe(200);
    expect(health.json().status).toBe("ok");
    const ki = await app.inject({
      method: "GET",
      url: "/api/reasoner/status",
      headers: { [KOPF]: BOT },
    });
    expect(ki.statusCode).toBe(200);
  });
});

describe("R-0688 · jeder Schlüssel hat eigene Rechte (Deny-by-default)", () => {
  it("R1 · Export-Schlüssel darf nicht fragen, Frage-Schlüssel darf nicht exportieren → 403", async () => {
    konfiguriere(STANDARD);
    const { app } = await appMitBestand();
    const frage = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [KOPF]: WIKI },
      payload: { question: "Wie wird die Kesselspeisepumpe KSP-7 angefahren?" },
    });
    expect(frage.statusCode).toBe(403);
    expect(frage.json().error).toBe("FORBIDDEN");
    const export_ = await app.inject({
      method: "GET",
      url: "/api/library/export",
      headers: { [KOPF]: BOT },
    });
    expect(export_.statusCode).toBe(403);
  });

  it("R2 · keine Route außerhalb der Liste — auch nicht lesend, auch nicht verwaltend", async () => {
    konfiguriere(STANDARD);
    const { app } = await appMitBestand();
    const fremdeRouten = [
      ["GET", "/api/kos"],
      ["GET", "/api/audit"],
      ["GET", "/api/auth/users"],
      ["POST", "/api/kos"],
      ["GET", "/api/library/import/candidates"],
    ] as const;
    for (const [method, url] of fremdeRouten) {
      const res = await app.inject({
        method,
        url,
        headers: { [KOPF]: BOT },
        ...(method === "POST" ? { payload: {} } : {}),
      });
      expect(res.statusCode, `${method} ${url}`).toBe(403);
    }
  });

  it("R3 · ein falscher Schlüssel bekommt 401 — kein Rückfall auf eine Sitzung", async () => {
    konfiguriere(STANDARD);
    const { app, headers } = await appMitBestand();
    const res = await app.inject({
      method: "GET",
      url: "/api/library/export",
      headers: { ...headers, [KOPF]: FREMD },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("UNAUTHENTICATED");
  });

  it("R4 · der Schlüssel steht in keiner Antwort", async () => {
    konfiguriere(STANDARD);
    const { app } = await appMitBestand();
    const antworten = await Promise.all([
      app.inject({ method: "GET", url: "/api/library/export", headers: { [KOPF]: WIKI } }),
      app.inject({ method: "GET", url: "/api/kos", headers: { [KOPF]: WIKI } }),
      app.inject({ method: "GET", url: "/api/library/export", headers: { [KOPF]: FREMD } }),
    ]);
    for (const res of antworten) {
      expect(res.body).not.toContain(WIKI);
      expect(res.body).not.toContain(FREMD);
    }
  });
});

describe("R-0704 · wechselbar und sperrbar", () => {
  it("W1 · während des Wechsels gelten alter und neuer Schlüssel; danach nur noch der neue", async () => {
    konfiguriere([
      { id: "wiki-sync", sha256: [summe(WIKI), summe(WIKI_NEU)], rechte: ["export.validated"] },
    ]);
    const waehrend = await appMitBestand();
    for (const s of [WIKI, WIKI_NEU]) {
      const res = await waehrend.app.inject({
        method: "GET",
        url: "/api/library/export",
        headers: { [KOPF]: s },
      });
      expect(res.statusCode).toBe(200);
    }

    konfiguriere([{ id: "wiki-sync", sha256: [summe(WIKI_NEU)], rechte: ["export.validated"] }]);
    const danach = await appMitBestand();
    const alt = await danach.app.inject({
      method: "GET",
      url: "/api/library/export",
      headers: { [KOPF]: WIKI },
    });
    expect(alt.statusCode, "der alte Schlüssel gilt nach dem Wechsel weiter").toBe(401);
    const neu = await danach.app.inject({
      method: "GET",
      url: "/api/library/export",
      headers: { [KOPF]: WIKI_NEU },
    });
    expect(neu.statusCode).toBe(200);
  });
});

describe("R-0698 · Zugriffsbremse je Schlüssel", () => {
  it("B1 · über der Grenze 429 mit Retry-After und Wartezeit — der andere Schlüssel bleibt frei", async () => {
    konfiguriere([
      { id: "wiki-sync", sha256: [summe(WIKI)], rechte: ["status.read"], max: 2, fensterSek: 60 },
      { id: "ticket-bot", sha256: [summe(BOT)], rechte: ["status.read"], max: 2, fensterSek: 60 },
    ]);
    const { app } = await appMitBestand();
    const status = (s: string) =>
      app.inject({ method: "GET", url: "/health", headers: { [KOPF]: s } });
    expect((await status(WIKI)).statusCode).toBe(200);
    expect((await status(WIKI)).statusCode).toBe(200);
    const gebremst = await status(WIKI);
    expect(gebremst.statusCode).toBe(429);
    expect(gebremst.json().error).toBe("RATE_LIMITED");
    const warten = Number(gebremst.headers["retry-after"]);
    expect(warten).toBeGreaterThanOrEqual(1);
    expect(warten).toBeLessThanOrEqual(60);
    expect(gebremst.json().wartenSek).toBe(warten);
    expect(gebremst.json().message).toContain(`${warten} Sekunden`);

    expect((await status(BOT)).statusCode, "die Bremse des einen traf den anderen").toBe(200);
  });

  it("B2 · eine Abweisung wegen fehlenden Rechts verbraucht nichts von der Grenze", async () => {
    konfiguriere([
      { id: "wiki-sync", sha256: [summe(WIKI)], rechte: ["status.read"], max: 1, fensterSek: 60 },
    ]);
    const { app } = await appMitBestand();
    const verboten = await app.inject({
      method: "GET",
      url: "/api/library/export",
      headers: { [KOPF]: WIKI },
    });
    expect(verboten.statusCode).toBe(403);
    const erlaubt = await app.inject({ method: "GET", url: "/health", headers: { [KOPF]: WIKI } });
    expect(erlaubt.statusCode).toBe(200);
  });
});

describe("Abgrenzung · Klara-Pfad bleibt, wo er war", () => {
  it("A1 · nur Dienst-Schlüssel konfiguriert: kein CORS, kein Add-in-Bündel, Klara-Kopf zählt nicht", async () => {
    konfiguriere(STANDARD);
    const { app } = await appMitBestand();
    const cors = await app.inject({
      method: "OPTIONS",
      url: "/api/ask",
      headers: {
        origin: "https://localhost:3000",
        "access-control-request-method": "POST",
      },
    });
    expect(cors.headers["access-control-allow-origin"]).toBeUndefined();
    const addin = await app.inject({ method: "GET", url: "/addin/taskpane.html" });
    expect(addin.statusCode).toBe(404);
    const klara = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { "x-klarwerk-addon-key": BOT },
      payload: { question: "Hallo?" },
    });
    expect(klara.statusCode).toBe(401);
  });

  it("A2 · ohne KLARWERK_SERVICE_KEYS nimmt der Dienst-Kopf niemanden an", async () => {
    const { app } = await appMitBestand();
    const res = await app.inject({
      method: "GET",
      url: "/api/library/export",
      headers: { [KOPF]: WIKI },
    });
    expect(res.statusCode).toBe(401);
  });

  it("A3 · letzter Schlüssel entfernt: ein weiter mitgesendeter Schlüssel fällt NICHT auf die Sitzung zurück", async () => {
    // Nacharbeit 2 (Bens Befund): nicht gesetzt UND leere Liste — beide Fälle, jeweils mit einer
    // gültigen Admin-Sitzung im selben Aufruf.
    for (const konfiguration of [undefined, "[]"]) {
      if (konfiguration === undefined) {
        delete process.env.KLARWERK_SERVICE_KEYS;
      } else {
        process.env.KLARWERK_SERVICE_KEYS = konfiguration;
      }
      const { app, headers } = await appMitBestand();
      const mitSitzung = await app.inject({
        method: "GET",
        url: "/api/library/export",
        headers: { ...headers, [KOPF]: WIKI },
      });
      expect(mitSitzung.statusCode, `KLARWERK_SERVICE_KEYS=${konfiguration}`).toBe(401);
      expect(mitSitzung.json().error).toBe("UNAUTHENTICATED");
      // Kalibrierung: dieselbe Sitzung OHNE den Kopf kommt durch — die 401 hängt am Schlüssel.
      const ohneKopf = await app.inject({ method: "GET", url: "/api/library/export", headers });
      expect(ohneKopf.statusCode).toBe(200);
    }
  });

  it("A4 · nur Klara-Flag an, kein Dienst-Schlüssel: der Dienst-Kopf ist trotzdem 401 statt Sitzung", async () => {
    process.env.KLARWERK_ADDON_API = "1";
    process.env.KLARWERK_ADDON_API_KEY = "klara-schluessel-fuer-a4-0123456789abcdef";
    const { app, headers } = await appMitBestand();
    const res = await app.inject({
      method: "GET",
      url: "/api/library/export",
      headers: { ...headers, [KOPF]: WIKI },
    });
    expect(res.statusCode).toBe(401);
  });
});
