// ================================================================================================
// JOB 3122 — N12d: DER OPENAI-WEG SAGT, WARUM ER NICHT ANTWORTET.
// ================================================================================================
//
// DER BEFUND (gemessen am Stand 1.0.0-beta.1.131, main 2ae378f):
//
//   `model-client.ts:418-420` warf bei `!res.ok` sofort
//   `new ModelHttpError("ChatGPT (OpenAI) antwortete mit 400", 400)` — der Antwortkörper wurde erst
//   DANACH gelesen (`:421`), bei einem 4xx also nie. Die Begründung, die OpenAI im selben Atemzug
//   mitschickt (`{"error":{"message":…,"code":…}}`), landete weder im Diagnose-Log noch auf der
//   Fläche. Wer die Vorführung „100 % ChatGPT" betrieb, sah einen Ersatzmodus und wusste nicht, ob
//   Schlüssel, Modellname oder Anfrageformat schuld war. Live belegt: sechs Läufe auf Fallback,
//   extract meldete wörtlich „ChatGPT (OpenAI) antwortete mit 400" (CODEX-ANTWORT-49 §4).
//
//   UND: dieselbe Env `REASONER_MODEL` trug für BEIDE Anbieter das Modell. Ihr Vorgabewert war
//   `claude-sonnet-4-6` (Code `:279`, Compose `:75`). Wer nur `OPENAI_API_KEY` setzte, schickte
//   einen ANTHROPIC-Bezeichner an api.openai.com — ein garantierter 400 bei JEDEM Lauf.
//
// GEMESSEN WIRD DER ECHTE WEG (wie in `tests/openai-cloud-anbieter/…`): die Umgebungsfabrik. Nach
// aussen gibt es keinen anderen Cloud-Client (SCRUM-502 R8); eine Probe am rohen Client wäre grün,
// während der Wrapper fehlt.
//
// JOB 3134 (KI-WAHL): dieselbe Fabrik baut seither BEIDE Anbieter getrennt und liefert sie unter
// ihrem Namen; die Vorzugsregel „OpenAI vor Anthropic" ist durch Pedis Wahl ersetzt. Für die Fälle
// hier zählt weiterhin der Client, der OHNE Wahl zuerst arbeitet (`openai ?? anthropic`, die
// Reihenfolge von `REASONER_CLOUD_ANBIETER`) — genau das leistet `cloudClient` unten. Die Aussagen
// der Fälle sind unverändert.
//
// HERMETIK: kein Netz, kein echter Schlüssel, kein Schlüsselbund. `fetch` ist global ersetzt, die
// beiden Schlüsselbund-Zugriffe sind ausdrücklich stillgelegt.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyAiCheckFailure } from "../../services/app/src/ai-check-worker";
import { createCappedCloudClientFromEnv } from "../../services/reasoner/src/model-client";
import {
  ModelHttpError,
  ModelTimeoutError,
  classifyModelFailure,
} from "../../services/reasoner/src/model-errors";
import { ModelProvider } from "../../services/reasoner/src/provider-model";
import { Reasoner } from "../../services/reasoner/src/service";

// Der Schlüsselbund wird nie befragt (der Schlüssel steht in der Env) — beide Zugriffe sind
// trotzdem stillgelegt, damit der Lauf auf jedem Rechner gleich ist.
const KEIN_SCHLUESSELBUND = (): undefined => undefined;
const KEIN_SPEICHERN = (): boolean => false;

const OPENAI_ENV = {
  OPENAI_API_KEY: "sk-test-nur-hier",
  REASONER_MODEL: "gpt-4o-mini",
};

function cloudClient(env: Record<string, string | undefined>) {
  const clients = createCappedCloudClientFromEnv(env, KEIN_SCHLUESSELBUND, KEIN_SPEICHERN);
  return clients.openai ?? clients.anthropic;
}

