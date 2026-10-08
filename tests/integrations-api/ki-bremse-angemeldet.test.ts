// ================================================================================================
// Aufnahme gesamt-integrations-api · R-0842 — DIE BREMSE GILT AUCH FÜR ANGEMELDETE NUTZER.
// ================================================================================================
//
// Originalwortlaut: „Auch wer über die Web-Anwendung angemeldet ist, soll nicht beliebig viele
// kostenpflichtige KI-Anfragen hintereinander auslösen können — und bei Erreichen der Grenze einen
// verständlichen Satz mit Wartezeit bekommen statt eines allgemeinen Fehlers. Heute bremst die
// Grenze nur den Word-Zusatz."
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Anfragebremse } from "../../services/app/src/anfragebremse";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { KI_ROUTEN, kiGrenzeAusEnv } from "../../services/app/src/ki-anfragebremse";

const ENV = ["KLARWERK_KI_ANFRAGEN_MAX", "KLARWERK_KI_ANFRAGEN_FENSTER_SEK"];
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

async function anmelden(app: ReturnType<typeof buildApp>, email: string): Promise<string> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: email, email, password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  return login.json().token as string;
}

const frage = (app: ReturnType<typeof buildApp>, token: string, sprache = "de") =>
  app.inject({
    method: "POST",
    url: "/api/ask",
    headers: { authorization: `Bearer ${token}`, "accept-language": sprache },
    payload: { question: "Wie wird die Pumpe P-1 angefahren?" },
  });

describe("R-0842 · angemeldete Sitzungen werden gebremst", () => {
  it("S1 · über der Grenze: 429, Retry-After und ein Satz mit der Wartezeit statt eines allgemeinen Fehlers", async () => {
    process.env.KLARWERK_KI_ANFRAGEN_MAX = "2";
    const app = buildApp(buildServices());
    const token = await anmelden(app, "admin@bremse.de");
    expect((await frage(app, token)).statusCode).toBe(200);
    expect((await frage(app, token)).statusCode).toBe(200);
    const gebremst = await frage(app, token);
    expect(gebremst.statusCode).toBe(429);
    expect(gebremst.json().error).toBe("KI_ANFRAGEN_GEBREMST");
    const warten = Number(gebremst.headers["retry-after"]);
    expect(warten).toBeGreaterThanOrEqual(1);
    expect(warten).toBeLessThanOrEqual(60);
    expect(gebremst.json().wartenSek).toBe(warten);
    expect(gebremst.json().message).toBe(
      `Sie haben in kurzer Zeit sehr viele KI-Anfragen gestellt. Bitte warten Sie ${warten} Sekunden und versuchen Sie es dann erneut.`,
    );
  });

  it("S2 · der Satz kommt in der Sprache der Anfrage", async () => {
    process.env.KLARWERK_KI_ANFRAGEN_MAX = "1";
    const app = buildApp(buildServices());
    const token = await anmelden(app, "admin@sprache.de");
    await frage(app, token, "en");
    const en = await frage(app, token, "en");
    expect(en.statusCode).toBe(429);
    expect(en.json().message).toContain("Please wait");
    const nl = await frage(app, token, "nl");
    expect(nl.json().message).toContain("Wacht");
  });

  it("S3 · gezählt wird je Konto: ein zweites Anmelden öffnet kein zweites Kontingent", async () => {
    process.env.KLARWERK_KI_ANFRAGEN_MAX = "1";
    const app = buildApp(buildServices());
    const erste = await anmelden(app, "admin@konto.de");
    expect((await frage(app, erste)).statusCode).toBe(200);
    const zweite = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@konto.de", password: "secret123" },
    });
    const zweiteSitzung = zweite.json().token as string;
    expect(zweiteSitzung).not.toBe(erste);
    expect((await frage(app, zweiteSitzung)).statusCode).toBe(429);
  });

  it("S4 · die Bremse des einen trifft keinen anderen Nutzer und keine Route ohne Modell", async () => {
    process.env.KLARWERK_KI_ANFRAGEN_MAX = "1";
    const app = buildApp(buildServices());
    const admin = await anmelden(app, "admin@zwei.de");
    expect((await frage(app, admin)).statusCode).toBe(200);
    expect((await frage(app, admin)).statusCode).toBe(429);
    const liste = await app.inject({
      method: "GET",
      url: "/api/kos",
      headers: { authorization: `Bearer ${admin}` },
    });
    expect(liste.statusCode, "eine Leseroute ohne Modell wurde mitgebremst").toBe(200);
  });

  it("S5 · anonyme Anfragen zählen nicht — sie bekommen weiter das 401 der Route", async () => {
    process.env.KLARWERK_KI_ANFRAGEN_MAX = "1";
    const app = buildApp(buildServices());
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/ask",
        payload: { question: "Hallo?" },
      });
      expect(res.statusCode).toBe(401);
    }
  });

  it("S6 · ohne Einstellung gilt die Grenze trotzdem (Standard 30 je 60 s); nur „aus“ schaltet ab", () => {
    expect(kiGrenzeAusEnv({})).toEqual({ max: 30, fensterMs: 60_000 });
    expect(kiGrenzeAusEnv({ KLARWERK_KI_ANFRAGEN_MAX: "unsinn" })).toEqual({
      max: 30,
      fensterMs: 60_000,
    });
    expect(kiGrenzeAusEnv({ KLARWERK_KI_ANFRAGEN_MAX: "0" })).toEqual({
      max: 30,
      fensterMs: 60_000,
    });
    const eingestellt = { KLARWERK_KI_ANFRAGEN_MAX: "5", KLARWERK_KI_ANFRAGEN_FENSTER_SEK: "10" };
    expect(kiGrenzeAusEnv(eingestellt)).toEqual({ max: 5, fensterMs: 10_000 });
    expect(kiGrenzeAusEnv({ KLARWERK_KI_ANFRAGEN_MAX: "aus" })).toBeNull();
  });

  it("S7 · die gebremsten Routen sind die modellgestützten — nicht nur der Word-Zusatz", () => {
    expect(KI_ROUTEN.map((r) => `${r.methode} ${r.pfad}`)).toEqual([
      "POST /api/ask",
      "POST /api/reasoner",
      "POST /api/reasoner/describe",
      "POST /api/reasoner/enrich",
      "POST /api/check-text",
      "POST /api/kos/:id/ai-check",
      "POST /api/help/explain",
      "POST /api/media/analyze",
    ]);
  });
});

