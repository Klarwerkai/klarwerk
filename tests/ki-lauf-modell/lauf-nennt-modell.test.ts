// ================================================================================================
// JOB 3036 — DAS LAUFPROTOKOLL NENNT DAS ECHTE MODELL, NICHT EIN ZWEITES MAL DEN PROVIDER.
// ================================================================================================
//
// DER BEFUND am Basisstand 6284f7e: `service.ts` schrieb `provider: provider.name` UND
// `model: provider.name` — zwei Zusagen (`model-runs/src/types.ts:153` und `:161`), ein Wert. Ein
// Datensatz sagte damit zweimal „anthropic:claude-sonnet-4-6" und kein einziges Mal, WELCHES Modell
// gearbeitet hat. Der gescheiterte Lauf sagte gar nichts: er trug kein `model`, war also von einem
// rein deterministischen Lauf nicht zu unterscheiden.
//
// WAS HIER GEMESSEN WIRD, ist die ganze Kette aus den ECHTEN Umgebungsfabriken
// (`createCappedCloudClientFromEnv` / `createCappedLocalClientFromEnv`) bis in den geschriebenen
// Datensatz — nicht der rohe Client. Das ist Absicht: nach draußen gibt es ausschließlich den
// GECAPPTEN Client (`model-client.ts:411-425`, `:465-482`), und genau dieser Wrapper baute ein neues
// Objekt und kopierte nur `name` und `rejectsConfidential`. Eine Probe am rohen Client wäre grün
// gewesen, während das Produkt den Wert verliert.
//
// HERMETIK: kein Netz. `fetch` ist global ersetzt, der Schlüssel kommt aus der übergebenen Env
// (der Schlüsselbund wird nie gefragt — beide Zugriffe sind ausdrücklich stillgelegt).
//
// DIE EHRLICHKEITSGRENZE, die hier ebenfalls festgehalten wird: wo KEIN echtes Modell gearbeitet hat
// oder der Client seinen Modellnamen nicht nennt, FEHLT das Feld. Es wird nie durch `provider.name`
// oder einen anderen Ersatzwert gefüllt (M3, M4, M5).
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryModelRunRepo, type ModelRunRecord } from "../../services/model-runs";
import {
  DeterministicProvider,
  ModelProvider,
  Reasoner,
  type ReasonerProvider,
} from "../../services/reasoner";
// SCRUM-502 R8: die Umgebungsfabriken sind bewusst nicht aus dem Paket-Index exportiert; der Zugriff
// erfolgt relativ auf das Modul — dasselbe Muster wie in `tests/reasoner/dual-provider.test.ts`.
import {
  createCappedCloudClientFromEnv,
  createCappedLocalClientFromEnv,
} from "../../services/reasoner/src/model-client";
import { cappedModelClient } from "../../services/reasoner/src/model-concurrency";
import type { ModelClient } from "../../services/reasoner/src/provider-model";

const CLOUD_ENV = {
  ANTHROPIC_API_KEY: "test-schluessel-nur-hier",
  REASONER_MODEL: "claude-sonnet-4-6",
};

const LOCAL_ENV = {
  KLARWERK_LOCAL_LLM_URL: "http://127.0.0.1:8000/v1",
  KLARWERK_LOCAL_LLM_MODEL: "qwen3-32b-awq",
};

// Der Schlüsselbund wird in diesem Test NIE befragt (der Schlüssel steht in der Env) — beide
// Zugriffe sind trotzdem ausdrücklich stillgelegt, damit der Lauf auf jedem Rechner gleich ist.
const KEIN_SCHLUESSELBUND = () => undefined;
const KEIN_SPEICHERN = () => false;

