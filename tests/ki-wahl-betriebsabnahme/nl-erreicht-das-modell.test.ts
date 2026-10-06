// ================================================================================================
// KI-WAHL-BETRIEBSABNAHME · K3 — DER nl-NL-HINWEIS, GESONDERT GEMESSEN.
// ================================================================================================
//
// KRITERIUM (wörtlich): „nl-NL erreicht den vorgesehenen Sprachparameter; tatsächliche
// Antwortsprache wird getrennt vom bloßen Argument geprüft."
//
// DER BEFUND, aus dem diese Datei entstand: `services/app/src/routes/reasoner-routes.ts` normalisierte
// jede Sprachangabe mit `value === "en" ? "en" : "de"`. Die Fläche bildet `nl-NL` seit AUFTRAG-mega52
// D1 auf `nl` ab (`apps/web/src/lib/reasonerLocale.ts`), der Reasoner kennt `nl` — und genau diese
// Route machte daraus still `de`. `help-routes.ts` hatte JOB 3980 schon repariert, `ask-routes.ts`
// und `admin-routes.ts` kannten `nl` längst; die KI-Routen der Erfassung und Anreicherung nicht.
//
// DREI GETRENNTE STATIONEN, damit kein Glied angenommen wird:
//   N1 · die Abbildung der Oberflächensprache (`toReasonerLocale("nl-NL")`) — der Client.
//   N2 · das ARGUMENT, mit dem der echte Reasoner hinter der echten Route gerufen wird.
//   N3 · der PROMPT AUF DEM DRAHT: der Rumpf, den der gecappte OpenAI-Client wirklich an
//        `/chat/completions` schickt, trägt die niederländische Ausgaberegel und NICHT die deutsche.
//
// WAS HIER AUSDRÜCKLICH NICHT BEHAUPTET WIRD (die zweite Hälfte des Kriteriums): dass das Modell
// die Antwort tatsächlich niederländisch FORMULIERT. Das ist Modellverhalten und braucht einen
// echten, freigegebenen Anbieter — hier antwortet ein gestellter Transport. N4 hält deshalb nur
// fest, dass die Antwort, die der Transport liefert, unverändert durchgereicht wird; die
// Antwortsprache eines echten Modells bleibt eine offene Betriebsprobe.
//
// KEIN NETZ, KEIN SCHLÜSSEL: `fetch` ist vor dem Aufbau ersetzt (die Clients binden ihn beim Bau),
// der Schlüssel ist ein Testwert, der Schlüsselbund ist aus.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toReasonerLocale } from "../../apps/web/src/lib/reasonerLocale";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import { outputLanguageRule } from "../../services/reasoner/src/provider-model";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
/** Die Antwort des gestellten Transports — NIEDERLÄNDISCH, damit N4 die Durchreichung sieht. */
const TRANSPORT_ANTWORT = "Smeervet vermindert wrijving tussen bewegende delen.";

interface Mitschnitt {
  url: string;
  rumpf: string;
}

function stelleTransport(): Mitschnitt[] {
  const mitschnitt: Mitschnitt[] = [];
  vi.stubGlobal("fetch", (async (url: unknown, init?: { body?: unknown }) => {
    const pfad = String(url);
    mitschnitt.push({ url: pfad, rumpf: typeof init?.body === "string" ? init.body : "" });
    if (pfad !== OPENAI_URL) {
      // Laut statt still: jeder andere Ruf nach draussen ist in diesem Aufbau ein Befund.
      throw new Error(`unerwarteter Ruf nach draussen: ${pfad}`);
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: TRANSPORT_ANTWORT }, finish_reason: "stop" }],
        usage: { prompt_tokens: 12, completion_tokens: 9 },
      }),
      text: async () => "",
    } as unknown as Response;
  }) as unknown as typeof fetch);
  return mitschnitt;
}

async function alsAdmin(app: ReturnType<typeof buildApp>, email: string) {
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
  return { authorization: `Bearer ${login.json().token}` };
}

let mitschnitt: Mitschnitt[];
let services: AppServices;
let app: ReturnType<typeof buildApp>;
let headers: { authorization: string };
const argumente: unknown[] = [];

