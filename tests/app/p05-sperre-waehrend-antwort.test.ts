// ================================================================================================
// P05 · B-10 / RF-10 — EINE LOKALE SPERRE WÄHREND DER VERARBEITUNG STOPPT AUSGABE UND WIEDERNUTZUNG.
// ================================================================================================
//
// Gemessen am echten Draht (`buildApp` + `app.inject`, POST /api/ask, POST /api/ask/helpful,
// GET /api/auth/me) mit In-Memory-Diensten und fiktiven Inhalten:
//   S1  Kalibrierung: berechtigter Leser bekommt die Antwort (200) samt Beleg.
//   S2  Die berechtigte Verarbeitung läuft; WÄHRENDDESSEN sperrt der Admin das Konto lokal
//       (Befristung in der Vergangenheit). Die fertige Antwort verlässt den Server NICHT (401, kein
//       Antworttext im Rumpf), die Sitzung ist beendet.
//   S3  Wiedernutzung nach Sperre: der zuvor ausgestellte Antwortbeleg („Hat geholfen") und eine
//       erneute Frage werden abgewiesen; der Fragedienst wird nicht mehr erreicht, der
//       Vertrauenswert der Quelle bleibt unverändert.
// NICHT gemessen: ein echter Modellaufruf (ohne KI-Freigabe läuft der deterministische Ersatz) und
// Hintergrundjobs anderer Aufträge; der Rechteentzug (Leserecht) gehört zum Rechteentzugsauftrag.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const PASSWORT = "geheim12345";
const ADMIN = { name: "Admin", email: "admin@p05.test", password: PASSWORT };
const LESER = { name: "Leser", email: "leser@p05.test", password: PASSWORT };
const ABGELAUFEN = "2020-01-01T00:00:00.000Z";
const TITEL = "Spezialpresse SPX9 entlüften";
const AUSSAGE = "Vor dem Entlüften der Spezialpresse SPX9 den Hydraulikdruck vollständig ablassen.";
const FRAGE = "Wie wird die Spezialpresse SPX9 entlüftet?";

let services: ReturnType<typeof buildServices>;
let app: ReturnType<typeof buildApp>;
let adminId: string;
let leserId: string;
let koId: string;

beforeEach(async () => {
  services = buildServices();
  app = buildApp(services);
  await app.ready();
  const admin = await services.auth.register(ADMIN);
  const leser = await services.auth.register(LESER);
  await services.auth.approveUser(leser.id, admin.id);
  adminId = admin.id;
  leserId = leser.id;
  const ko = await services.ko.create({
    title: TITEL,
    statement: AUSSAGE,
    type: "best_practice",
    category: "Instandhaltung",
    author: admin.id,
  });
  koId = ko.id;
  for (let i = 0; i < ko.neededValidations; i++) {
    await services.validation.rate(ko.id, `pruefer-${i}`, "up");
  }
  expect((await services.ko.get(ko.id))?.status).toBe("validiert");
});

afterEach(async () => {
  vi.restoreAllMocks();
  await app.close();
});

async function anmelden(): Promise<Record<string, string>> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: LESER.email, password: LESER.password },
  });
  expect(res.statusCode, res.body).toBe(200);
  return { authorization: `Bearer ${res.json().token as string}` };
}

function fragen(headers: Record<string, string>) {
  return app.inject({ method: "POST", url: "/api/ask", headers, payload: { question: FRAGE } });
}

describe("P05 · lokale Sperre während einer laufenden Antwort", () => {
  it("S1 Kalibrierung: berechtigter Leser bekommt Antwort und Beleg", async () => {
    const headers = await anmelden();
    const res = await fragen(headers);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().result.answered).toBe(true);
    expect(res.json().result.answer).toContain(AUSSAGE);
    expect(typeof res.json().receipt).toBe("string");
  });

  it("S2 Sperre WÄHREND der Verarbeitung: die fertige Antwort verlässt den Server nicht", async () => {
    const headers = await anmelden();
    const original = services.ask.ask.bind(services.ask);
    const verarbeitet = vi.spyOn(services.ask, "ask").mockImplementation(async (...args) => {
      const out = await original(...args);
      // Die Antwort ist fertig berechnet — jetzt sperrt der Admin das Konto lokal.
      await services.auth.setAccessExpiry(leserId, ABGELAUFEN, adminId);
      return out;
    });

    const res = await fragen(headers);
    expect(verarbeitet).toHaveBeenCalledTimes(1);
    expect(res.statusCode, res.body).toBe(401);
    expect(res.body).not.toContain(AUSSAGE);
    expect(res.body).not.toContain("receipt");
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
    expect(me.statusCode).toBe(401);
  });

  it("S3 nach der Sperre: kein Wiedernutzen von Beleg oder Frageweg, Fragedienst nicht erreicht", async () => {
    const headers = await anmelden();
    const vorher = await fragen(headers);
    expect(vorher.statusCode, vorher.body).toBe(200);
    const receipt = vorher.json().receipt as string;
    const trustVorher = (await services.ko.get(koId))?.trust;

    await services.auth.setAccessExpiry(leserId, ABGELAUFEN, adminId);
    const verarbeitet = vi.spyOn(services.ask, "ask");

    const danke = await app.inject({
      method: "POST",
      url: "/api/ask/helpful",
      headers,
      payload: { koId, receipt },
    });
    expect(danke.statusCode).toBe(401);
    expect((await services.ko.get(koId))?.trust).toBe(trustVorher);

    const erneut = await fragen(headers);
    expect(erneut.statusCode).toBe(401);
    expect(erneut.body).not.toContain(AUSSAGE);
    expect(verarbeitet).not.toHaveBeenCalled();
  });
});
