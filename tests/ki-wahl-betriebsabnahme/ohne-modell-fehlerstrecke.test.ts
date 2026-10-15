// ================================================================================================
// KI-WAHL-BETRIEBSABNAHME · K7 — DIE MODELLFREIE FEHLERSTRECKE DER SCHREIB-PALETTE, SERVERSEITIG.
// ================================================================================================
//
// ANLASS (BEN, Nacharbeit 6): Der Ortsbeleg `EDITOR-ORTSBELEG-20261007` behauptet unter
// `no_model_control.actual_surface_message` eine tatsächlich SICHTBARE Meldung im Editor. Das
// referenzierte `16-ohne-modell-hinweis.png` zeigt sie nicht, der AX-Differenztext auch nicht, und
// `belegbericht.py:21` setzt den Satz als festen Text. Belegt ist dort nur der SERVERFEHLER
// (`OHNE-MODELL-ZAEHLUNG.json`: `POST /api/reasoner` → 500, „Kein KI-Modell hat geantwortet …";
// ModelRun `assist`/`deterministic`/`error`). Die Abgrenzung steht in
// `tests/ki-wahl-betriebsabnahme/README.md` (Abschnitt „Belegabgleich EDITOR09 — Nachtrag").
//
// WAS DIESE DATEI BELEGT — und nur das: die SERVERHÄLFTE derselben Lage, an der echten Route,
// reproduzierbar. Konfiguration wie im Ortsbeleg (`OHNE-MODELL-KONFIG.json`): ein eigener lokaler
// Modellserver ist eingerichtet und global gewählt, die Aufgabe `assist` ist ausdrücklich
// REGELBASIERT gestellt.
//   O1 · der Lauf endet NICHT mit einem 200, der den Originaltext als Vorschlag ausgäbe — kein
//        erfundenes Ergebnis aus fehlendem Modell (K7);
//   O2 · der Fehlerkörper nennt den Grund („Kein KI-Modell hat geantwortet …") und trägt NICHT die
//        Vertraulichkeitskennung `CONFIDENTIAL_CLOUD_BLOCKED` — genau daran entscheidet die Fläche,
//        dass sie ihren eigenen Satz `fd.errAssist` zeigt (`Blatt.tsx`, `kiFehlerMeldung`);
//   O3 · der eingerichtete lokale Modellserver wird für diese Aufgabe NICHT gerufen;
//   O4 · GEGENPROBE: steht `assist` wieder auf „wie global", geht derselbe Klick an den lokalen
//        Server und kommt mit 200 und Vorschlag zurück — die Null in O3 kommt von der Zuordnung.
//
// DIE SICHTBARE HÄLFTE ist NICHT hier, sondern im vorhandenen Komponentenbeleg
// `tests/ki-freie-anweisung/standardeditor-mounted.test.tsx` F3: ein 500 aus `assist` zeigt in der
// Fehlerkarte `blatt-ki-fehler` den Satz `fd.errAssist`, und der Editortext bleibt unverändert.
// Eine tatsächliche Beobachtung im laufenden Editor ist damit NICHT belegt und wird nicht behauptet.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const LOKAL_BASIS = "http://127.0.0.1:9/v1";
const LOKAL_URL = `${LOKAL_BASIS}/chat/completions`;
const ROHTEXT = "Der Mitarbeiter kontrolliert die Anlage vor dem Start.";
const VORSCHLAG = "Die Mitarbeiterin kontrolliert die Anlage vor dem Start.";

let modellRufe: string[];
let app: ReturnType<typeof buildApp>;
let headers: { authorization: string };

beforeEach(async () => {
  vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("KLARWERK_LOCAL_LLM_URL", LOKAL_BASIS);
  vi.stubEnv("KLARWERK_LOCAL_LLM_MODEL", "kw-ohne-modell-gegenprobe");
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
  const services = buildServices();
  await services.reasoner.loadPersistedPolicy();
  app = buildApp(services);
  const email = `ohne-modell-${Math.random().toString(36).slice(2)}@ki-wahl.test`;
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email, password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  headers = { authorization: `Bearer ${login.json().token}` };
});

afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function zuordnen(perTask: Record<string, string>): Promise<void> {
  const antwort = await app.inject({
    method: "PUT",
    url: "/api/reasoner/config",
    headers,
    payload: { global: "local", perTask },
  });
  expect(antwort.statusCode, antwort.body).toBe(200);
}

async function korrigieren(): Promise<{ status: number; koerper: Record<string, unknown> }> {
  const antwort = await app.inject({
    method: "POST",
    url: "/api/reasoner",
    headers: { ...headers, "content-type": "application/json" },
    payload: {
      task: "assist",
      text: ROHTEXT,
      locale: "de",
      instruction: "Korrigiere die Rechtschreibung",
      source: "transient-document",
      confidentiality: "intern",
    },
  });
  return { status: antwort.statusCode, koerper: antwort.json() as Record<string, unknown> };
}

describe("K7 · Schreib-Palette ohne Modell: ehrlicher Serverfehler statt erfundenem Ergebnis", () => {
  it("O1–O3 · assist regelbasiert gestellt: kein 200 mit Originaltext, Grund im Körper, kein Modellruf", async () => {
    await zuordnen({ assist: "deterministic" });
    const vorher = modellRufe.length;

    const { status, koerper } = await korrigieren();

    // O1
    expect(status, JSON.stringify(koerper)).not.toBe(200);
    expect(status).toBeGreaterThanOrEqual(500);
    expect(koerper.text, "der Originaltext kam als Vorschlag zurück").toBeUndefined();
    // O2
    expect(String(koerper.message)).toContain("Die KI hat keine Antwort geliefert");
    expect(String(koerper.message)).toContain("Kein KI-Modell hat geantwortet");
    expect(JSON.stringify(koerper)).not.toContain("CONFIDENTIAL_CLOUD_BLOCKED");
    // O3
    expect(modellRufe.slice(vorher), "der lokale Modellserver wurde trotzdem gerufen").toEqual([]);
  });

  it("O4 · GEGENPROBE: assist wieder „wie global“ (lokal) — derselbe Klick geht an den Server und bringt den Vorschlag", async () => {
    await zuordnen({});
    const vorher = modellRufe.length;

    const { status, koerper } = await korrigieren();

    expect(status, JSON.stringify(koerper)).toBe(200);
    expect(koerper.text).toBe(VORSCHLAG);
    expect(modellRufe.slice(vorher)).toEqual([LOKAL_URL]);
  });
});