interface Fehlantwort {
  status: number;
  /** Der Antwortkörper, so wie der Anbieter ihn schickt. Fehlt er, ist er leer. */
  koerper?: string;
  /** `res.text()` scheitert (Verbindung abgebrochen, Körper schon konsumiert). */
  koerperWirft?: boolean;
  /** Die Antwort trägt gar kein `text()` — die Form fremder Attrappen (vgl. JOB 3090 F18a). */
  ohneText?: boolean;
}

/** Ersetzt `fetch` global durch eine Attrappe, die genau diese Fehlantwort liefert. */
function fetchMitFehlantwort(a: Fehlantwort): void {
  vi.stubGlobal("fetch", (async () => {
    const res: Record<string, unknown> = { ok: false, status: a.status };
    if (a.koerperWirft) {
      res.text = async (): Promise<string> => {
        throw new Error("Körper konnte nicht gelesen werden");
      };
    } else if (!a.ohneText) {
      res.text = async (): Promise<string> => a.koerper ?? "";
    }
    return res as unknown as Response;
  }) as unknown as typeof fetch);
}

/**
 * JOB 3122 RUNDE 2 (bens Korrekturpflicht 2): eine Attrappe, bei der das ZEITLIMIT zuschlägt.
 * `statusZuerst` entscheidet, WANN: mit Status antwortet `fetch` sofort (die Statuszeile ist damit
 * gemessene Tatsache) und erst das Lesen des Körpers hängt bis zum Abbruch; ohne Status hängt schon
 * der Aufruf selbst. Beides endet am selben AbortSignal — der Unterschied ist genau der, den der
 * Fehlerweg auseinanderhalten muss.
 */
function fetchMitZeitlimit(statusZuerst: number | undefined): void {
  vi.stubGlobal("fetch", (async (_url: unknown, init?: { signal?: AbortSignal }) => {
    const signal = init?.signal;
    const bisAbbruch = <T>(): Promise<T> =>
      new Promise<T>((_ok, fehler) => {
        signal?.addEventListener("abort", () => fehler(new Error("The operation was aborted")));
      });
    if (statusZuerst === undefined) {
      return bisAbbruch<Response>();
    }
    return { ok: false, status: statusZuerst, text: bisAbbruch<string> } as unknown as Response;
  }) as unknown as typeof fetch);
}

/** Der geworfene Fehler eines Textaufrufs — oder ein sprechendes Rot statt „undefined". */
async function fehlerVonComplete(env: Record<string, string | undefined>): Promise<unknown> {
  const client = cloudClient(env);
  if (!client) {
    throw new Error("Kein Cloud-Client aus der Env — die Probe misst dann gar nichts.");
  }
  try {
    await client.complete("system", "nutzer", false);
  } catch (err) {
    return err;
  }
  throw new Error(
    "Der Aufruf hat NICHT geworfen, obwohl der Anbieter mit einem Fehler antwortete.",
  );
}

