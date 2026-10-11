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
//   S4  (Ben, Nacharbeit 4) Leserechtsentzug WÄHREND der Verarbeitung (Hochstufung auf vertraulich):
//       409 ohne Wortlaut, Titel und Kennung; das Konto bleibt angemeldet.
//   S5  danach weder über eine erneute Frage noch über den Objektabruf wiederverwendbar.
//   S6  Kalibrierung: Entzug an einer nicht herangezogenen Quelle hält die Antwort nicht auf.
//   S7  (Ben, Nacharbeit 6) gesonderte Löschung der Wissenskopie WÄHREND der Verarbeitung: 409.
//   S8  Abgrenzung: gewöhnliche Quellenlöschung (nur Vermerk am Anker, Kopie bleibt) → 200.
// NICHT gemessen: ein echter Modellaufruf (ohne KI-Freigabe läuft der deterministische Ersatz) und
// die Hintergrundjobs/Gespräche des Rechteentzugsauftrags (rechteentzug-gespraeche-belege).
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

// Ben, Nacharbeit 4 — P05-AC03: LESERECHTSENTZUG WÄHREND DER VERARBEITUNG. Der Entzug ist der echte
// Produktweg (Hochstufung auf „vertraulich", `KoService.setConfidentiality`), derselbe wie in
// `tests/klara-quellen-nutzerweg/entzug-sperrt-die-quelle.test.ts`. Das Konto bleibt angemeldet.
describe("P05-AC03 · Leserechtsentzug während einer laufenden Antwort", () => {
  it("S4 Entzug WÄHREND der Verarbeitung: keine Ausgabe, kein Wortlaut, keine Quelle im Rumpf", async () => {
    const headers = await anmelden();
    const original = services.ask.ask.bind(services.ask);
    const verarbeitet = vi.spyOn(services.ask, "ask").mockImplementation(async (...args) => {
      const out = await original(...args);
      // Die Antwort ist aus der berechtigten Quelle fertig — jetzt wird das Leserecht entzogen.
      await services.ko.setConfidentiality(koId, "vertraulich", adminId);
      return out;
    });

    const res = await fragen(headers);
    expect(verarbeitet).toHaveBeenCalledTimes(1);
    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().error).toBe("QUELLRECHTE_GEAENDERT");
    expect(res.body).not.toContain(AUSSAGE);
    expect(res.body).not.toContain(TITEL);
    expect(res.body).not.toContain(koId);
    expect(res.body).not.toContain("receipt");
    // Die Sitzung selbst bleibt — entzogen wurde das Recht an der Quelle, nicht das Konto.
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
    expect(me.statusCode).toBe(200);
  });

  it("S5 nach dem Entzug: keine Wiedernutzung über erneute Frage oder Objektabruf", async () => {
    const headers = await anmelden();
    const vorher = await fragen(headers);
    expect(vorher.statusCode, vorher.body).toBe(200);
    expect(vorher.json().result.citedSources).toEqual([koId]);

    await services.ko.setConfidentiality(koId, "vertraulich", adminId);

    const erneut = await fragen(headers);
    expect(erneut.body).not.toContain(AUSSAGE);
    if (erneut.statusCode === 200) {
      expect(erneut.json().result.sources).not.toContain(koId);
      expect(erneut.json().result.citedSources).not.toContain(koId);
    }
    const objekt = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
    const erfunden = await app.inject({
      method: "GET",
      url: "/api/kos/gibt-es-nicht-p05",
      headers,
    });
    expect(objekt.statusCode).not.toBe(200);
    expect(objekt.statusCode).toBe(erfunden.statusCode);
    expect(objekt.body).not.toContain(AUSSAGE);
  });

  it("S6 Kalibrierung: ein Entzug an einer NICHT herangezogenen Quelle hält die Antwort nicht auf", async () => {
    const fremd = await services.ko.create({
      title: "Pausenraum lüften",
      statement: "Den Pausenraum zweimal täglich lüften.",
      type: "best_practice",
      category: "Allgemein",
      author: adminId,
    });
    const headers = await anmelden();
    const original = services.ask.ask.bind(services.ask);
    vi.spyOn(services.ask, "ask").mockImplementation(async (...args) => {
      const out = await original(...args);
      await services.ko.setConfidentiality(fremd.id, "vertraulich", adminId);
      return out;
    });

    const res = await fragen(headers);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().result.answer).toContain(AUSSAGE);
  });
});

