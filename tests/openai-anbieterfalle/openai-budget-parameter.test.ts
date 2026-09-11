// ================================================================================================
// JOB 3222 — KI-OPENAI-400: DER VORFÜHRUNGSBLOCKER, AM ECHTEN WEG NACHGESTELLT.
// ================================================================================================
//
// DER LIVE-BEFUND (Codex 0cfb9be9 und a4e82a81, Stand 1.0.0-beta.1.164, Konfiguration
// `cloud:openai:gpt-6-astra`, Proben `gespraech/vorfuehrung-20260907/openai-mini-probe.json` und
// `…-diagnose.json`): `POST /api/reasoner/test` — ein Ein-Wort-Ping, keine Dokumente — antwortete
//
//     ok:false · mode:"model" · HTTP 400
//     „ChatGPT (OpenAI) antwortete mit 400: Unsupported parameter: 'max_tokens' is not supported
//      with this model. Use 'max_completion_tokens' instead. (unsupported_parameter)"
//
// Die zweite Zeile ist die Ernte von JOB 3122: der Anbieter hatte die Ursache die ganze Zeit
// mitgeschickt. Sie ist DIAGNOSE, kein Beleg einer funktionierenden Anbindung — der Cloudweg
// schickte weiterhin den veralteten Parameter.
//
// ------------------------------------------------------------------------------------------------
// WAS HIER GEMESSEN WIRD
// ------------------------------------------------------------------------------------------------
// Der ECHTE Weg, nicht ein Baustein davon: `createCappedCloudClientFromEnv` (nach aussen gibt es
// keinen anderen Cloud-Client, SCRUM-502 R8) → `ModelProvider` → `Reasoner.probe()` — genau die
// Kette hinter `POST /api/reasoner/test` (`services/app/src/routes/reasoner-routes.ts:610`).
// Der ANBIETER ist eine Attrappe mit exakt der gemessenen OpenAI-Fehlerform: sie lehnt `max_tokens`
// mit dem obigen 400 ab und antwortet auf `max_completion_tokens`.
//
// ABGRENZUNG (kein zweiter Prüfweg): die Konfigurationsarten, die sich NICHT ändern dürfen (eigener
// lokaler OpenAI-kompatibler Server, Anthropic-Messages-Kern), stehen byteweise in
// `services/reasoner/src/model-client.test.ts`.
//
// HERMETIK: kein Netz, kein echter Schlüssel, kein Schlüsselbund.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCappedCloudClientFromEnv } from "../../services/reasoner/src/model-client";
import {
  type ModellAufrufSpur,
  mitModellAufrufSpur,
} from "../../services/reasoner/src/model-concurrency";
import {
  ModelEmptyResponseError,
  ModelHttpError,
  classifyModelFailure,
} from "../../services/reasoner/src/model-errors";
import { ModelProvider } from "../../services/reasoner/src/provider-model";
import { Reasoner } from "../../services/reasoner/src/service";
// JOB 3570: die Grundfreigabe im Aufbau — nur in den beiden Fällen, die den Admin-Mini-Test über
// den DIENST fahren (`reasoner.probe()`). Der Ping ist ein echter Aufruf an OpenAI; ohne Freigabe
// gäbe es keinen Request, dessen Körper man auf `max_completion_tokens` prüfen könnte. Die
// übrigen Fälle sprechen den Client direkt an — dort gibt es keine Zuordnung und keine Freigabe.
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const KEIN_SCHLUESSELBUND = (): undefined => undefined;
const KEIN_SPEICHERN = (): boolean => false;

// Die Konfiguration, die live steht (Modellname aus dem Befund; der Schlüssel ist synthetisch).
const OPENAI_ENV = {
  OPENAI_API_KEY: "sk-test-nur-hier",
  REASONER_MODEL: "gpt-6-astra",
};

// Der Wortlaut, mit dem der Anbieter live ablehnte — Zeichen für Zeichen aus der Diagnose-Probe.
const OPENAI_400_GRUND =
  "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.";

function cloudClient(env: Record<string, string | undefined> = OPENAI_ENV) {
  const clients = createCappedCloudClientFromEnv(env, KEIN_SCHLUESSELBUND, KEIN_SPEICHERN);
  if (!clients.openai) {
    throw new Error("Kein OpenAI-Client aus der Env — die Probe misst dann gar nichts.");
  }
  return clients.openai;
}