function meldung(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ================================================================================================
// DIE MASKIERUNGSFORMEN, IN DENEN EIN ANBIETER EINEN SCHLÜSSEL ZURÜCKZITIERT.
// ================================================================================================
//
// Alle Werte sind SYNTHETISCH und stehen nur hier — kein echter Schlüssel, kein Schlüsselbund, kein
// Netz. `rest` ist jeweils das Stück, das eine zu kurz greifende Tilgung stehen liesse: genau daran
// (und nicht am blossen Fehlen von „sk-") entscheidet sich, ob ein SCHLÜSSELAUSSCHNITT entkommt.
// Die letzten beiden Zeilen sind bens Runde-3-Fund: das Einzelzeichen U+2026 statt drei ASCII-Punkte.
const MASKIERTE_ECHOS: { echo: string; rest: string }[] = [
  { echo: "sk-proj-BEN***SYNTHETIC_TAIL", rest: "SYNTHETIC_TAIL" },
  { echo: "sk-proj-********************KLARWERK9", rest: "KLARWERK9" },
  { echo: "sk-...NUR-EIN-TEST", rest: "NUR-EIN-TEST" },
  { echo: "sk_live_ABC***RESTSTUECK", rest: "RESTSTUECK" },
  { echo: "sk-…BEN_SYNTHETIC_TAIL", rest: "BEN_SYNTHETIC_TAIL" },
  { echo: "sk-proj-…REST_NACH_UNICODE", rest: "REST_NACH_UNICODE" },
];

/** Kein Schlüsselkopf, kein Schlüsselrumpf, kein Schlüsselrest — an KEINER der drei Stellen. */
function pruefeOhneSchluesselrest(text: string, echo: string, rest: string): void {
  expect([echo, "sk-", text.includes("sk-")]).toEqual([echo, "sk-", false]);
  expect([echo, "sk_", text.includes("sk_")]).toEqual([echo, "sk_", false]);
  expect([echo, rest, text.includes(rest)]).toEqual([echo, rest, false]);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ================================================================================================
// FALL 1-3b — DIE BEGRÜNDUNG DES ANBIETERS KOMMT MIT, GEHEIMNISFREI UND OHNE ERFINDUNG.
// ================================================================================================
describe("JOB 3122 · der OpenAI-Weg sagt, WARUM er nicht antwortet", () => {
  it("F1: ein 400 trägt die Begründung des Anbieters — Präfix unverändert, Grund angehängt", async () => {
    fetchMitFehlantwort({
      status: 400,
      koerper: JSON.stringify({
        error: {
          message: "The model 'claude-sonnet-4-6' does not exist",
          code: "model_not_found",
        },
      }),
    });
    const err = await fehlerVonComplete(OPENAI_ENV);
    expect(err).toBeInstanceOf(ModelHttpError);
    expect((err as ModelHttpError).status).toBe(400);
    // Das Präfix bleibt ZEICHENGLEICH und steht am Anfang — `model-errors.ts` und
    // `ai-check-worker.ts` lesen den Status genau daraus.
    expect(meldung(err).startsWith("ChatGPT (OpenAI) antwortete mit 400")).toBe(true);
    // Und die Auskunft, die vorher weggeworfen wurde, ist jetzt da.
    expect(meldung(err)).toContain("model_not_found");
    expect(meldung(err)).toContain("The model 'claude-sonnet-4-6' does not exist");
    // Der Grund ist ein FELD, nicht nur Text im Satz.
    expect((err as ModelHttpError).anbieterGrund).toContain("model_not_found");
  });

  it("F2: ein Schlüssel im Fremdzitat wird getilgt — er verlässt den Prozess auch so nicht", async () => {
    fetchMitFehlantwort({
      status: 401,
      koerper: JSON.stringify({
        error: {
          message:
            "Incorrect API key provided: sk-proj-ABC123XYZ. You can find your API key at https://platform.openai.com/account/api-keys.",
          code: "invalid_api_key",
        },
      }),
    });
    const err = await fehlerVonComplete(OPENAI_ENV);
    expect(meldung(err)).not.toContain("sk-proj-ABC123XYZ");
    expect((err as ModelHttpError).anbieterGrund ?? "").not.toContain("sk-proj-ABC123XYZ");
    // Getilgt heisst NICHT verstummt: die Klasse der Ursache bleibt lesbar.
    expect(meldung(err)).toContain("invalid_api_key");
    expect(meldung(err).startsWith("ChatGPT (OpenAI) antwortete mit 401")).toBe(true);
  });

  it("F2b: auch ein `Bearer …`-Echo wird getilgt", async () => {
    fetchMitFehlantwort({
      status: 403,
      koerper: "Rejected header: Authorization: Bearer sk-live-GEHEIM-4711",
    });
    const err = await fehlerVonComplete(OPENAI_ENV);
    expect(meldung(err)).not.toContain("sk-live-GEHEIM-4711");
    expect(meldung(err)).toContain("[entfernt]");
  });

  // JOB 3122 RUNDE 2 (bens Korrekturpflicht 1): OpenAI zitiert den Schlüssel MASKIERT zurück. Die
  // erste Fassung der Tilgung endete am ersten `*` und liess den Rest stehen — ein Ausschnitt, der
  // den Prozess nicht verlassen darf. Geprüft wird beides: die Meldung UND das Feld.
  //
  // JOB 3122 RUNDE 3 (bens Korrekturpflicht): die ASCII-Punktfolge `...` war geprüft, das
  // EINZELZEICHEN U+2026 (`…`) nicht — obwohl der Code-Kommentar es behauptete. Genau diese Lücke
  // fand bens Gegenprobe (`sk-…BEN_SYNTHETIC_TAIL` → `[entfernt]…BEN_SYNTHETIC_TAIL`). Beide
  // Schreibweisen stehen jetzt EINZELN in der Liste, keine steht nur im Kommentar.
  it("F2d: jede MASKIERUNGSFORM fällt vollständig — Stern, ASCII-Punktfolge und U+2026", async () => {
    for (const { echo, rest } of MASKIERTE_ECHOS) {
      fetchMitFehlantwort({
        status: 401,
        koerper: JSON.stringify({
          error: { message: `Incorrect API key provided: ${echo}.`, code: "invalid_api_key" },
        }),
      });
      const err = await fehlerVonComplete(OPENAI_ENV);
      const grund = (err as ModelHttpError).anbieterGrund ?? "";
      // Weder der Kopf noch der Rumpf noch das Ende des Echos bleibt irgendwo stehen.
      pruefeOhneSchluesselrest(meldung(err), echo, rest);
      pruefeOhneSchluesselrest(grund, echo, rest);
      // Getilgt heisst weiterhin NICHT verstummt.
      expect([echo, grund.includes("invalid_api_key")]).toEqual([echo, true]);
      vi.unstubAllGlobals();
    }
  });

  // Die GEGENRICHTUNG zu F2d: die Brücke darf nur tragen, wenn auf beiden Seiten Schlüssel steht.
  // Ein Satzpunkt (ASCII) und ein freistehendes Auslassungszeichen (U+2026) leiten hier eine
  // ERKLÄRUNG ein, keinen Schlüsselrest — sie dürfen den Satz nicht mit in die Tilgung reissen.
  it("F2e: die Tilgung frisst den Satz nicht — Satzpunkt und freies `…` bleiben Auskunft", async () => {
    for (const [koerpertext, erklaerung] of [
      [
        "Incorrect API key provided: sk-proj-ABC123. You can find your API key online.",
        "You can find your API key online.",
      ],
      [
        "Incorrect API key provided: sk-proj-ABC123… siehe Anbieter-Dokumentation.",
        "siehe Anbieter-Dokumentation.",
      ],
    ]) {
      fetchMitFehlantwort({
        status: 401,
        koerper: JSON.stringify({ error: { message: koerpertext } }),
      });
      const err = await fehlerVonComplete(OPENAI_ENV);
      expect([koerpertext, meldung(err).includes("sk-proj-ABC123")]).toEqual([koerpertext, false]);
      expect([koerpertext, meldung(err).includes(String(erklaerung))]).toEqual([koerpertext, true]);
      vi.unstubAllGlobals();
    }
  });

  it("F2c: der Grund ist einzeilig und auf 200 Zeichen gekappt — kein Roman im Log", async () => {
    fetchMitFehlantwort({
      status: 400,
      koerper: JSON.stringify({ error: { message: `A\nB${"x".repeat(500)}` } }),
    });
    const err = await fehlerVonComplete(OPENAI_ENV);
    const grund = (err as ModelHttpError).anbieterGrund ?? "";
    expect(grund.length).toBeGreaterThan(0);
    expect(grund.length).toBeLessThanOrEqual(200);
    expect(grund).not.toContain("\n");
  });

  it("F3: leerer Körper → die Meldung ist zeichengleich die bisherige, nichts wird erfunden", async () => {
    fetchMitFehlantwort({ status: 500, koerper: "" });
    const err = await fehlerVonComplete(OPENAI_ENV);
    expect(meldung(err)).toBe("ChatGPT (OpenAI) antwortete mit 500");
    expect((err as ModelHttpError).anbieterGrund).toBeUndefined();
  });

  it("F3b: scheitert das Lesen des Körpers, bleibt es bei der bisherigen Meldung — kein zweiter Fehler", async () => {
    fetchMitFehlantwort({ status: 502, koerperWirft: true });
    const err = await fehlerVonComplete(OPENAI_ENV);
    expect(err).toBeInstanceOf(ModelHttpError);
    expect(meldung(err)).toBe("ChatGPT (OpenAI) antwortete mit 502");
  });

  it("F3c: eine Antwort ganz ohne `text()` wirft ebenfalls nur den bisherigen Satz", async () => {
    fetchMitFehlantwort({ status: 400, ohneText: true });
    const err = await fehlerVonComplete(OPENAI_ENV);
    expect(err).toBeInstanceOf(ModelHttpError);
    expect(meldung(err)).toBe("ChatGPT (OpenAI) antwortete mit 400");
  });

  // JOB 3122 RUNDE 2 (bens Korrekturpflicht 2): der Fall, den die erste Fassung verlor. Der Anbieter
  // HAT geantwortet (400), nur der Körper tröpfelt bis ins Zeitlimit. Vorher überschrieb der
  // Zeitlimit-Zweig den bereits geworfenen HTTP-Fehler: aus Status 400 wurde ein Zeitlimit ohne
  // Status, aus „Anbieter lehnt ab" nutzerseitig „zu langsam".
  it("F3e: bricht die Körperlesung am Zeitlimit ab, bleibt der EMPFANGENE Status erhalten", async () => {
    fetchMitZeitlimit(400);
    const err = await fehlerVonComplete({ ...OPENAI_ENV, REASONER_TIMEOUT_MS: "25" });
    expect(err).toBeInstanceOf(ModelHttpError);
    expect((err as ModelHttpError).status).toBe(400);
    // Zeichengleich der bisherige Satz — es gab ja keinen Grund zu zitieren.
    expect(meldung(err)).toBe("ChatGPT (OpenAI) antwortete mit 400");
    expect(classifyModelFailure(err)).toEqual({ failureClass: "http", status: 400 });
  });

  it("F3f: OHNE Statuszeile bleibt das Zeitlimit das Zeitlimit — die Ausnahme greift nicht zu weit", async () => {
    fetchMitZeitlimit(undefined);
    const err = await fehlerVonComplete({ ...OPENAI_ENV, REASONER_TIMEOUT_MS: "25" });
    expect(err).toBeInstanceOf(ModelTimeoutError);
    expect(meldung(err)).toBe("ChatGPT (OpenAI) überschritt das Zeitlimit von 25 ms");
    expect(classifyModelFailure(err)).toEqual({ failureClass: "timeout" });
  });

  it("F3d: ist der Körper kein JSON, zählt der rohe Text — zitiert, nicht gedeutet", async () => {
    fetchMitFehlantwort({ status: 502, koerper: "<html><body>Bad Gateway</body></html>" });
    const err = await fehlerVonComplete(OPENAI_ENV);
    expect(meldung(err)).toContain("Bad Gateway");
    expect(meldung(err).startsWith("ChatGPT (OpenAI) antwortete mit 502")).toBe(true);
  });
});

// ================================================================================================
// DIE NUTZENKETTE — der reichere Satz darf die zwei Ableitungen dahinter nicht zerstören.
// ================================================================================================
describe("JOB 3122 · die Kette hinter der Meldung bleibt intakt", () => {
  it("N1: classifyModelFailure liest den Status weiterhin aus dem Meldungspräfix", () => {
    expect(
      classifyModelFailure(
        new ModelHttpError("ChatGPT (OpenAI) antwortete mit 400: model_not_found", 400),
      ),
    ).toEqual({ failureClass: "http", status: 400 });
    // Auch ohne typisierte Eigenschaft (fremde/injizierte Clients) greift das Muster.
    expect(
      classifyModelFailure(new Error("ChatGPT (OpenAI) antwortete mit 400: model_not_found")),
    ).toEqual({ failureClass: "http", status: 400 });
  });

  // JOB 3122 RUNDE 2 (bens Korrekturpflicht 4): N1/N2 prüfen KLASSIFIKATOREN — das ist kein Beleg
  // dafür, dass der Grund irgendwo ankommt. Dieser Fall läuft die Kette WIRKLICH durch: Env-Fabrik →
  // gecappter Cloud-Client → ModelProvider → Reasoner.extract → die Fallback-Note, die der Server
  // ausliefert (angezeigt in `apps/web/src/pages/Capture.tsx:1035`, `setFileNote(r.note)`). Gemessen
  // wird hier der SERVERSEITIGE Weg bis zu diesem Feld; die Browserdarstellung ist nicht Teil dieses
  // Laufs und wird auch nicht behauptet.
  it("N3: die Begründung des Anbieters steht in der Extract-Fallback-Note — die ganze Kette, nicht nur die Klasse", async () => {
    fetchMitFehlantwort({
      status: 400,
      koerper: JSON.stringify({
        error: {
          message: "The model 'claude-sonnet-4-6' does not exist",
          code: "model_not_found",
        },
      }),
    });
    const client = cloudClient(OPENAI_ENV);
    if (!client) {
      throw new Error("Kein Cloud-Client aus der Env — die Probe misst dann gar nichts.");
    }
    const ergebnis = await new Reasoner(new ModelProvider(client)).extract(
      "Protokoll: Dosierpumpe P2 alle 200 Betriebsstunden mit Fett Typ Z schmieren.",
      "de",
    );
    // Keine erfundenen Punkte — der Fallback bleibt ehrlich leer.
    expect(ergebnis.points).toEqual([]);
    const note = ergebnis.note ?? "";
    // Vorher endete die Note nach dem Status. Jetzt trägt sie den Satz des Anbieters.
    expect(note).toContain("ChatGPT (OpenAI) antwortete mit 400");
    expect(note).toContain("model_not_found");
    expect(note).toContain("The model 'claude-sonnet-4-6' does not exist");
  });

  // JOB 3122 RUNDE 3 (bens Korrekturpflicht): die Tilgung wurde bis hierher NUR am geworfenen Fehler
  // geprüft. Die Note ist aber die Stelle, die der Server AUSLIEFERT — ein Schlüsselrest wäre dort
  // erst recht draussen. Deshalb dieselbe Kette wie N3, aber mit JEDER Maskierungsform: was am Ende
  // beim Nutzer ankommt, trägt keinen Schlüsselausschnitt.
  it("N4: auch in der ausgelieferten Extract-Note bleibt von keiner Maskierungsform ein Rest", async () => {
    for (const { echo, rest } of MASKIERTE_ECHOS) {
      fetchMitFehlantwort({
        status: 401,
        koerper: JSON.stringify({
          error: { message: `Incorrect API key provided: ${echo}.`, code: "invalid_api_key" },
        }),
      });
      const client = cloudClient(OPENAI_ENV);
      if (!client) {
        throw new Error("Kein Cloud-Client aus der Env — die Probe misst dann gar nichts.");
      }
      const ergebnis = await new Reasoner(new ModelProvider(client)).extract(
        "Protokoll: Dosierpumpe P2 alle 200 Betriebsstunden mit Fett Typ Z schmieren.",
        "de",
      );
      const note = ergebnis.note ?? "";
      pruefeOhneSchluesselrest(note, echo, rest);
      // Und die Note ist trotzdem eine Auskunft, kein Schweigen.
      expect([echo, note.includes("invalid_api_key")]).toEqual([echo, true]);
      expect([echo, note.includes("ChatGPT (OpenAI) antwortete mit 401")]).toEqual([echo, true]);
      vi.unstubAllGlobals();
    }
  });

  it("N2: die Ursachenableitung des Prüf-Workers findet den Status im längeren Satz", () => {
    expect(
      classifyAiCheckFailure(
        new Error(
          "ChatGPT (OpenAI) antwortete mit 401: Incorrect API key provided (invalid_api_key)",
        ),
      ),
    ).toBe("auth");
    expect(
      classifyAiCheckFailure(new Error("ChatGPT (OpenAI) antwortete mit 429: Rate limit reached")),
    ).toBe("rate-limit");
  });
});

// ================================================================================================
// FALL 4-6 — DIE ANBIETERFALLE FÄLLT: EIN ANTHROPIC-NAME LANDET NIE MEHR BEI CHATGPT.
// ================================================================================================
describe("JOB 3122 · ein Anthropic-Modellbezeichner geht nie an OpenAI", () => {
  it("F4: OPENAI_API_KEY + REASONER_MODEL=claude-… → es arbeitet der ANTHROPIC-Weg", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const client = cloudClient({
      ...OPENAI_ENV,
      REASONER_MODEL: "claude-sonnet-4-6",
      ANTHROPIC_API_KEY: "ant-test-nur-hier",
    });
    expect(client?.name).toBe("anthropic:claude-sonnet-4-6");
    expect(client?.name.startsWith("cloud:openai:")).toBe(false);
    expect(client?.model).toBe("claude-sonnet-4-6");
    // GENAU EINE Zeile erklärt die übergangene Konfiguration — mit den Env-NAMEN und dem Modell.
    expect(stderr).toHaveBeenCalledTimes(1);
    const zeile = String(stderr.mock.calls[0]?.[0] ?? "");
    expect(zeile).toContain("OPENAI_API_KEY");
    expect(zeile).toContain("REASONER_MODEL");
    expect(zeile).toContain("claude-sonnet-4-6");
    // Kein Schlüssel und kein Schlüsselausschnitt — auch nicht „sk-test…".
    expect(zeile).not.toContain("sk-test-nur-hier");
    expect(zeile).not.toContain("ant-test-nur-hier");
  });

  it("F4b: `anthropic/…` (Router-Schreibweise) und Grossschreibung fallen ebenso", () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    for (const modell of ["anthropic/claude-3-5-sonnet", "Claude-Sonnet-4-6"]) {
      const client = cloudClient({
        ...OPENAI_ENV,
        REASONER_MODEL: modell,
        ANTHROPIC_API_KEY: "ant-test-nur-hier",
      });
      expect([modell, client?.name.startsWith("cloud:openai:")]).toEqual([modell, false]);
      expect([modell, client?.name.startsWith("anthropic:")]).toEqual([modell, true]);
    }
  });

  // JOB 3122 RUNDE 2 (bens Korrekturpflicht 3): die Zeile sagte „Es arbeitet der Anthropic-Weg." —
  // OHNE Anthropic-Schlüssel arbeitet dort aber NIEMAND, die Fabrik liefert `undefined` und der
  // deterministische Ersatzmodus übernimmt. Eine Tatsachenaussage ohne ihre Voraussetzung.
  it("F4c: ohne Anthropic-Schlüssel bleibt der Cloud-Zugang inaktiv — und die Zeile sagt genau das", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    expect(cloudClient({ ...OPENAI_ENV, REASONER_MODEL: "claude-sonnet-4-6" })).toBeUndefined();
    const zeile = String(stderr.mock.calls[0]?.[0] ?? "");
    // Die starke Aussage steht nicht mehr da …
    expect(zeile).not.toContain("Es arbeitet der Anthropic-Weg");
    // … sondern die an ihre Voraussetzung gebundene, samt des Falls, der hier wirklich eintritt.
    expect(zeile).toContain("SOFERN dort ein Schlüssel vorliegt");
    expect(zeile).toContain("deterministische Ersatzmodus");
  });

  it("F5: ein echtes OpenAI-Modell bleibt am OpenAI-Weg — die Sperre sperrt nicht zu viel", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const client = cloudClient(OPENAI_ENV);
    expect(client?.name.startsWith("cloud:openai:")).toBe(true);
    expect(client?.name).toBe("cloud:openai:gpt-4o-mini");
    expect(stderr).not.toHaveBeenCalled();
  });

  // JOB 3122 RUNDE 5 (selbst gefundene Prüflücke): §8.6(c) des Auftrags sagt zu, die Sperre treffe
  // „nur Präfixe […], keine Teilzeichenketten", und benennt als Bruchstelle ausdrücklich „ein echter
  // OpenAI-Modellname mit dem Wortbestandteil". Gedeckt war das NICHT: `F5` fährt `gpt-4o-mini`, und
  // darin kommt `claude-` gar nicht vor — die Verstellung von `startsWith` auf `includes` blieb
  // deshalb GRÜN (23/23), obwohl sie genau die zugesagte Eigenschaft aufhebt. Dieser Fall setzt den
  // Unterschied ausführbar: der Wortbestandteil steht MITTEN im Namen, nie am Anfang.
  it("F5b: die Sperre vergleicht PRÄFIXE, keine Teilzeichenketten — `claude-` mitten im Namen sperrt nicht", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    for (const modell of ["gpt-4o-claude-kompatibel", "openai/anthropic/bridge-v1"]) {
      const client = cloudClient({
        ...OPENAI_ENV,
        REASONER_MODEL: modell,
        // Ein Anthropic-Schlüssel liegt bereit: griffe die Sperre zu weit, entstünde hier ein
        // `anthropic:`-Client — der Fall fiele also auch ohne die Namensprüfung unten auf.
        ANTHROPIC_API_KEY: "ant-test-nur-hier",
      });
      expect([modell, client?.name]).toEqual([modell, `cloud:openai:${modell}`]);
      expect([modell, client?.model]).toEqual([modell, modell]);
    }
    // Kein übergangener Anbieter, also auch keine erklärende Zeile.
    expect(stderr).not.toHaveBeenCalled();
  });

  it("F6: ein leerer/nur-Leerzeichen-REASONER_MODEL fällt auf den Vorgabewert", () => {
    for (const leer of ["   ", ""]) {
      const client = cloudClient({ ANTHROPIC_API_KEY: "ant-test-nur-hier", REASONER_MODEL: leer });
      expect([leer, client?.model]).toEqual([leer, "claude-sonnet-4-6"]);
      expect([leer, client?.name]).toEqual([leer, "anthropic:claude-sonnet-4-6"]);
    }
  });
});