describe("Anfragebremse · die genannte Wartezeit stimmt", () => {
  it("Z1 · Wartezeit = bis der älteste Aufruf aus dem Fenster fällt; abgewiesene zählen nicht", () => {
    const bremse = new Anfragebremse();
    const grenze = { max: 2, fensterMs: 60_000 };
    expect(bremse.zaehle("k", grenze, 0).erlaubt).toBe(true);
    expect(bremse.zaehle("k", grenze, 20_000).erlaubt).toBe(true);
    expect(bremse.zaehle("k", grenze, 30_000)).toEqual({ erlaubt: false, wartenSek: 30 });
    // Ein zu früher Neuversuch verlängert die Sperre nicht.
    expect(bremse.zaehle("k", grenze, 50_000)).toEqual({ erlaubt: false, wartenSek: 10 });
    // Genau nach Ablauf der genannten Zeit geht es weiter.
    expect(bremse.zaehle("k", grenze, 60_000).erlaubt).toBe(true);
  });

  it("Z2 · Kennungen sind getrennt, und abgelaufene Kennungen werden aufgeräumt", () => {
    const bremse = new Anfragebremse();
    const grenze = { max: 1, fensterMs: 1_000 };
    expect(bremse.zaehle("a", grenze, 0).erlaubt).toBe(true);
    expect(bremse.zaehle("b", grenze, 0).erlaubt).toBe(true);
    expect(bremse.zaehle("a", grenze, 500).erlaubt).toBe(false);
    expect(bremse.zaehle("c", grenze, 5_000).erlaubt).toBe(true);
    expect(bremse.size).toBe(1);
  });
});