// Ben, Nacharbeit 6 — P05-AC06 gegen AC01: eine GESONDERTE Löschung der Wissenskopie (etwa
// personenbezogen oder Lizenz) während der Antwort sperrt die Ausgabe; eine GEWÖHNLICHE
// Quellenlöschung (die externe Quelle ist nur unerreichbar, die Kopie bleibt) sperrt sie nicht.
describe("P05 · Löschung der Wissenskopie während einer laufenden Antwort", () => {
  it("S7 Kopie WÄHREND der Verarbeitung in den Papierkorb gelegt: keine Ausgabe, kein Wortlaut", async () => {
    const headers = await anmelden();
    const original = services.ask.ask.bind(services.ask);
    const verarbeitet = vi.spyOn(services.ask, "ask").mockImplementation(async (...args) => {
      const out = await original(...args);
      // Die Antwort ist fertig — jetzt wird die Wissenskopie gesondert gelöscht.
      await services.ko.delete(koId, "datenschutz@p05.test", { forceTrash: true });
      return out;
    });

    const res = await fragen(headers);
    expect(verarbeitet).toHaveBeenCalledTimes(1);
    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().error).toBe("QUELLRECHTE_GEAENDERT");
    expect(res.body).not.toContain(AUSSAGE);
    expect(res.body).not.toContain(TITEL);
    expect(res.body).not.toContain(koId);
    expect(res.body).not.toContain("receipt");
    expect((await services.ko.trashed()).map((t) => t.id)).toContain(koId);
  });

  it("S8 Abgrenzung: gewöhnliche Quellenlöschung während der Verarbeitung — Kopie bleibt, Antwort geht hinaus", async () => {
    const kopie = await services.ko.create({
      title: "Spezialpresse SPX9 Hydraulik entlüften",
      statement: "Beim Entlüften der Spezialpresse SPX9 die Hydraulik drucklos halten.",
      type: "best_practice",
      category: "Instandhaltung",
      author: adminId,
      sources: [
        {
          id: "anker-p05",
          label: "Confluence-Seite SPX9",
          url: null,
          excerpt: null,
          kind: "external",
          peerValidated: false,
          provider: "confluence",
          externalId: "P-SPX9",
          spaceKey: "K",
          sourceVersion: 1,
          author: adminId,
          at: new Date().toISOString(),
        },
      ],
    });
    for (let i = 0; i < kopie.neededValidations; i++) {
      await services.validation.rate(kopie.id, `pruefer-k-${i}`, "up");
    }
    const headers = await anmelden();
    const original = services.ask.ask.bind(services.ask);
    let vermerkt = false;
    vi.spyOn(services.ask, "ask").mockImplementation(async (...args) => {
      const out = await original(...args);
      // Die externe Quelle verschwindet — der Abgleich vermerkt das nur am Anker (P05-AC02).
      vermerkt = await services.ko.markSourceRemoved(
        kopie.id,
        { provider: "confluence", externalId: "P-SPX9" },
        new Date().toISOString(),
        "abgleich@p05.test",
      );
      return out;
    });

    const res = await fragen(headers);
    expect(vermerkt).toBe(true);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().result.answered).toBe(true);
    const kopieNachher = await services.ko.get(kopie.id);
    const anker = kopieNachher?.sources?.find((s) => s.externalId === "P-SPX9");
    expect(typeof anker?.sourceRemovedAt).toBe("string");
  });
});
