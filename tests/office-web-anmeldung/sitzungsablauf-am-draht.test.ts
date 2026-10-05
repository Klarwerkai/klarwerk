// ================================================================================================
// AUFNAHME m365-anmeldung · DIE SITZUNG LÄUFT WIRKLICH AB — UND DIE BESTÄTIGTE ARBEIT BLEIBT
// ================================================================================================
//
// DER BEFUND (Ben, Runde 2): „Natürliches zeitliches Ablaufen der Sitzung wird ausdrücklich nicht
// gemessen." Hier wird es gemessen — am vollen App-Aufbau (`buildApp(buildServices())`), im Weg des
// Seitenfensters in Word für das Web (Zugang nur über den übergebenen Schlüssel).
//
// DIE UHR: der Auth-Dienst liest seine Zeit aus `Date.now()` (`services/auth/src/service.ts`,
// `this.now`), die Frist ist `SESSION_TTL_MS` (14 Tage). Gestellt wird NUR `Date` — Zeitgeber
// laufen echt, damit Fastify unverändert arbeitet.
//
//   F1  vor der Frist: Schlüssel trägt, Entwurf wird angelegt (bestätigte Arbeit)
//   F2  eine Minute vor Ablauf: trägt noch (Kalibrierung — die Grenze ist die Frist, nicht „immer")
//   F3  nach Ablauf: Schlüssel → 401 mit dem Satz „nicht angemeldet"; ein Sendeversuch legt NICHTS
//       an; auch das Anmelde-Fenster (Cookie derselben Sitzung) bekommt keinen Übergabecode mehr,
//       zeigt also das Formular statt still das alte Konto zu übergeben
//   F4  Wiederanmeldung über die Übergabe: neuer Schlüssel, der Entwurf aus F1 ist unverändert da,
//       und es gibt genau diesen einen
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

const KENNWORT = "secret123";
const TAG_MS = 24 * 60 * 60 * 1000;
const FRIST_MS = 14 * TAG_MS; // SESSION_TTL_MS in services/auth/src/service.ts
const START = Date.UTC(2026, 8, 25, 8, 0, 0);

afterEach(() => {
  vi.useRealTimers();
});

function cookieKopf(gesetzt: string | string[] | undefined): string {
  const liste = Array.isArray(gesetzt) ? gesetzt : gesetzt ? [gesetzt] : [];
  const erstes = (liste.find((c) => c.startsWith("kw_session=")) ?? "").split(";")[0] ?? "";
  expect(erstes, "die Anmeldung hat kein Sitzungscookie gesetzt").toMatch(/^kw_session=.+/);
  return erstes;
}

/** Wie das Anmelde-Fenster: Anmeldung mit Cookie → Code → Einlösen ohne Cookie. */
async function anmeldenUeberDialog(
  app: App,
  email: string,
): Promise<{ schluessel: string; dialogCookie: string }> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(login.statusCode, login.body).toBe(200);
  const dialogCookie = cookieKopf(login.headers["set-cookie"]);
  const code = await app.inject({
    method: "POST",
    url: "/api/auth/office-handover",
    headers: { cookie: dialogCookie },
  });
  expect(code.statusCode, code.body).toBe(201);
  const eingeloest = await app.inject({
    method: "POST",
    url: "/api/auth/office-handover/redeem",
    payload: { code: code.json().code },
  });
  expect(eingeloest.statusCode, eingeloest.body).toBe(200);
  return { schluessel: eingeloest.json().token as string, dialogCookie };
}

function mit(schluessel: string): Record<string, string> {
  return { authorization: `Bearer ${schluessel}` };
}

describe("Aufnahme m365-anmeldung · natürlicher Sitzungsablauf am Draht", () => {
  it("F1–F4 — nach Ablauf verständlich abgewiesen, nichts angelegt, Wiederanmeldung, Arbeit unverändert", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);

    const app = buildApp(buildServices());
    const erst = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Verwaltung", email: "chefin@x.de", password: KENNWORT },
    });
    expect(erst.statusCode, erst.body).toBeLessThan(300);
    const admin = await anmeldenUeberDialog(app, "chefin@x.de");
    const anna = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: mit(admin.schluessel),
      payload: { name: "Anna", email: "anna@x.de", password: KENNWORT, role: "experte" },
    });
    expect(anna.statusCode, anna.body).toBe(201);

    // F1 — bestätigte Arbeit vor der Frist.
    const vorher = await anmeldenUeberDialog(app, "anna@x.de");
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: mit(vorher.schluessel),
      payload: { title: "Vor dem Ablauf", statement: "Markierter Absatz, bestätigt." },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const id = angelegt.json().id as string;
    const gelesen = await app.inject({
      method: "GET",
      url: `/api/drafts/${id}`,
      headers: mit(vorher.schluessel),
    });
    expect(gelesen.statusCode).toBe(200);
    const bestaetigt = gelesen.json();

    // F2 — Kalibrierung: eine Minute vor Ablauf trägt der Schlüssel noch.
    vi.setSystemTime(START + FRIST_MS - 60_000);
    const knapp = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: mit(vorher.schluessel),
    });
    expect(knapp.statusCode, "vor der Frist darf nichts ablaufen").toBe(200);

    // F3 — die Frist ist vorbei.
    vi.setSystemTime(START + FRIST_MS + 60_000);
    const abgelaufen = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { ...mit(vorher.schluessel), "accept-language": "de" },
    });
    expect(abgelaufen.statusCode).toBe(401);
    expect(String(abgelaufen.json().message ?? "").length, "eine lesbare Meldung").toBeGreaterThan(
      5,
    );
    const versuch = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: mit(vorher.schluessel),
      payload: { title: "Nach dem Ablauf", statement: "Darf nicht angelegt werden." },
    });
    expect(versuch.statusCode, "nach Ablauf wird nichts angelegt").toBe(401);
    const dialogNochDa = await app.inject({
      method: "POST",
      url: "/api/auth/office-handover",
      headers: { cookie: vorher.dialogCookie },
    });
    expect(dialogNochDa.statusCode, "das Anmelde-Fenster übergibt das alte Konto nicht still").toBe(
      401,
    );

    // F4 — Wiederanmeldung über die Übergabe; der Entwurf ist unverändert und der einzige.
    const danach = await anmeldenUeberDialog(app, "anna@x.de");
    expect(danach.schluessel).not.toBe(vorher.schluessel);
    const wieder = await app.inject({
      method: "GET",
      url: `/api/drafts/${id}`,
      headers: mit(danach.schluessel),
    });
    expect(wieder.statusCode).toBe(200);
    expect(wieder.json()).toEqual(bestaetigt);
    const liste = await app.inject({
      method: "GET",
      url: "/api/drafts",
      headers: mit(danach.schluessel),
    });
    expect((liste.json() as { id: string }[]).map((d) => d.id)).toEqual([id]);
  });
});
