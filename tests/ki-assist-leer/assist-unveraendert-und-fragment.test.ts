// ================================================================================================
// JOB 3276 RUNDE 3 (KI-ASSIST-LEER) — DIE ZWEI FÄLLE, DIE CODEX IN DER VORPRÜFUNG NACHGELEGT HAT.
// ================================================================================================
//
// Runde 2 hat die LEERE Modellantwort erledigt. Codex' Vorprüfung vom 08.09. 16:30 hat danach zwei
// Wege gemessen, auf denen weiterhin ein Nicht-Vorschlag als Vorschlag beim Menschen ankam:
//
//   (a) DAS MODELL ANTWORTET, ÄNDERT ABER NICHTS. `provider-model` und `service` reichten den
//       unveränderten Text als Vorschlag durch. Für Pedi ist das derselbe Betrug wie der geglättete
//       Ersatz: er klickt „Rechtschreibung", bekommt „notirt" zurück und hält es für geprüft.
//       Die Meldung dafür ist eine ANDERE als bei der leeren Antwort — „Die KI hat keine Antwort
//       geliefert" wäre hier unwahr, sie hat ja geantwortet.
//
//   (b) `finish_reason: length` MIT INHALT. Der Chokepoint meldete das Fragment serverintern
//       (JOB 3239) und gab es weiter; die Assist-Route und die Editorvorschau trugen kein
//       Fragmentmerkmal. Ein am Token-Limit abgerissener Satz mit scharfem „Ersetzen"-Schalter
//       schneidet dem Menschen das Ende seines eigenen Absatzes ab.
//
// DER MASSSTAB FÜR (a) IST BEWUSST ENGER ALS BEIM DETERMINISTISCHEN ERSATZ: verglichen wird nach
// Whitespace-Normalisierung, sonst nichts. Ein Modell, das GENAU Groß-/Kleinschreibung und
// Satzzeichen korrigiert, hat wirklich gearbeitet — sein Ergebnis bleibt ein gültiger Vorschlag
// (I4). Der Ersatz dagegen KANN nur das; bei ihm zählt es nicht (dort greift assist-leere-antwort
// B5). Zwei Fälle, zwei Maßstäbe, beide hier belegt.
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryModelRunRepo, type ModelRunRecord } from "../../services/model-runs";
import {
  type ModelClient,
  ModelProvider,
  Reasoner,
  cappedModelClient,
  createCappedCloudClientFromEnv,
} from "../../services/reasoner";
import { ModelEmptyResponseError } from "../../services/reasoner/src/model-errors";

const ROHTEXT = "die pumpe wurde am montag notirt und die anzahl stimmt nicht";

// Derselbe Aufbau wie in assist-leere-antwort.test.ts: hinter dem ECHTEN Chokepoint, damit der Lauf
// wirklich einen Anbieter und ein Modell trägt.
function client(antwort: string): ModelClient {
  return cappedModelClient(
    {
      name: "cloud:openai:gpt-6-astra",
      model: "gpt-6-astra",
      complete: async () => antwort,
    },
    { rejectsConfidential: false },
  );
}

// ---- (b) braucht die ECHTE OpenAI-Kante, denn nur sie liest `finish_reason` ---------------------
const KEIN_SCHLUESSELBUND = (): undefined => undefined;
const KEIN_SPEICHERN = (): boolean => false;
const ENV = {
  OPENAI_API_KEY: "sk-test-nur-in-diesem-test",
  OPENAI_MODEL: "gpt-6-astra",
} as const;

function stubFetch(antwort: unknown): void {
  vi.stubGlobal("fetch", (async () => {
    return { ok: true, json: async () => antwort } as unknown as Response;
  }) as unknown as typeof fetch);
}

