// ================================================================================================
// KI-WAHL-BETRIEBSABNAHME · Antwort 29 und 13 — ANBIETERWAHL JE SCHUTZSTUFE, „KEINE KI", AUSKUNFT.
// ================================================================================================
//
// ENTSCHEIDUNG Antwort 29 (über BEN, Nacharbeit 7): Der Administrator wählt den Anbieter JE
// VERTRAULICHKEITSSTUFE, einschliesslich „Keine KI". BENs Befund: der Speicherweg verwarf
// `proSchutzstufe` mit Antwort 200, `ReasonerTaskConfig` kannte keine solche Zuordnung — die
// Abschaltentscheidung erreichte den Ausführungsweg nie.
//
// GEMESSEN WIRD, mit gezählten Modellaufrufen an einem eigenen lokalen Modellserver (Loopback, kein
// öffentlicher Anbieter, keine Freigabe nötig — die Schutzstufenregel ist der Gegenstand, nicht die
// Freigabe):
//   S1 · Speichern, Antwort, Wiederlesen (GET) und Wiederladen aus der Ablage (`loadPersistedPolicy`).
//   S2 · Nicht Unterstütztes ist ein 400 und ändert nichts: unbekannte Stufe, unbekannter Wert,
//        unbekanntes Feld.
//   S3 · „Keine KI" für „vertraulich": ein als vertraulich eingestufter Text → NULL Modellaufrufe;
//        derselbe Text „intern" → genau ein Aufruf; „streng vertraulich" (andere Regel) → ein Aufruf.
//        Die Stufe bestimmt der SERVER (Deklaration bzw. gespeicherter Stand), nicht ein Feld der
//        Policy im Aufruf.
//   S4 · HINTERGRUND ohne Stufe (Konflikturteil direkt am Reasoner, ausserhalb einer Anfrage):
//        vertraulich → null Aufrufe (fail-safe: „Keine KI" einer vertraulichen Stufe gewinnt);
//        nicht vertraulich → das Modell wird gefragt.
//   S5 · Zurücknehmen (`proSchutzstufe: null`) gibt die vertrauliche Stufe wieder frei.
//   S7 · (Nacharbeit 8, nach der Integration der Zweitmeinung aus main) „Keine KI" sperrt auch den
//        gelenkten zweiten Lauf; nicht vertraulich wird weiter gefragt.
// ENTSCHEIDUNG Antwort 13 (über BEN): normale Anwender sehen den tatsächlich arbeitenden Dienst je
// Aufgabe, seine Verfügbarkeit und Einschränkungen:
//   S6 · `GET /api/reasoner/ausfuehrung` für einen Angemeldeten OHNE Adminrecht: je Aufgabe der
//        Ausführer der AUFGABENwahl (global lokal, `assist` regelbasiert), „Keine KI"-Stufen,
//        geheimnisfrei; anonym 401; die Adminsicht `/api/reasoner/config` bleibt 403.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";

const LOKAL_BASIS = "http://127.0.0.1:9/v1";
const LOKAL_URL = `${LOKAL_BASIS}/chat/completions`;
const LOKAL_MODELL = "kw-schutzstufe-gegenprobe";
const ROHTEXT = "Der Mitarbeiter kontrolliert die Anlage vor dem Start.";
const VORSCHLAG = "Die Mitarbeiterin kontrolliert die Anlage vor dem Start.";

let modellRufe: string[];
let services: AppServices;
let app: ReturnType<typeof buildApp>;
let admin: { authorization: string };

/** Das Passwort des vom Admin angelegten Lesers — so lang wie in der Gast-Strecke (`strecke.ts`). */
const LESER_PASSWORT = "schutzstufe-leser-4711";

async function anmelden(email: string, password = "secret123"): Promise<{ authorization: string }> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  expect(login.statusCode, login.body).toBe(200);
  return { authorization: `Bearer ${login.json().token}` };
}