function alsAntwort(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

// `fetch` global ersetzen — die Umgebungsfabriken nehmen kein injizierbares `fetchFn` entgegen
// (`model-client.ts:244-248`, `:402-408`), und genau sie sollen hier gemessen werden.
function stelleFetch(antwort: () => Response): void {
  vi.stubGlobal("fetch", (async () => antwort()) as unknown as typeof fetch);
}

function cloudAntwortet(text: string): void {
  stelleFetch(() => alsAntwort({ content: [{ type: "text", text }] }));
}

function lokalAntwortet(text: string): void {
  stelleFetch(() => alsAntwort({ choices: [{ message: { content: text } }] }));
}

function cloudScheitert(): void {
  stelleFetch(() => alsAntwort({}, false, 500));
}

// Ein Provider in der BESTANDSFORM: kein `modelName`. Beweist, dass die optionale Deklaration trägt.
function providerOhneModellnamen(name: string, assist: () => Promise<string>): ReasonerProvider {
  return {
    name,
    isAvailable: () => true,
    structure: async () => {
      throw new Error("in diesem Test nicht benutzt");
    },
    answer: async () => {
      throw new Error("in diesem Test nicht benutzt");
    },
    assistText: async () => ({ text: await assist(), demo: false }),
    interview: async () => {
      throw new Error("in diesem Test nicht benutzt");
    },
    extract: async () => {
      throw new Error("in diesem Test nicht benutzt");
    },
    select: () => [],
  };
}

// Ein Lauf über den ECHTEN Weg (Reasoner.assistText → runTask → recordRun) und der daraus
// geschriebene Datensatz. `fehlerErlaubt` deckt den Fall, in dem die ganze Kette scheitert (M6).
async function laufUndDatensatz(
  primary: ReasonerProvider | undefined,
  fallback: ReasonerProvider = new DeterministicProvider(),
): Promise<ModelRunRecord> {
  const repo = new InMemoryModelRunRepo();
  const reasoner = new Reasoner(primary, fallback, repo);
  try {
    await reasoner.assistText("Roher Satz, der geglättet werden soll.", "de");
  } catch {
    // M6: die ganze Kette scheitert — der FEHLER-Datensatz ist genau das, was hier geprüft wird.
  }
  const laeufe = await repo.recent(10);
  expect(laeufe).toHaveLength(1);
  return laeufe[0] as ModelRunRecord;
}

// ------------------------------------------------------------------------------------------------
// RUNDE 2 (bens Befund): der AUFRUFZÄHLER. Der innere Client zählt, wie oft er wirklich gerufen
// wurde; nach außen steht der ECHTE Chokepoint `cappedModelClient` davor — gemessen wird also die
// Verdrahtung des Produkts, nicht ein Kurzschluss um sie herum. `verzoegert` hält den Aufruf offen,
// solange ein zweiter Lauf danebenläuft (M14).
function zaehlenderClient(verzoegert = false): {
  client: ModelClient;
  aufrufe: () => number;
} {
  let aufrufe = 0;
  const inner: ModelClient = {
    name: "anthropic:gezaehltes-modell",
    model: "gezaehltes-modell",
    complete: async () => {
      aufrufe += 1;
      if (verzoegert) {
        await new Promise((fertig) => setTimeout(fertig, 20));
      }
      return "Antwort aus dem gezählten Modell.";
    },
  };
  return {
    client: cappedModelClient(inner, { rejectsConfidential: false }),
    aufrufe: () => aufrufe,
  };
}

// Führt EINE beliebige Aufgabe an einem Reasoner mit gezähltem Modell aus und gibt den
// geschriebenen Datensatz samt Aufrufzahl zurück.
async function laufMitZaehler(
  aufgabe: (reasoner: Reasoner) => Promise<unknown>,
): Promise<{ datensatz: ModelRunRecord; aufrufe: number }> {
  const { client, aufrufe } = zaehlenderClient();
  const repo = new InMemoryModelRunRepo();
  const reasoner = new Reasoner(new ModelProvider(client), new DeterministicProvider(), repo);
  await aufgabe(reasoner);
  const laeufe = await repo.recent(10);
  expect(laeufe).toHaveLength(1);
  return { datensatz: laeufe[0] as ModelRunRecord, aufrufe: aufrufe() };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JOB 3036: der Lauf nennt das echte Modell", () => {
  it("M1 Cloud-Lauf: model ist der reine Modellbezeichner, provider bleibt der Clientname", async () => {
    cloudAntwortet("Geglätteter Satz.");
    const client = createCappedCloudClientFromEnv(CLOUD_ENV, KEIN_SCHLUESSELBUND, KEIN_SPEICHERN);
    const datensatz = await laufUndDatensatz(new ModelProvider(client));

    expect(datensatz.status).toBe("success");
    expect(datensatz.demo).toBe(false);
    expect(datensatz.provider).toBe("anthropic:claude-sonnet-4-6");
    expect(datensatz.model).toBe("claude-sonnet-4-6");
    // Der Kern des Auftrags: zwei Angaben, nicht zweimal dieselbe.
    expect(datensatz.model).not.toBe(datensatz.provider);
  });

  it("M2 Lauf am eigenen lokalen Modell: model ist der Modellbezeichner ohne Anbieterteil", async () => {
    lokalAntwortet("Geglätteter Satz.");
    const client = createCappedLocalClientFromEnv(LOCAL_ENV);
    const datensatz = await laufUndDatensatz(new ModelProvider(client));

    expect(datensatz.status).toBe("success");
    expect(datensatz.provider).toBe("local:qwen3-32b-awq");
    expect(datensatz.model).toBe("qwen3-32b-awq");
    expect(datensatz.model).not.toBe(datensatz.provider);
  });

  it("M3 rein deterministischer Lauf: das Feld model FEHLT (kein Ersatzwert)", async () => {
    const datensatz = await laufUndDatensatz(undefined);

    expect(datensatz.status).toBe("success");
    expect(datensatz.demo).toBe(true);
    expect(Object.hasOwn(datensatz, "model")).toBe(false);
    expect(datensatz.model).toBeUndefined();
    // Weder leerer String noch der Ersatzname des Providers.
    expect(datensatz.model).not.toBe("");
    expect(datensatz.model).not.toBe(datensatz.provider);
  });

  it("M4 Provider in der Bestandsform (ohne modelName): der Lauf gelingt, model fehlt, nichts wirft", async () => {
    const datensatz = await laufUndDatensatz(
      providerOhneModellnamen("fremd:bestandsform", async () => "Aus dem Double."),
    );

    expect(datensatz.status).toBe("success");
    expect(datensatz.provider).toBe("fremd:bestandsform");
    expect(Object.hasOwn(datensatz, "model")).toBe(false);
  });

  it("M5 Modell versucht, gescheitert, deterministisch geantwortet: kein model, aber fallback", async () => {
    cloudScheitert();
    const client = createCappedCloudClientFromEnv(CLOUD_ENV, KEIN_SCHLUESSELBUND, KEIN_SPEICHERN);
    const datensatz = await laufUndDatensatz(new ModelProvider(client));

    expect(datensatz.status).toBe("success");
    expect(datensatz.fallback).toBe(true);
    expect(datensatz.demo).toBe(true);
    // Es hat KEIN Modell geantwortet — also steht hier auch keines.
    expect(Object.hasOwn(datensatz, "model")).toBe(false);
  });

  it("M6 alle Provider gescheitert: der Fehler-Datensatz nennt das zuletzt versuchte Modell", async () => {
    cloudScheitert();
    const client = createCappedCloudClientFromEnv(CLOUD_ENV, KEIN_SCHLUESSELBUND, KEIN_SPEICHERN);
    const datensatz = await laufUndDatensatz(
      new ModelProvider(client),
      providerOhneModellnamen("ersatz-faellt-aus", async () => {
        throw new Error("auch der Ersatz antwortet nicht");
      }),
    );

    expect(datensatz.status).toBe("error");
    // Der Datensatz behauptet weiterhin NICHT, ein Modell habe geantwortet …
    expect(datensatz.provider).toBe("ersatz-faellt-aus");
    // … er sagt nur, welches es versucht hat.
    expect(datensatz.model).toBe("claude-sonnet-4-6");
  });

  it("M7 der Wrapper verliert den Modellnamen nicht", async () => {
    const innen: ModelClient = {
      name: "anthropic:claude-sonnet-4-6",
      model: "claude-sonnet-4-6",
      complete: async () => "egal",
    };
    expect(cappedModelClient(innen, { rejectsConfidential: true }).model).toBe("claude-sonnet-4-6");
    // Ein Client OHNE Modellangabe bekommt am Wrapper auch keines angedichtet.
    const ohne: ModelClient = { name: "fremd:alt", complete: async () => "egal" };
    const gewrappt = cappedModelClient(ohne, { rejectsConfidential: false });
    expect(Object.hasOwn(gewrappt, "model")).toBe(false);
  });

  it("M8 kein Anbieter-Präfix im Modellfeld — weder Cloud noch lokal", async () => {
    cloudAntwortet("Geglätteter Satz.");
    const cloud = await laufUndDatensatz(
      new ModelProvider(
        createCappedCloudClientFromEnv(CLOUD_ENV, KEIN_SCHLUESSELBUND, KEIN_SPEICHERN),
      ),
    );
    expect(cloud.model).not.toMatch(/^(anthropic|local):/);

    vi.unstubAllGlobals();
    lokalAntwortet("Geglätteter Satz.");
    const lokal = await laufUndDatensatz(
      new ModelProvider(createCappedLocalClientFromEnv(LOCAL_ENV)),
    );
    expect(lokal.model).not.toMatch(/^(anthropic|local):/);
  });
});