/**
 * DIE ANBIETER-ATTRAPPE, die den Live-Anbieter nachstellt: `max_tokens` → 400 mit der gemessenen
 * Begründung; `max_completion_tokens` → 200 mit Inhalt. Sie entscheidet AM ANFRAGEKÖRPER, nicht an
 * einem Zähler — damit misst der Fall wirklich das gesendete Feld und nicht die Reihenfolge.
 */
function nachgestellterOpenAiAnbieter(inhalt = "OK"): { koerper: string[] } {
  const koerper: string[] = [];
  vi.stubGlobal("fetch", (async (_url: unknown, init?: { body?: unknown }) => {
    const roh = String(init?.body ?? "");
    koerper.push(roh);
    if (roh.includes('"max_tokens"')) {
      return {
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: { message: OPENAI_400_GRUND, code: "unsupported_parameter" },
          }),
      } as unknown as Response;
    }
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: inhalt }, finish_reason: "stop" }] }),
    } as unknown as Response;
  }) as unknown as typeof fetch);
  return { koerper };
}

/** Eine Attrappe, die JEDE Anfrage mit demselben Fehler beantwortet. */
function immerFehler(status: number, grund: string): { anzahl: () => number } {
  let anzahl = 0;
  vi.stubGlobal("fetch", (async () => {
    anzahl += 1;
    return {
      ok: false,
      status,
      text: async () =>
        JSON.stringify({ error: { message: grund, code: "unsupported_parameter" } }),
    } as unknown as Response;
  }) as unknown as typeof fetch);
  return { anzahl: () => anzahl };
}