beforeEach(async () => {
  vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("KLARWERK_LOCAL_LLM_URL", LOKAL_BASIS);
  vi.stubEnv("KLARWERK_LOCAL_LLM_MODEL", LOKAL_MODELL);
  vi.stubEnv("KLARWERK_LOCAL_LLM_KEY", "");
  vi.stubEnv("KLARWERK_LOCAL_LLM_MAX_TOKENS", "");
  vi.stubEnv("KLARWERK_LOCAL_LLM_ALLOWED_ORIGINS", "");
  vi.stubEnv("KLARWERK_REASONER_POLICY", "");
  modellRufe = [];
  vi.stubGlobal("fetch", (async (url: unknown) => {
    const pfad = String(url);
    modellRufe.push(pfad);
    if (pfad !== LOKAL_URL) {
      throw new Error(`unerwarteter Ruf nach draussen: ${pfad}`);
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: VORSCHLAG }, finish_reason: "stop" }],
      }),
      text: async () => "",
    } as unknown as Response;
  }) as unknown as typeof fetch);
  services = buildServices();
  await services.reasoner.loadPersistedPolicy();
  app = buildApp(services);
  const email = `schutzstufe-${Math.random().toString(36).slice(2)}@ki-wahl.test`;
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email, password: "secret123" },
  });
  admin = await anmelden(email);
});

afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function zuordnen(rumpf: Record<string, unknown>) {
  return app.inject({ method: "PUT", url: "/api/reasoner/config", headers: admin, payload: rumpf });
}

async function konfig(): Promise<{
  taskConfig: { global: string; perTask: Record<string, string>; proSchutzstufe?: unknown };
}> {
  const antwort = await app.inject({ method: "GET", url: "/api/reasoner/config", headers: admin });
  expect(antwort.statusCode, antwort.body).toBe(200);
  return antwort.json();
}

/** Ein eingestufter, angehängter Text (wie ein Upload) — die Stufe deklariert der Aufruf. */
async function korrigieren(
  stufe: "intern" | "vertraulich" | "streng_vertraulich",
): Promise<{ status: number; rufe: number; text: unknown }> {
  const vorher = modellRufe.length;
  const antwort = await app.inject({
    method: "POST",
    url: "/api/reasoner",
    headers: { ...admin, "content-type": "application/json" },
    payload: {
      task: "assist",
      text: ROHTEXT,
      locale: "de",
      instruction: "Korrigiere die Rechtschreibung",
      source: "transient-document",
      confidentiality: stufe,
    },
  });
  const koerper = antwort.json() as Record<string, unknown>;
  return {
    status: antwort.statusCode,
    rufe: modellRufe.slice(vorher).filter((u) => u === LOKAL_URL).length,
    text: koerper.text,
  };
}

const KEINE_KI_VERTRAULICH = { vertraulich: "deterministic" } as const;