// ================================================================================================
// RUNDE 2 — EIN MODELL-PROVIDER, DER ZURÜCKKEHRT, HAT NICHT ZWANGSLÄUFIG GERECHNET.
// ================================================================================================
//
// BENS BEFUND an Runde 1: `ModelProvider` hat vier Wege, die VOR jedem Client-Aufruf zurückkehren,
// und `select` rechnet ohne Modell. Runde 1 schrieb dort trotzdem einen Modellnamen — eine
// Behauptung ohne Vorgang. Diese Fälle halten fest, dass das Feld jetzt genau dann entsteht, wenn
// der Client wirklich gerufen wurde: Aufrufzähler 0 ⇔ kein `model` im Datensatz.
describe("JOB 3036 R2: ohne echten Modellaufruf steht kein Modell im Protokoll", () => {
  it("KALIBRIERUNG: derselbe Zähler zählt einen echten Aufruf — und dann steht das Modell da", async () => {
    const { datensatz, aufrufe } = await laufMitZaehler((r) => r.assistText("Roher Satz.", "de"));

    expect(aufrufe).toBe(1);
    expect(datensatz.provider).toBe("anthropic:gezaehltes-modell");
    expect(datensatz.model).toBe("gezaehltes-modell");
  });

  it("M9 answer ohne tragende Quelle: das Modell wird nie befragt (provider-model.ts:1442)", async () => {
    const { datensatz, aufrufe } = await laufMitZaehler((r) =>
      r.answer("Wie hoch ist der Prüfdruck?", [], "de"),
    );

    expect(aufrufe).toBe(0);
    expect(datensatz.task).toBe("answer");
    expect(datensatz.provider).toBe("anthropic:gezaehltes-modell");
    expect(Object.hasOwn(datensatz, "model")).toBe(false);
  });

  it("M10 bereits abgeschlossenes interview: kein Aufruf, kein Modell (provider-model.ts:1323)", async () => {
    const { datensatz, aufrufe } = await laufMitZaehler((r) =>
      r.interview(["Die Kernaussage.", "Ab Inbetriebnahme.", "Hauptschalter verriegeln."], "de"),
    );

    expect(aufrufe).toBe(0);
    expect(datensatz.task).toBe("interview");
    expect(Object.hasOwn(datensatz, "model")).toBe(false);
  });

  it("M11 extract auf leerem Dokument: kein Aufruf, kein Modell (provider-model.ts:1351)", async () => {
    const { datensatz, aufrufe } = await laufMitZaehler((r) => r.extract("   \n  ", "de"));

    expect(aufrufe).toBe(0);
    expect(datensatz.task).toBe("extract");
    expect(Object.hasOwn(datensatz, "model")).toBe(false);
  });

  it("M12 helpAnswer ohne Wissensbasis: kein Aufruf, kein Modell (provider-model.ts:1203)", async () => {
    const { datensatz, aufrufe } = await laufMitZaehler((r) =>
      r.helpAnswer("Wie melde ich an?", []),
    );

    expect(aufrufe).toBe(0);
    expect(Object.hasOwn(datensatz, "model")).toBe(false);
  });

  // EHRLICH GEKENNZEICHNET: M13 fängt den Runde-1-Fehler NICHT (select protokolliert über
  // `logSelect` und ging nie durch `runTask`, trug also auch vorher kein `model`). Der Fall steht
  // hier, weil `select` die fünfte Aufgabe ohne Modellaufruf ist und so bleiben muss.
  it("M13 select rechnet ohne Modell: der Datensatz behauptet auch keines", async () => {
    const { datensatz, aufrufe } = await laufMitZaehler(async (r) => r.select("Frage", []));

    expect(aufrufe).toBe(0);
    expect(datensatz.task).toBe("select");
    expect(Object.hasOwn(datensatz, "model")).toBe(false);
  });

  it("M14 zwei gleichzeitige Läufe auf DERSELBEN Instanz vermischen ihre Spuren nicht", async () => {
    // Der Kern der Nebenläufigkeit: ein Merker am Provider oder am Client würde hier überlaufen —
    // der Modellaufruf des einen Laufs steht offen, während der andere ohne Aufruf sein Protokoll
    // schreibt. Die Spur hängt an der asynchronen Aufrufkette, nicht am geteilten Objekt.
    const { client, aufrufe } = zaehlenderClient(true);
    const repo = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(new ModelProvider(client), new DeterministicProvider(), repo);

    await Promise.all([
      reasoner.assistText("Roher Satz.", "de"),
      reasoner.helpAnswer("Frage ohne Wissensbasis?", []),
    ]);

    expect(aufrufe()).toBe(1);
    const laeufe = await repo.recent(10);
    expect(laeufe).toHaveLength(2);
    const mitAufruf = laeufe.find((l) => l.task === "assist") as ModelRunRecord;
    const ohneAufruf = laeufe.find((l) => l.task === "answer") as ModelRunRecord;
    expect(mitAufruf.model).toBe("gezaehltes-modell");
    expect(Object.hasOwn(ohneAufruf, "model")).toBe(false);
  });
});