// ================================================================================================
// FALL 7 — DIE COMPOSE-FALLE IST GESCHLOSSEN.
// ================================================================================================
//
// AUSDRÜCKLICHE GRENZE: `docker-compose.prod.yml` ist NICHT die Coolify-Deploy-Quelle (Dateikopf
// :1-10, gehütet von `tests/app/coolify-compose-quellwahrheit.test.ts`). Dieser Fall sichert den
// EIN-BEFEHL-Weg — über den Live-Betrieb sagt er nichts.
describe("JOB 3122 · die Compose-Vorgabe setzt keinen Anthropic-Namen mehr", () => {
  const compose = readFileSync("docker-compose.prod.yml", "utf8");

  it("C1: die REASONER_MODEL-Zeile trägt keinen Anthropic-Bezeichner als Vorgabewert", () => {
    const zeile = compose.split("\n").find((z) => z.trim().startsWith("REASONER_MODEL:"));
    expect(
      zeile,
      "Die REASONER_MODEL-Zeile fehlt — der Name muss durchgereicht bleiben.",
    ).toBeDefined();
    expect(
      /claude|anthropic\//i.test(zeile ?? ""),
      "Die Compose-Vorgabe schickt wieder einen Anthropic-Bezeichner an den OpenAI-Weg.",
    ).toBe(false);
  });

  it("C2: der Name bleibt durchgereicht — er gehört weiterhin zu beiden Anbietern", () => {
    expect(compose).toContain("REASONER_MODEL: ${REASONER_MODEL:-}");
  });
});