describe("Antwort 29 · Anbieterwahl je Schutzstufe — gespeichert, wiedergelesen, durchgesetzt", () => {
  it("S1 · Speichern, Antwort, Wiederlesen und Wiederladen aus der Ablage tragen die Stufenregel", async () => {
    const gespeichert = await zuordnen({
      global: "local",
      perTask: {},
      proSchutzstufe: { vertraulich: "deterministic", streng_vertraulich: "local" },
    });
    expect(gespeichert.statusCode, gespeichert.body).toBe(200);
    const soll = { vertraulich: "deterministic", streng_vertraulich: "local" };
    expect(gespeichert.json().taskConfig.proSchutzstufe).toEqual(soll);
    expect((await konfig()).taskConfig.proSchutzstufe, "GET liest sie nicht zurück").toEqual(soll);
    // Ein Speichern der ZUORDNUNG ohne das Feld lässt die Stufenregel stehen (wie `kiFreigabe`).
    const nurZuordnung = await zuordnen({ global: "local", perTask: { assist: "local" } });
    expect(nurZuordnung.statusCode, nurZuordnung.body).toBe(200);
    expect((await konfig()).taskConfig.proSchutzstufe).toEqual(soll);
    // Wiederladen aus der Ablage — derselbe Weg wie beim Neustart (`server.ts`).
    const geladen = await services.reasoner.loadPersistedPolicy();
    expect(geladen.source).toBe("persisted");
    expect(geladen.config.proSchutzstufe, "die Ablage hat die Stufenregel nicht").toEqual(soll);
  });

  it("S2 · nicht Unterstütztes ist ein 400 und ändert nichts — unbekannte Stufe, unbekannter Wert, unbekanntes Feld", async () => {
    await zuordnen({ global: "local", perTask: {}, proSchutzstufe: KEINE_KI_VERTRAULICH });
    const vorher = (await konfig()).taskConfig;
    for (const rumpf of [
      { global: "local", perTask: {}, proSchutzstufe: { geheim: "deterministic" } },
      { global: "local", perTask: {}, proSchutzstufe: { vertraulich: "keine-ki" } },
      { global: "local", perTask: {}, proSchutzstufe: ["vertraulich"] },
      { global: "local", perTask: {}, kiAusJeStufe: { vertraulich: true } },
    ]) {
      const antwort = await zuordnen(rumpf);
      expect(antwort.statusCode, `${JSON.stringify(rumpf)} → ${antwort.body}`).toBe(400);
    }
    expect((await konfig()).taskConfig, "ein abgelehnter Aufruf hat doch etwas geändert").toEqual(
      vorher,
    );
  });

  it("S3 · „Keine KI“ für vertraulich: null Modellaufrufe; intern und streng vertraulich laufen", async () => {
    const gespeichert = await zuordnen({
      global: "local",
      perTask: {},
      proSchutzstufe: KEINE_KI_VERTRAULICH,
    });
    expect(gespeichert.statusCode, gespeichert.body).toBe(200);

    const vertraulich = await korrigieren("vertraulich");
    expect(vertraulich.rufe, "trotz „Keine KI“ ging der vertrauliche Text an ein Modell").toBe(0);
    expect(vertraulich.status, "ohne Modell darf kein Vorschlag als Erfolg kommen").not.toBe(200);
    expect(vertraulich.text).toBeUndefined();

    const intern = await korrigieren("intern");
    expect(intern.status).toBe(200);
    expect(intern.rufe, "die erlaubte Stufe „intern“ erreichte das Modell nicht").toBe(1);
    expect(intern.text).toBe(VORSCHLAG);

    const streng = await korrigieren("streng_vertraulich");
    expect(streng.status).toBe(200);
    expect(streng.rufe, "„streng vertraulich“ hat keine eigene Sperre und muss laufen").toBe(1);
  });

  it("S4 · Hintergrund ohne Stufe (Konflikturteil am Reasoner): vertraulich null Aufrufe, nicht vertraulich gefragt", async () => {
    await zuordnen({ global: "local", perTask: {}, proSchutzstufe: KEINE_KI_VERTRAULICH });

    let vorher = modellRufe.length;
    await services.reasoner.judgeConflict("A: Ventil blau.", "B: Ventil rot.", "de", true);
    expect(
      modellRufe.slice(vorher).filter((u) => u === LOKAL_URL).length,
      "ein vertraulicher Hintergrundaufruf erreichte trotz „Keine KI“ das Modell",
    ).toBe(0);

    vorher = modellRufe.length;
    await services.reasoner.judgeConflict("A: Ventil blau.", "B: Ventil rot.", "de", false);
    expect(
      modellRufe.slice(vorher).filter((u) => u === LOKAL_URL).length,
      "GEGENPROBE: der nicht vertrauliche Hintergrundaufruf fragt das Modell",
    ).toBeGreaterThan(0);
  });

  it("S5 · Zurücknehmen (`proSchutzstufe: null`) gibt die vertrauliche Stufe wieder frei", async () => {
    await zuordnen({ global: "local", perTask: {}, proSchutzstufe: KEINE_KI_VERTRAULICH });
    expect((await korrigieren("vertraulich")).rufe).toBe(0);
    const zurueck = await zuordnen({ global: "local", perTask: {}, proSchutzstufe: null });
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    expect((await konfig()).taskConfig.proSchutzstufe).toBeUndefined();
    expect((await korrigieren("vertraulich")).rufe).toBe(1);
  });

  it("S7 · „Keine KI“ sperrt auch die Zweitmeinung (R-0305 aus main): vertraulich null Aufrufe, nicht vertraulich gefragt", async () => {
    // Nach der Integration mit main (Nacharbeit 8): die Zweitmeinung lenkt ihren zweiten Lauf über
    // eine eigene Kette (`lenkung.kette`) an `laufKette` vorbei. Ohne eigene Prüfung erreichte ein
    // vertraulicher Text dort das gewählte Zweitmodell, obwohl die Stufe „Keine KI“ trägt.
    const gespeichert = await zuordnen({
      global: "local",
      perTask: {},
      proSchutzstufe: KEINE_KI_VERTRAULICH,
      zweitmeinung: "local",
    });
    expect(gespeichert.statusCode, gespeichert.body).toBe(200);
    expect(gespeichert.json().taskConfig.zweitmeinung).toBe("local");

    // Ein passender Wissenseintrag: ohne Grundlage fragt `answer` grundsätzlich kein Modell
    // (`provider-model.ts`, FR-RSN-03) — dann wären beide Zählungen null und nichts gemessen.
    const grundlage = [
      {
        id: "ko-anlage-pruefen",
        title: "Anlage prüfen",
        statement: "Die Anlage wird vor dem Start vom Mitarbeiter geprüft.",
        status: "validiert" as const,
        trust: 0.9,
      },
    ];
    let vorher = modellRufe.length;
    const vertraulich = await services.reasoner.answerMitZweitmeinung(
      "Wie wird die Anlage geprüft?",
      grundlage,
      "de",
      true,
    );
    expect(
      modellRufe.slice(vorher).filter((u) => u === LOKAL_URL).length,
      "ein vertraulicher Text erreichte trotz „Keine KI“ ein Modell (erste oder zweite Meinung)",
    ).toBe(0);
    expect(vertraulich.zweitmeinung).toEqual({
      status: "nicht_moeglich",
      grund: "nicht_freigegeben",
    });

    vorher = modellRufe.length;
    const offen = await services.reasoner.answerMitZweitmeinung(
      "Wie wird die Anlage geprüft?",
      grundlage,
      "de",
      false,
    );
    expect(
      modellRufe.slice(vorher).filter((u) => u === LOKAL_URL).length,
      "GEGENPROBE: ohne Sperre der Stufe fragt der Lauf das Modell",
    ).toBeGreaterThan(0);
    const zweit = offen.zweitmeinung;
    const grund = zweit.status === "nicht_moeglich" ? zweit.grund : null;
    const hinweis = "GEGENPROBE: die Sperre griff auch ohne „Keine KI“";
    expect(grund, hinweis).not.toBe("nicht_freigegeben");
  });
});