function meldung(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ================================================================================================
// P1-P3 — DER PING KOMMT AN, MIT GENAU EINEM REQUEST.
// ================================================================================================
describe("JOB 3222 · der Admin-Mini-Test erreicht den OpenAI-Anbieter", () => {
  it("P1: der Ein-Wort-Ping liefert ok:true statt HTTP 400 — und braucht genau EINEN Aufruf", async () => {
    const { koerper } = nachgestellterOpenAiAnbieter();
    const reasoner = new Reasoner(new ModelProvider(cloudClient()));
    await erteileKiFreigabe(reasoner);
    const ergebnis = await reasoner.probe();
    // Der Live-Befund war `ok:false, mode:"model"` mit 400 im Detail. Beides ist weg.
    expect(ergebnis.ok).toBe(true);
    expect(ergebnis.mode).toBe("model");
    expect(ergebnis.provider).toBe("cloud:openai:gpt-6-astra");
    expect(ergebnis.detail).toBe("Modell hat geantwortet.");
    // KEINE Verhandlung, kein zweiter Versuch: ein Request, und der ist von vornherein richtig.
    expect(koerper).toHaveLength(1);
    expect(koerper[0]).toContain('"max_completion_tokens"');
    expect(koerper[0]).not.toContain('"max_tokens"');
  });

  it("P2: eine echte Textanfrage geht denselben Weg — der Ping ist kein Sonderfall", async () => {
    const { koerper } = nachgestellterOpenAiAnbieter("Antwort aus der Wolke");
    const antwort = await cloudClient().complete("system", "Was ist Kalkmilch?", false, 4096);
    expect(antwort).toBe("Antwort aus der Wolke");
    expect(koerper).toHaveLength(1);
    // Das Budget ist unverändert das des AUFRUFERS — keine stille Anhebung, keine Untergrenze.
    expect(koerper[0]).toContain('"max_completion_tokens":4096');
  });

  it("P3: der Bildweg sendet dasselbe Feld wie der Textweg", async () => {
    const { koerper } = nachgestellterOpenAiAnbieter("Ein Rohr mit Flansch.");
    const client = cloudClient();
    if (typeof client.completeVision !== "function") {
      throw new Error("Der Cloud-Client trägt keinen Bildweg — dann misst die Probe nichts.");
    }
    const antwort = await client.completeVision(
      "system",
      "data:image/png;base64,AAAA",
      "Beschreibe das Bild.",
      false,
      1024,
    );
    expect(antwort).toBe("Ein Rohr mit Flansch.");
    expect(koerper).toHaveLength(1);
    expect(koerper[0]).toContain('"max_completion_tokens":1024');
    expect(koerper[0]).not.toContain('"max_tokens"');
    expect(koerper[0]).toContain('"image_url"');
  });
});

// ================================================================================================
// P4-P5 — EIN 400 BLEIBT EIN FEHLER MIT GRUND. AUCH DIESER.
// ================================================================================================
//
// Die naheliegende Bequemlichkeit wäre, auf genau diese Fehlermeldung hin den Request mit dem
// anderen Feld zu wiederholen. Das wäre Raten über Fremdtext (Codex ab279b6f: kein gemessener
// Bedarf, kein belegter Gegenanbieter) — und es würde jeden Aufruf im Fehlerfall verdoppeln.
describe("JOB 3222 · ein 400 wird nicht verhandelt", () => {
  it("P4: auch ein 400 mit dem `max_tokens`-Grund wird NICHT wiederholt", async () => {
    const zaehler = immerFehler(400, OPENAI_400_GRUND);
    const fehler = await cloudClient()
      .complete("system", "nutzer", false)
      .catch((e: unknown) => e);
    expect(zaehler.anzahl()).toBe(1);
    expect(fehler).toBeInstanceOf(ModelHttpError);
    // Das Präfix bleibt zeichengleich (JOB 3122) — `model-errors.ts` liest den Status daraus.
    expect(meldung(fehler).startsWith("ChatGPT (OpenAI) antwortete mit 400")).toBe(true);
    expect(meldung(fehler)).toContain("unsupported_parameter");
    expect(classifyModelFailure(fehler)).toEqual({ failureClass: "http", status: 400 });
    // Kein Geheimnis im Text — auch nicht der synthetische Schlüssel aus der Env.
    expect(meldung(fehler)).not.toContain("sk-test-nur-hier");
  });

  it("P5: ein beliebiger anderer 400 verhält sich genauso — ein Aufruf, ein Grund", async () => {
    const zaehler = immerFehler(400, "The model 'gpt-6-astra' does not exist");
    const fehler = await cloudClient()
      .complete("system", "nutzer", false)
      .catch((e: unknown) => e);
    expect(zaehler.anzahl()).toBe(1);
    expect(meldung(fehler)).toContain("The model 'gpt-6-astra' does not exist");
  });
});

// ================================================================================================
// P6 — HTTP 200 IST NOCH KEINE ANTWORT (Codex 18464a11, OpenAI-Referenz chat/completions/create).
// ================================================================================================
//
// `max_completion_tokens` deckelt Reasoning-Tokens UND sichtbare Ausgabe. Ein Reasoning-Modell kann
// ein kleines Budget vollständig im Denken verbrauchen und mit 200 + LEEREM Inhalt antworten
// (`finish_reason: "length"`). Das darf nie als Erfolg durchgehen — sonst meldet der Admin-Test
// „ok" über eine Vorführung, in der nichts steht.
describe("JOB 3222 · 200 mit leerem Inhalt bleibt ein ehrlicher Fehler", () => {
  it("P6: leerer Inhalt bei finish_reason length → Fehler, der das gesendete Budgetfeld nennt", async () => {
    vi.stubGlobal(
      "fetch",
      (async () =>
        ({
          ok: true,
          json: async () => ({ choices: [{ message: { content: "" }, finish_reason: "length" }] }),
        }) as unknown as Response) as unknown as typeof fetch,
    );
    const fehler = await cloudClient()
      .complete("system", "nutzer", false)
      .catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(ModelEmptyResponseError);
    expect((fehler as ModelEmptyResponseError).reason).toBe("truncated");
    expect(meldung(fehler)).toContain("max_completion_tokens=1024");
    // Und der Admin-Test sagt dann eben nicht „ok".
    const reasoner = new Reasoner(new ModelProvider(cloudClient()));
    await erteileKiFreigabe(reasoner);
    const ergebnis = await reasoner.probe();
    expect(ergebnis.ok).toBe(false);
    expect(ergebnis.mode).toBe("model");
  });
});

// ================================================================================================
// P7-P9 — DER REALE BILDWEG: `ModelProvider.describeImage()` GIBT 256 MIT, NICHT DAS TEXTBUDGET.
// ================================================================================================
//
// WARUM DIESER ABSCHNITT EXISTIERT (BEN, Korrekturpflicht 1 zu Runde 1; Codex-Präzisierung 3/4):
// P3 oben misst `completeVision()` mit 1024 bzw. einem frei gewählten Budget. Das ist der BAUSTEIN.
// Der ECHTE Bildweg des Produkts geht über `ModelProvider.describeImage()`, und der übergibt eine
// feste, kleine Zahl: 256 (`services/reasoner/src/provider-model.ts:1297`). Ein Bildnachweis, der
// diesen Aufruf umgeht, misst ein Budget, das im Betrieb nirgends vorkommt.
//
// WAS DIE UMSTELLUNG AM BILDWEG ÄNDERT: `max_tokens` deckelte NUR die sichtbare Ausgabe,
// `max_completion_tokens` deckelt Denken UND Ausgabe aus EINEM Topf (OpenAI-Referenz,
// Codex 18464a11). 256 sind für die sichtbare Beschreibung reichlich (der Prompt bittet um
// höchstens 200 Zeichen, der Server kappt hart bei 300 — `MAX_IMAGE_DESCRIPTION_LENGTH`); als
// gemeinsamer Topf für ein Reasoning-Modell sind sie knapp.
//
// EHRLICHKEITSGRENZE DIESER PROBE, ausdrücklich: der Denkanteil unten ist eine GESETZTE
// TESTBEDINGUNG, kein Messwert von `gpt-6-astra`. Gemessen wird hier, WAS DER CODE TUT, wenn der
// Topf so oder so aufgeteilt wird — nicht, wie ein echtes Modell ihn aufteilt. Wie viel Denken der
// Anbieter für eine Bildbeschreibung wirklich braucht, ist in dieser Bahn NICHT messbar (kein Netz,
// kein Schlüssel) und steht als Rest in der Rückgabe. Deshalb wird hier auch KEIN Budget angehoben.
const BILDWEG_BUDGET = 256;
const EIN_BILD = "data:image/png;base64,AAAA";

/**
 * ANBIETER-ATTRAPPE MIT BUDGETRECHNUNG. Sie liest das Budget aus dem Anfragekörper und teilt es so
 * auf, wie OpenAI `max_completion_tokens` beschreibt: erst das Denken, der Rest für die sichtbare
 * Ausgabe. Reicht der Rest nicht, kommt HTTP 200 mit gekappter oder leerer Ausgabe und
 * `finish_reason: "length"` — genau der Fall, der ohne Auswertung wie ein Erfolg aussähe.
 *
 * `denkToken` und `ausgabeToken` sind Testbedingungen (s. Block oben). Der Zeichen-je-Token-Wert
 * dient NUR dazu, die Kappung sichtbar zu machen; er behauptet keine Tokenisierung des Anbieters.
 */
function anbieterMitBudgetrechnung(bedingung: {
  denkToken: number;
  ausgabeToken: number;
  ausgabe: string;
}): { koerper: string[] } {
  const koerper: string[] = [];
  const zeichenJeToken = bedingung.ausgabe.length / bedingung.ausgabeToken;
  vi.stubGlobal("fetch", (async (_url: unknown, init?: { body?: unknown }) => {
    const roh = String(init?.body ?? "");
    koerper.push(roh);
    const budget = Number(
      (/"max_completion_tokens":(\d+)/.exec(roh) ?? /"max_tokens":(\d+)/.exec(roh))?.[1] ?? 0,
    );
    const restFuerAusgabe = Math.max(0, budget - bedingung.denkToken);
    const gedacht = Math.min(budget, bedingung.denkToken);
    const gezeigt = Math.min(restFuerAusgabe, bedingung.ausgabeToken);
    const inhalt = bedingung.ausgabe.slice(0, Math.floor(gezeigt * zeichenJeToken));
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: { content: inhalt, reasoning_content: gedacht > 0 ? "…" : null },
            finish_reason: gezeigt < bedingung.ausgabeToken ? "length" : "stop",
          },
        ],
        // Der Verbrauch, den OpenAI meldet, enthält die Denk-Token — auch wenn nichts sichtbar wird.
        usage: { prompt_tokens: 900, completion_tokens: gedacht + gezeigt },
      }),
    } as unknown as Response;
  }) as unknown as typeof fetch);
  return { koerper };
}