beforeEach(async () => {
  vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
  vi.stubEnv("OPENAI_API_KEY", "sk-test-nur-in-dieser-datei");
  vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
  vi.stubEnv("OPENAI_BASE_URL", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("KLARWERK_LOCAL_LLM_URL", "");
  vi.stubEnv("KLARWERK_REASONER_POLICY", "");
  mitschnitt = stelleTransport();
  argumente.length = 0;
  services = buildServices();
  await services.reasoner.loadPersistedPolicy();
  // Die Methode wird UMHÜLLT, nicht ersetzt: das Argument wird mitgeschrieben, danach läuft das
  // Original — der Draht in N3 ist also derselbe Lauf, nicht ein zweiter.
  const original = services.reasoner.enrichPublic.bind(services.reasoner);
  services.reasoner.enrichPublic = async (query, locale) => {
    argumente.push(locale);
    return original(query, locale);
  };
  app = buildApp(services);
  headers = await alsAdmin(app, "nl-kette@ki-wahl.test");
  // Wahl UND Grundfreigabe über den echten Adminweg — ohne Freigabe ginge nichts hinaus, und N3
  // mässe die Sperre statt der Sprache.
  const wahl = await app.inject({
    method: "PUT",
    url: "/api/reasoner/config",
    headers,
    payload: { global: "openai", perTask: {}, kiFreigabe: { oeffentlicheKi: true } },
  });
  expect(wahl.statusCode, wahl.body).toBe(200);
  // Die Anreicherung ist Weltwissen und hinter dem Regler „externe Wissensabfrage" — er steht für
  // diesen Lauf auf „offen"; das ist Aufbau, nicht Gegenstand.
  await services.externalKnowledge.setStage("open");
});

afterEach(async () => {
  await app.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("KI-WAHL K3 · nl-NL erreicht das Modell — Argument und Draht getrennt gemessen", () => {
  it("N1 · die Oberflächensprache nl-NL wird zum Reasoner-Parameter nl", () => {
    expect(toReasonerLocale("nl-NL")).toBe("nl");
  });

  it("N2+N3+N4 · Route → Reasoner-Argument nl → niederländische Regel auf dem Draht → Antwort unverändert", async () => {
    const antwort = await app.inject({
      method: "POST",
      url: "/api/reasoner/enrich",
      headers,
      payload: { query: "Waarvoor dient smeervet?", locale: toReasonerLocale("nl-NL") },
    });
    expect(antwort.statusCode, antwort.body).toBe(200);

    // N2 — das Argument hinter der Route.
    expect(argumente, "die Route hat den Reasoner nicht mit nl gerufen").toEqual(["nl"]);

    // N3 — der Rumpf auf dem Draht, an den tatsächlich gewählten Anbieter.
    expect(mitschnitt.map((m) => m.url)).toEqual([OPENAI_URL]);
    const rumpf = mitschnitt[0]?.rumpf ?? "";
    expect(rumpf, "die niederländische Ausgaberegel fehlt im gesendeten Prompt").toContain(
      outputLanguageRule("nl"),
    );
    expect(rumpf, "der gesendete Prompt trägt die deutsche Ausgaberegel").not.toContain(
      outputLanguageRule("de"),
    );
    expect(rumpf, "der Schlüssel steht im Rumpf").not.toContain("sk-test-nur-in-dieser-datei");

    // N4 — nur die Durchreichung: was der Transport sagt, kommt an. Ob ein ECHTES Modell
    // niederländisch antwortet, ist damit NICHT belegt (Kopf dieser Datei).
    const body = antwort.json() as { text: string; demo: boolean };
    expect(body.text).toBe(TRANSPORT_ANTWORT);
    expect(body.demo).toBe(false);
  });

  it("N5 · Gegenprobe: en bleibt en, und eine unbekannte Sprache landet sicher auf de", async () => {
    for (const [gesendet, erwartet] of [
      ["en", "en"],
      ["fr", "de"],
    ] as const) {
      const antwort = await app.inject({
        method: "POST",
        url: "/api/reasoner/enrich",
        headers,
        payload: { query: "Grease?", locale: gesendet },
      });
      expect(antwort.statusCode, antwort.body).toBe(200);
      expect(argumente.at(-1)).toBe(erwartet);
      expect(mitschnitt.at(-1)?.rumpf ?? "").toContain(outputLanguageRule(erwartet));
    }
  });
});