describe("Antwort 13 · wer je Aufgabe arbeitet — für jeden Angemeldeten", () => {
  it("S6 · Nicht-Admin bekommt je Aufgabe den Ausführer der AUFGABENwahl, geheimnisfrei; anonym 401; Adminsicht bleibt 403", async () => {
    const gespeichert = await zuordnen({
      global: "local",
      perTask: { assist: "deterministic" },
      proSchutzstufe: { streng_vertraulich: "deterministic" },
    });
    expect(gespeichert.statusCode, gespeichert.body).toBe(200);
    const leserEmail = `leser-${Math.random().toString(36).slice(2)}@ki-wahl.test`;
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: "Leser", email: leserEmail, password: LESER_PASSWORT, role: "viewer" },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const leser = await anmelden(leserEmail, LESER_PASSWORT);

    const anonym = await app.inject({ method: "GET", url: "/api/reasoner/ausfuehrung" });
    expect(anonym.statusCode).toBe(401);
    const adminSicht = await app.inject({
      method: "GET",
      url: "/api/reasoner/config",
      headers: leser,
    });
    expect(adminSicht.statusCode, "die Adminsicht ist für den Leser offen").toBe(403);

    const antwort = await app.inject({
      method: "GET",
      url: "/api/reasoner/ausfuehrung",
      headers: leser,
    });
    expect(antwort.statusCode, antwort.body).toBe(200);
    const { aufgaben } = antwort.json() as {
      aufgaben: Record<string, { ausfuehrer: string; gewaehlt: string; keineKiFuer: string[] }>;
    };
    expect(aufgaben.structure?.ausfuehrer, "global lokal → structure lokal").toBe("local");
    expect(aufgaben.assist?.ausfuehrer, "assist ist regelbasiert gestellt").toBe("deterministic");
    expect(aufgaben.assist?.gewaehlt).toBe("deterministic");
    expect(aufgaben.structure?.keineKiFuer).toEqual(["streng_vertraulich"]);
    // Geheimnisfrei: keine Modellkennung, keine Adresse, kein Schlüsselname.
    expect(antwort.body).not.toContain(LOKAL_MODELL);
    expect(antwort.body).not.toContain("127.0.0.1");
    expect(antwort.body).not.toMatch(/API_KEY|Bearer/);
  });

  it("S8 · die Auskunft nennt je Stufe denselben Ausführer, den der Lauf wirklich ruft — auch bei abweichender Aufgaben-/Stufenwahl", async () => {
    // BEN, Nacharbeit 10: `ausfuehrung()` las die Kette OHNE Stufenregel, Läufe die Kette MIT ihr.
    // Hier weichen Aufgabe und Stufen bewusst voneinander ab: global lokal, `structure`
    // regelbasiert, „intern" → Keine KI, „vertraulich" → lokal.
    const gespeichert = await zuordnen({
      global: "local",
      perTask: { structure: "deterministic" },
      proSchutzstufe: { intern: "deterministic", vertraulich: "local" },
    });
    expect(gespeichert.statusCode, gespeichert.body).toBe(200);
    const antwort = await app.inject({
      method: "GET",
      url: "/api/reasoner/ausfuehrung",
      headers: admin,
    });
    expect(antwort.statusCode, antwort.body).toBe(200);
    const { aufgaben } = antwort.json() as {
      aufgaben: Record<
        string,
        { ausfuehrer: string; stufenAbweichend: boolean; jeStufe: Record<string, string> }
      >;
    };
    // assist folgt global (lokal); die Stufenregel lenkt „intern" auf Keine KI, „vertraulich"
    // ausdrücklich auf lokal; „streng vertraulich" hat keine Regel → Aufgabenwahl (lokal).
    expect(aufgaben.assist?.jeStufe).toEqual({
      intern: "deterministic",
      vertraulich: "local",
      streng_vertraulich: "local",
    });
    expect(aufgaben.assist?.ausfuehrer, "ausfuehrer ist der Eintrag für intern").toBe(
      "deterministic",
    );
    expect(aufgaben.assist?.stufenAbweichend).toBe(true);
    // structure ist als Aufgabe regelbasiert: ohne Stufenregel bleibt es dabei, „vertraulich"
    // lenkt die Stufenregel trotzdem auf lokal.
    expect(aufgaben.structure?.jeStufe).toEqual({
      intern: "deterministic",
      vertraulich: "local",
      streng_vertraulich: "deterministic",
    });

    // DERSELBE Ausführer am wirklichen Lauf: intern 0 Modellaufrufe, vertraulich und streng
    // vertraulich je einer — genau, was die Auskunft für assist nennt.
    expect((await korrigieren("intern")).rufe, "Auskunft „Keine KI“, Lauf rief doch").toBe(0);
    expect((await korrigieren("vertraulich")).rufe, "Auskunft lokal, Lauf rief nicht").toBe(1);
    expect((await korrigieren("streng_vertraulich")).rufe).toBe(1);
  });
});
