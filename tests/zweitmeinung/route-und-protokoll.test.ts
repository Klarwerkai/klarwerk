// ================================================================================================
// AUFNAHME 20260922 (R-0305, R-1099) · DIE ZWEITMEINUNG AM ECHTEN HTTP-WEG.
// ================================================================================================
//
// Gemessen über `app.inject` — Recht, Schema, Route, Dienst und Prüfprotokoll hängen zusammen:
//
//   H1 · ohne Anforderung bleibt der Antwortkörper der bisherige (kein Feld `zweitmeinung`)
//   H2 · mit Anforderung, aber ohne gewähltes Zweitmodell: der Grund steht im Körper, und das
//        Prüfprotokoll hält die Gegenüberstellung fest — ohne Frage- oder Antworttext
//   H3 · der Adminweg: wählen (protokolliert), weglassen (unverändert), Ungültiges (400, nichts
//        geschrieben), `null` (aus, protokolliert) — und die Wahl wirkt am Frageweg
//   H4 · ein neuer Empfänger ohne Beleg wird NICHT gesetzt (503, fail-closed)
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";

const FRAGE = "Bei welchem Druck wird das Ventil Brandauer geschlossen?";

async function alsAdmin(app: ReturnType<typeof buildApp>) {
  // Der erste Registrierte ist der Bootstrap-Admin (users.manage).
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "zweitmeinung@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "zweitmeinung@x.de", password: "secret123" },
  });
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

function haus(): { services: AppServices; app: ReturnType<typeof buildApp> } {
  const services = buildServices();
  return { services, app: buildApp(services) };
}

function frage(
  app: ReturnType<typeof buildApp>,
  headers: Record<string, string>,
  zusatz: Record<string, unknown> = {},
) {
  const payload = { question: FRAGE, ...zusatz };
  return app.inject({ method: "POST", url: "/api/ask", headers, payload });
}

const wahl = (
  app: ReturnType<typeof buildApp>,
  headers: Record<string, string>,
  payload: Record<string, unknown>,
) => app.inject({ method: "PUT", url: "/api/reasoner/config", headers, payload });

const gewaehlt = (antwort: { json: () => unknown }): unknown =>
  (antwort.json() as { taskConfig: { zweitmeinung?: unknown } }).taskConfig.zweitmeinung;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("R-0305/R-1099 · Frageweg", () => {
  it("H1 · ohne Anforderung trägt der Antwortkörper kein Feld `zweitmeinung`", async () => {
    const { app } = haus();
    const headers = await alsAdmin(app);
    const antwort = await frage(app, headers);
    expect(antwort.statusCode, antwort.body.slice(0, 200)).toBe(200);
    expect(Object.keys(antwort.json() as object)).not.toContain("zweitmeinung");
  });

  it("H2 · angefordert ohne Zweitmodell: Grund im Körper, inhaltsfreier Eintrag im Protokoll", async () => {
    const { app, services } = haus();
    const headers = await alsAdmin(app);
    const antwort = await frage(app, headers, { zweitmeinung: true });
    expect(antwort.statusCode, antwort.body.slice(0, 200)).toBe(200);
    expect((antwort.json() as { zweitmeinung?: unknown }).zweitmeinung).toEqual({
      status: "nicht_moeglich",
      grund: "nicht_eingerichtet",
    });
    const eintraege = await services.audit.list({ action: "ask.zweitmeinung" });
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]?.payload).toEqual({
      status: "nicht_moeglich",
      grund: "nicht_eingerichtet",
    });
    // Weder Frage noch ein Wort daraus steht im Eintrag.
    expect(JSON.stringify(eintraege[0])).not.toContain("Brandauer");
  });
});

describe("R-0305/R-1099 · Adminweg PUT /api/reasoner/config", () => {
  it("H3 · wählen, weglassen, Ungültiges, ausschalten — jede wirksame Änderung protokolliert", async () => {
    const { app, services } = haus();
    const headers = await alsAdmin(app);
    const eintraege = () => services.audit.list({ action: "reasoner.zweitmeinung" });

    const gesetzt = await wahl(app, headers, {
      global: "auto",
      perTask: {},
      zweitmeinung: "local",
    });
    expect(gesetzt.statusCode, gesetzt.body.slice(0, 200)).toBe(200);
    expect(gewaehlt(gesetzt)).toBe("local");
    expect((await eintraege()).map((e) => e.payload)).toEqual([
      { vorher: "aus", nachher: "local" },
    ]);

    // Die Wahl wirkt am Frageweg: der Grund ist nicht mehr „nicht eingerichtet".
    const gefragt = await frage(app, headers, { zweitmeinung: true });
    const ergebnis = (gefragt.json() as { zweitmeinung?: { grund?: string } }).zweitmeinung;
    expect(ergebnis?.grund).not.toBe("nicht_eingerichtet");

    // Ein Speichern der Zuordnung ohne das Feld lässt die Wahl stehen und protokolliert nichts.
    const ohne = await wahl(app, headers, { global: "auto", perTask: {} });
    expect(ohne.statusCode).toBe(200);
    expect(gewaehlt(ohne)).toBe("local");
    expect(await eintraege()).toHaveLength(1);

    // Ein unbekannter Wert: 400, nichts geschrieben, nichts protokolliert.
    const falsch = await wahl(app, headers, {
      global: "auto",
      perTask: {},
      zweitmeinung: "deterministic",
    });
    expect(falsch.statusCode).toBe(400);
    expect(await eintraege()).toHaveLength(1);

    // Ausschalten mit `null`.
    const aus = await wahl(app, headers, { global: "auto", perTask: {}, zweitmeinung: null });
    expect(aus.statusCode).toBe(200);
    expect(gewaehlt(aus)).toBeUndefined();
    expect((await eintraege()).map((e) => e.payload)).toEqual([
      { vorher: "aus", nachher: "local" },
      { vorher: "local", nachher: "aus" },
    ]);
  });

  it("H4 · ein neuer Empfänger, der nicht belegt werden kann, wird nicht gesetzt (503)", async () => {
    const { app, services } = haus();
    const headers = await alsAdmin(app);
    vi.spyOn(services.audit, "record").mockRejectedValue(new Error("Protokoll nicht schreibbar"));
    const antwort = await wahl(app, headers, {
      global: "auto",
      perTask: {},
      zweitmeinung: "local",
    });
    expect(antwort.statusCode).toBe(503);
    expect((antwort.json() as { error?: string }).error).toBe(
      "REASONER_ZWEITMEINUNG_NICHT_PROTOKOLLIERBAR",
    );
    expect(services.reasoner.getTaskConfig().zweitmeinung).toBeUndefined();
  });
});