/** Führt `describeImage` im Verbrauchs-Kontext eines Laufs aus — so misst die Probe beides. */
async function beschreibeBild(): Promise<{
  ergebnis: unknown;
  spur: ModellAufrufSpur;
}> {
  const provider = new ModelProvider(cloudClient());
  const spur: ModellAufrufSpur = { gerufen: false };
  const ergebnis = await mitModellAufrufSpur(spur, () =>
    provider.describeImage(EIN_BILD, "de", false).catch((e: unknown) => e),
  );
  return { ergebnis, spur };
}

describe("JOB 3222 · der reale Bildweg (describeImage) am 256er-Budget", () => {
  it("P7: describeImage schickt 256 als `max_completion_tokens` — nicht das Textbudget, nicht `max_tokens`", async () => {
    const { koerper } = anbieterMitBudgetrechnung({
      denkToken: 40,
      ausgabeToken: 30,
      ausgabe: "Ein Rohrbogen mit Flansch an einer Wandhalterung.",
    });
    const { ergebnis } = await beschreibeBild();
    expect(koerper).toHaveLength(1);
    // DAS IST DIE ZAHL, DIE IM BETRIEB WIRKLICH RAUSGEHT (provider-model.ts:1297).
    expect(koerper[0]).toContain(`"max_completion_tokens":${BILDWEG_BUDGET}`);
    expect(koerper[0]).not.toContain('"max_tokens"');
    expect(koerper[0]).toContain('"image_url"');
    expect(ergebnis).toEqual({
      text: "Ein Rohrbogen mit Flansch an einer Wandhalterung.",
      demo: false,
    });
  });

  it("P8: verbraucht das Denken die 256 ganz, ist die Beschreibung leer — und das wird ein Fehler, kein Erfolg", async () => {
    const { koerper } = anbieterMitBudgetrechnung({
      denkToken: BILDWEG_BUDGET,
      ausgabeToken: 30,
      ausgabe: "Ein Rohrbogen mit Flansch an einer Wandhalterung.",
    });
    const { ergebnis, spur } = await beschreibeBild();
    expect(koerper[0]).toContain(`"max_completion_tokens":${BILDWEG_BUDGET}`);
    // Kein `text: null` als stille Nicht-Beschreibung: der Weg wirft, und der Fehler nennt das
    // gesendete Feld MIT der gesendeten Zahl — daran ist die Ursache ablesbar, ohne Rätselraten.
    expect(ergebnis).toBeInstanceOf(ModelEmptyResponseError);
    expect((ergebnis as ModelEmptyResponseError).reason).toBe("reasoning-only");
    expect(meldung(ergebnis)).toContain(
      `max_completion_tokens=${BILDWEG_BUDGET}, finish_reason=length`,
    );
    // VERBRAUCHSEHRLICHKEIT: die Denkphase ist bezahlt, auch wenn nichts sichtbar wurde. Genau
    // dieser Fall ist der teure — er darf nicht als „nichts passiert" im Protokoll landen.
    expect(spur.verbrauch).toEqual({
      eingabeToken: 900,
      ausgabeToken: BILDWEG_BUDGET,
      gemeldeteAufrufe: 1,
    });
  });

  it("P9: die Grenze liegt genau bei 256 minus Denkanteil — ein Token darüber, und die Beschreibung bricht ab", async () => {
    const voll = "Ein Rohrbogen mit Flansch an einer Wandhalterung.";
    // 30 Ausgabe-Token gesetzt; bei 226 Denk-Token bleiben genau 30 übrig — die Beschreibung passt.
    const genauPassend = anbieterMitBudgetrechnung({
      denkToken: BILDWEG_BUDGET - 30,
      ausgabeToken: 30,
      ausgabe: voll,
    });
    const passend = await beschreibeBild();
    expect(genauPassend.koerper[0]).toContain(`"max_completion_tokens":${BILDWEG_BUDGET}`);
    expect(passend.ergebnis).toEqual({ text: voll, demo: false });

    vi.unstubAllGlobals();

    // Ein einziges Denk-Token mehr: die Ausgabe wird MITTEN IM SATZ gekappt und kommt trotzdem an
    // (nicht-leerer Inhalt geht seit AUFTRAG-mega18 Block E bewusst durch — die Extract-Rettung
    // lebt davon). FÜR DEN BILDWEG HEISST DAS: eine halbe Bildunterschrift ist möglich und wird
    // NICHT als Fehler gemeldet. Das ist die Restgrenze des 256er-Budgets, hier gemessen statt
    // vermutet; sie steht als REST in der Rückgabe und wird hier NICHT durch eine Anhebung verdeckt.
    anbieterMitBudgetrechnung({
      denkToken: BILDWEG_BUDGET - 29,
      ausgabeToken: 30,
      ausgabe: voll,
    });
    const gekappt = await beschreibeBild();
    const text = (gekappt.ergebnis as { text: string | null }).text;
    expect(text).not.toBeNull();
    expect(text).not.toBe(voll);
    expect(voll.startsWith(text ?? "")).toBe(true);
    // Wörtlich, damit die Restgrenze in der Rückgabe zitierbar ist und nicht gerundet wird:
    // die Unterschrift endet mitten im Wort, und der Weg meldet das nicht.
    expect(text).toBe("Ein Rohrbogen mit Flansch an einer Wandhalterun");
  });
});