function openAiClient(): ModelClient {
  const c = createCappedCloudClientFromEnv(ENV, KEIN_SCHLUESSELBUND, KEIN_SPEICHERN).openai;
  if (!c) {
    throw new Error("Der OpenAI-Weg ist in diesem Test nicht entstanden.");
  }
  return c;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JOB 3276 I · ein unverändert zurückgegebener Text ist kein Vorschlag", () => {
  it("I1 das Modell echot den Text → ehrliche Meldung „keine Änderungen“, nicht der Text", async () => {
    const reasoner = new Reasoner(new ModelProvider(client(ROHTEXT)));

    const fehler = await reasoner.assistText(ROHTEXT, "de").catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(Error);
    const meldung = (fehler as Error).message;
    expect(meldung).toContain("Die KI hat keine Änderungen vorgeschlagen");
    // Und ausdrücklich NICHT der Satz für die leere Antwort — das wäre eine andere Tatsache.
    expect(meldung).not.toContain("keine Antwort geliefert");
    // Der Grund nennt Anbieter und Modell, nie den Text des Nutzers.
    expect(meldung).toContain("gpt-6-astra");
    expect(meldung).not.toContain("notirt");
  });

  it("I2 dieselbe Lage auf Englisch (Vorführung am 11.09.)", async () => {
    const reasoner = new Reasoner(new ModelProvider(client(ROHTEXT)));

    const fehler = await reasoner.assistText(ROHTEXT, "en").catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(Error);
    expect((fehler as Error).message).toBe(
      "The AI proposed no changes. Reason: cloud:openai:gpt-6-astra (gpt-6-astra) returned the text unchanged.",
    );
  });

  it("I3 nur anderer Leerraum/Zeilenumbruch ist keine Änderung", async () => {
    const nurLeerraum = "  die pumpe wurde am montag notirt\n   und die anzahl stimmt nicht  ";
    const reasoner = new Reasoner(new ModelProvider(client(nurLeerraum)));

    await expect(reasoner.assistText(ROHTEXT, "de")).rejects.toThrow(
      /keine Änderungen vorgeschlagen/,
    );
  });

  it("I4 GEGENFALL: korrigiert das Modell Großschreibung und Satzzeichen, IST das ein Vorschlag", async () => {
    // Der Maßstab des Modells ist enger als der des Ersatzes — sonst würde eine echte
    // Rechtschreibkorrektur an genau diesen Stellen als „nichts getan" abgewiesen.
    const korrigiert = "Die pumpe wurde am montag notirt und die anzahl stimmt nicht.";
    const reasoner = new Reasoner(new ModelProvider(client(korrigiert)));

    const ergebnis = await reasoner.assistText(ROHTEXT, "de");
    expect(ergebnis.demo).toBe(false);
    expect(ergebnis.text).toBe(korrigiert);
  });

  it("I5 der Versuch steht mit Anbieter, Modell und Grund im Laufprotokoll", async () => {
    const repo = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(new ModelProvider(client(ROHTEXT)), undefined, repo);

    await reasoner.assistText(ROHTEXT, "de").catch(() => undefined);

    const laeufe: ModelRunRecord[] = await repo.recent(10);
    expect(laeufe).toHaveLength(1);
    const lauf = laeufe[0] as ModelRunRecord;
    expect(lauf.task).toBe("assist");
    expect(lauf.status).toBe("error");
    expect(lauf.error ?? "").toContain("cloud:openai:gpt-6-astra");
    expect(lauf.error ?? "").toContain("unverändert");
    expect(lauf.error ?? "").not.toContain("notirt");
  });

  it("I6 leerer Eingabetext bleibt der Bestandsweg — kein behaupteter Ausfall", async () => {
    // Ohne Text gibt es nichts zu ändern; hier wäre eine Ausfallmeldung selbst eine Unwahrheit.
    const reasoner = new Reasoner(new ModelProvider(client("")));

    const ergebnis = await reasoner.assistText("   ", "de");
    expect(ergebnis.text).toBe("");
  });
});

describe("JOB 3276 J · ein am Token-Limit abgerissener Satz ist kein Vorschlag", () => {
  const FRAGMENT = "Die Pumpe wurde am Montag notiert und die Anzahl stimmt";

  it("J1 finish_reason=length MIT Inhalt → Fehler 'truncated', nicht das Fragment", async () => {
    stubFetch({ choices: [{ finish_reason: "length", message: { content: FRAGMENT } }] });

    const fehler = await new ModelProvider(openAiClient())
      .assistText(ROHTEXT, "de")
      .catch((e: unknown) => e);

    expect(fehler).toBeInstanceOf(ModelEmptyResponseError);
    expect((fehler as ModelEmptyResponseError).reason).toBe("truncated");
    // Der Grund ist maschinen- UND menschenlesbar; der Text des Nutzers steht nicht darin.
    expect((fehler as ModelEmptyResponseError).message).toContain("finish_reason=length");
    expect((fehler as ModelEmptyResponseError).message).toContain("max_completion_tokens=");
    expect((fehler as ModelEmptyResponseError).message).not.toContain("notirt");
  });

  it("J2 durch die ganze Kette: der Mensch bekommt die Meldung MIT diesem Grund", async () => {
    stubFetch({ choices: [{ finish_reason: "length", message: { content: FRAGMENT } }] });
    const reasoner = new Reasoner(new ModelProvider(openAiClient()));

    const fehler = await reasoner.assistText(ROHTEXT, "de").catch((e: unknown) => e);

    const meldung = (fehler as Error).message;
    expect(meldung).toContain("Die KI hat keine Antwort geliefert");
    expect(meldung).toContain("abgeschnitten");
    expect(meldung).toContain("finish_reason=length");
    // Das Fragment selbst kommt NIRGENDS als Vorschlag an.
    expect(meldung).not.toContain(FRAGMENT);
  });

  it("J3 GEGENFALL: dieselbe Antwort mit finish_reason=stop wird ganz normal übernommen", async () => {
    stubFetch({ choices: [{ finish_reason: "stop", message: { content: FRAGMENT } }] });

    const ergebnis = await new ModelProvider(openAiClient()).assistText(ROHTEXT, "de");
    expect(ergebnis.demo).toBe(false);
    expect(ergebnis.text).toBe(FRAGMENT);
  });

  it("J4 die Regel gilt NUR für assist: andere Aufgaben bekommen ihr Fragment weiterhin", async () => {
    // Wichtig für die Verträglichkeit: `salvageTruncatedExtract` lebt davon, dass abgeschnittene
    // Antworten den Aufrufer erreichen. Der Abbruch-Befund wird deshalb nur dort ausgewertet, wo
    // er schadet — im assist-Pfad. Belegt am Interview, das die Modellformulierung übernimmt.
    stubFetch({ choices: [{ finish_reason: "length", message: { content: "Was genau ist am" } }] });

    const ergebnis = await new ModelProvider(openAiClient()).interview(
      ["Ventil X schließen."],
      "de",
    );
    expect(ergebnis.question).toBe("Was genau ist am");
  });
});
