import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// ================================================================================================
// AUFTRAG-mega79 BLOCK B — DIE ANZEIGE WIRD AN DEN TATSAECHLICHEN ANTWORTWEG GEBUNDEN.
// ================================================================================================
//
// WAS HIER SCHIEFGING (mega77, bens ROT): der Waechter pinnte, dass der sichtbare Satz die WOERTER
// „Klaras Antwort" enthaelt. Namensanwesenheit statt Verhalten — und genau deshalb blieb
// „Fuer Klaras Antwort arbeitet zurzeit eine externe KI (Cloud)" dauerhaft gruen, obwohl Klaras
// Antwort NIE ein Modell erreicht.
//
// DIE UMKEHRUNG: dieser Test nimmt die Erzwingung nicht an, er ERHEBT sie — durch AUSFUEHRUNG der
// produktiven Aufrufkette, Glied fuer Glied:
//
//   1. `performAsk` aus apps/web/src/lib/wordAddin.ts wird GERUFEN; beobachtet wird der Rumpf,
//      den es absetzt — der `mode`-Wert wird daraus GELESEN, nicht hier hingeschrieben.
//   2. Dasselbe fuer das WIRKLICH ausgelieferte Aufgabenfenster: der Block zwischen
//      KW-KLARA-ASK-FETCH-START/END wird aus taskpane.html geschnitten und ausgefuehrt.
//   3. Genau dieser erhobene Rumpf geht durch die ECHTE HTTP-Route POST /api/ask (build-app,
//      InMemory-Repos) — mit Spys an den beiden Flaechen, an denen ein Modell bzw. ein Embedder
//      ueberhaupt gerufen werden koennte.
//   4. Der Gegenlauf OHNE `mode` beweist, dass diese Spys wirklich greifen (sonst waere die Null
//      eine Null aus Blindheit).
//
// ERST WENN das beobachtet ist, wird die Anzeige geprueft — und zwar ueber JEDEN Zustand, den die
// echte Ableitung `klaraAiLage` hergibt (gesammelt, nicht aufgezaehlt). Die Kopplung gilt in BEIDE
// Richtungen: behauptet ein sichtbarer Satz ein Modell, waehrend die Kette keines ruft, ist die
// Anzeige falsch; ruft die Kette eines, ist die Vertraulichkeitszusage gebrochen. Beides ist rot.
//
// WAS DIESER TEST NICHT BEWEIST (benannte Grenze, ausfuehrlich im Bericht): die Erzwingung ist
// maschinell erhoben, die BEDEUTUNG der Saetze nicht. Die Satzpruefung unten ist eine
// Zuschreibungsregel ueber Klammern (nennt der Satz Klaras Antwort? nennt er ein Modell? verneint
// er es?), keine Sprachverarbeitung. Ein bewusst gedrechselter Satz („… entsteht mit einem Modell,
// nicht ohne") kaeme durch. Gegen den Fehler, der hier wirklich passiert ist — eine schlichte
// positive Modellbehauptung —, schlaegt sie an.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReasonerStatus } from "../../apps/web/src/api/types";
import {
  type AskFetchFn,
  type AskFetchInit,
  KLARA_AI_TASK,
  type KlaraAiPhase,
  klaraAiLage,
  performAsk,
} from "../../apps/web/src/lib/wordAddin";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

// ================================================================================================
// JOB 1175 · D1 — DER MODELLSPION SITZT AM CHOKEPOINT, NICHT AUF `reasoner.answer`.
// ================================================================================================
//
// WAS VORHER SCHIEFGING (G26 Punkt 2): Der Spion ersetzte `services.reasoner.answer` — eine Methode,
// die dieser Test selbst einsetzt. Er belegte damit, dass DIESER EINE Weg kein Modell ruft, nicht
// dass KEIN Weg eines ruft. Ein Aufruf am Reasoner vorbei lief daran vorbei; gemessen in JOB 1175
// D1, bevor diese Zeilen entstanden: ein direkter `cappedModelClient(...).complete(...)` liess alle
// vier Faelle gruen.
//
// WO DER CHOKEPOINT LIEGT, sagt das Haus selbst — ich habe die Definition uebernommen und keine
// zweite erfunden: `tests/security/egress-chokepoint.test.ts:43` fuehrt genau zwei Dateien als
// erlaubte Egress-Stellen, und `:41-42` nennt ihren Pflicht-Wrapper:
//
//     services/reasoner/src/model-client.ts   →  cappedModelClient
//     services/media/src/transcriber.ts       →  cappedTranscriber
//
// `cappedModelClient` ist in `services/reasoner/src/model-concurrency.ts:163` definiert und
// umschliesst `complete` UND `completeVision` (`:174`, `:182`). JEDER Modellaufruf des App-Graphen
// passiert ihn — deshalb sitzt der Spion hier und nicht eine Ebene davor.
//
// GRENZE, ausdruecklich: Dieser Spion deckt den MODELL-Chokepoint. Der zweite Eintrag der Allowlist
// (`cappedTranscriber`, Audio) ist NICHT ueberwacht — Klaras Antwortweg beruehrt ihn nicht, und ihn
// mitzunehmen waere eine Zusage, die dieser Test nicht misst.
const modellSpy = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../../services/reasoner/src/model-concurrency", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../services/reasoner/src/model-concurrency")>();
  return {
    ...original,
    cappedModelClient: (
      inner: Parameters<typeof original.cappedModelClient>[0],
      opts: Parameters<typeof original.cappedModelClient>[1],
    ) => {
      const capped = original.cappedModelClient(inner, opts);
      const vision = capped.completeVision?.bind(capped);
      return {
        ...capped,
        complete: (...args: Parameters<typeof capped.complete>) => {
          modellSpy.calls += 1;
          return capped.complete(...args);
        },
        // Der Bildweg laeuft durch DENSELBEN Chokepoint (model-concurrency.ts:180-182) — ein Spion,
        // der ihn auslaesst, haette genau die Luecke, die dieser Auftrag schliesst.
        ...(vision
          ? {
              completeVision: (...args: Parameters<NonNullable<typeof capped.completeVision>>) => {
                modellSpy.calls += 1;
                return vision(...args);
              },
            }
          : {}),
      };
    },
  };
});

// Der Embedder-Spy wrappt das Modul — jeder embed()-Aufruf im App-Graph zaehlt. Bauform uebernommen
// aus tests/app/word-ask-retrieval-only.test.ts (dort seit WP-KLARA-ASK-FIX in Gebrauch).
const embedSpy = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../../services/embedding", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../services/embedding")>();
  return {
    ...original,
    createEmbeddingProviderFromEnv: (env: Record<string, string | undefined>) => {
      const provider = original.createEmbeddingProviderFromEnv(env);
      if (!provider) {
        return provider;
      }
      return {
        ...provider,
        embed: async (texts: readonly string[]) => {
          embedSpy.calls += 1;
          return provider.embed(texts);
        },
      };
    },
  };
});

// ================================================================================================
// GLIED 1 + 2 — der Modus wird aus dem AUSGEFUEHRTEN Client gelesen.
// ================================================================================================

/** Ein `fetch`, das sofort mit einer leeren Antwort erfuellt und den gesendeten Rumpf festhaelt. */
function rumpfFaenger(): { fetchFn: AskFetchFn; rumpf: () => unknown } {
  let roh: string | undefined;
  const fetchFn: AskFetchFn = (_url, init: AskFetchInit) => {
    roh = init.body;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: null }),
    });
  };
  return {
    fetchFn,
    rumpf: () => {
      expect(roh, "Der Client hat gar keinen Rumpf abgesetzt").toBeTypeOf("string");
      return JSON.parse(roh ?? "null");
    },
  };
}

async function modusAusModul(): Promise<unknown> {
  const { fetchFn, rumpf } = rumpfFaenger();
  await performAsk("Ventil Wartung Druck entlasten", "de", fetchFn, 1000);
  return (rumpf() as { mode?: unknown }).mode;
}

// Das WIRKLICH ausgelieferte Aufgabenfenster: kein Quelltext-Pin, sondern Schnitt + Ausfuehrung.
const B_START = "// KW-KLARA-ASK-FETCH-START";
const B_END = "// KW-KLARA-ASK-FETCH-END";

async function modusAusAufgabenfenster(): Promise<unknown> {
  const start = HTML.indexOf(B_START);
  const end = HTML.indexOf(B_END);
  expect(
    start,
    `${TASKPANE}: ${B_START} fehlt — der Frage-Abruf ist nicht auffindbar`,
  ).toBeGreaterThan(0);
  expect(end, `${TASKPANE}: ${B_END} fehlt`).toBeGreaterThan(start);
  const block = HTML.slice(start, end);

  const { fetchFn, rumpf } = rumpfFaenger();
  const umgebung = {
    // Die beiden Helfer, die `performAsk` im Aufgabenfenster ruft — als No-ops, denn geprueft wird
    // hier ausschliesslich, WAS abgesetzt wird.
    stripAskAnswerMarkdown: (a: string) => a,
    askGradeOf: () => "unverified",
    setTimeout: () => 1,
    clearTimeout: () => undefined,
    AbortController,
  };
  const factory = new Function("umgebung", `with (umgebung) { ${block} return performAsk; }`);
  const fn = factory(umgebung) as (
    q: string,
    l: string,
    f: AskFetchFn,
    t: number,
  ) => Promise<unknown>;
  await fn("Ventil Wartung Druck entlasten", "de", fetchFn, 1000);
  return (rumpf() as { mode?: unknown }).mode;
}

// ================================================================================================
// GLIED 3 + 4 + 5 — der erhobene Rumpf geht durch die ECHTE Route; Modell und Embedder werden
// beobachtet, nicht behauptet.
// ================================================================================================

const VALIDIERTE_AUSSAGE = "Ventil vor der Wartung entlasten und den Druck pruefen.";
type ReasonerAnswer = AppServices["reasoner"]["answer"];

async function ketteApp() {
  const services = buildServices();
  // Der Spy sitzt auf der Synthese-Flaeche der GETEILTEN Reasoner-Instanz — AskService haelt genau
  // dieses Objekt. Er zaehlt jeden Modellweg-Aufruf und liefert eine erkennbare Kunst-Antwort.
  let modellAufrufe = 0;
  const spyAnswer: ReasonerAnswer = async (_question, context) => {
    modellAufrufe += 1;
    return {
      answered: true,
      answer: "SYNTHESE-ANTWORT (Modellpfad)",
      knowledgeClass: "gesichert",
      trust: 50,
      sources: context.map((c) => c.id),
      citedSources: context.map((c) => c.id),
      steps: [],
      demo: false,
    };
  };
  Object.assign(services.reasoner, { answer: spyAnswer });
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "p@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "p@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Ventil entlasten vor Wartung",
      statement: VALIDIERTE_AUSSAGE,
      type: "best_practice",
      category: "Wartung",
    },
  });
  const koId = (angelegt.json() as { id: string }).id;
  await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: { action: "admin-validate" },
  });
  // Hintergrund-Pruefjobs zu Ende laufen lassen, DANN die Spys nullen — gemessen wird nur der Ask.
  await services.aiCheckWorker?.idle();
  embedSpy.calls = 0;
  modellSpy.calls = 0;
  return { app, headers, koId, modellAufrufe: () => modellAufrufe };
}

interface Kettenbefund {
  modus: unknown;
  geantwortet: boolean;
  woertlich: boolean;
  modellAufrufe: number;
  // JOB 1175: die Zahl am CHOKEPOINT — sie faengt auch, was `reasoner.answer` nie sieht.
  chokepointAufrufe: number;
  embedderAufrufe: number;
  gegenlaufModellAufrufe: number;
}

async function erhebeKette(): Promise<Kettenbefund> {
  const ausModul = await modusAusModul();
  const ausFenster = await modusAusAufgabenfenster();
  expect(
    ausFenster,
    "Aufgabenfenster und Modul setzen verschiedene Modi ab — dann ist unklar, was ausgeliefert wird",
  ).toEqual(ausModul);

  const { app, headers, koId, modellAufrufe } = await ketteApp();
  const res = await app.inject({
    method: "POST",
    url: "/api/ask",
    headers,
    // Der Modus kommt aus dem ausgefuehrten Client — nicht aus diesem Test.
    payload: { question: "Ventil Wartung Druck entlasten", mode: ausModul },
  });
  expect(
    res.statusCode,
    "Der vom Client abgesetzte Modus wird von der Route nicht angenommen",
  ).toBe(200);
  const body = res.json() as {
    result: { answered: boolean; answer: string | null; sources: string[] };
  };
  const nachAsk = modellAufrufe();
  const embedderNachAsk = embedSpy.calls;
  const chokepointNachAsk = modellSpy.calls;

  // GEGENLAUF: dieselbe Frage OHNE `mode`. Er beweist, dass der Modell-Spy an einer echten Flaeche
  // sitzt — ohne ihn waere „0 Aufrufe" nicht von „nie hingeschaut" zu unterscheiden.
  const gegenlauf = await app.inject({
    method: "POST",
    url: "/api/ask",
    headers,
    payload: { question: "Ventil Wartung Druck entlasten" },
  });
  expect(gegenlauf.statusCode).toBe(200);

  return {
    modus: ausModul,
    geantwortet: body.result.answered === true && body.result.sources.includes(koId),
    woertlich: body.result.answer === VALIDIERTE_AUSSAGE,
    modellAufrufe: nachAsk,
    chokepointAufrufe: chokepointNachAsk,
    embedderAufrufe: embedderNachAsk,
    gegenlaufModellAufrufe: modellAufrufe() - nachAsk,
  };
}

/** Die eine Ableitung, auf der alles Weitere steht — aus BEOBACHTUNG, nicht aus Annahme. */
function ketteErzwingtOhneModell(k: Kettenbefund): boolean {
  return (
    k.modellAufrufe === 0 &&
    // JOB 1175: die eigentliche Zusage. `modellAufrufe` deckt nur den Reasoner-Weg; erst diese
    // Null sagt „im ganzen App-Graphen ist kein Modellaufruf durch den Chokepoint gegangen".
    k.chokepointAufrufe === 0 &&
    k.embedderAufrufe === 0 &&
    k.geantwortet &&
    k.woertlich &&
    // Ohne greifenden Spy ist die Null wertlos.
    k.gegenlaufModellAufrufe > 0
  );
}

// ================================================================================================
// DIE SICHTBAREN SAETZE — je Zustand, je Sprache, gesammelt statt aufgezaehlt.
// ================================================================================================

function woerterbuch(sprache: Sprache): string {
  const start = HTML.indexOf(`      ${sprache}: {`);
  expect(start, `${TASKPANE}: Woerterbuch ${sprache} nicht gefunden`).toBeGreaterThan(0);
  const ende = HTML.indexOf("\n      },", start);
  expect(ende, `${TASKPANE}: Ende des Woerterbuchs ${sprache} nicht gefunden`).toBeGreaterThan(
    start,
  );
  return HTML.slice(start, ende);
}

function text(sprache: Sprache, key: string): string {
  const treffer = new RegExp(`^\\s*${key}:\\s*"([^"]*)"`, "m").exec(woerterbuch(sprache));
  expect(treffer, `${sprache}.${key} fehlt`).not.toBeNull();
  const wert = treffer?.[1] ?? "";
  expect(wert.trim().length, `${sprache}.${key} ist leer`).toBeGreaterThan(0);
  return wert;
}

// Der Zustandsraum des Vertrags — dieselbe Bauform wie mega75: durchlaufen, nicht aufgelistet.
function alleLagen(): Set<string> {
  const modi: ReasonerStatus["mode"][] = ["cloud", "local", "deterministic"];
  const erreichbar: (ReasonerStatus["reachable"] | undefined)[] = [
    "none",
    "unverified",
    "active",
    "unreachable",
    undefined,
  ];
  const karten: (Record<string, boolean> | undefined)[] = [
    undefined,
    {},
    { [KLARA_AI_TASK]: true },
    { [KLARA_AI_TASK]: false },
  ];
  const gesehen = new Set<string>();
  for (const phase of ["laedt", "da", "unerreichbar"] as KlaraAiPhase[]) {
    gesehen.add(klaraAiLage(phase, undefined));
    for (const mode of modi) {
      for (const r of erreichbar) {
        for (const active of [true, false]) {
          for (const karte of karten) {
            const status: ReasonerStatus = { active, mode };
            if (r) {
              status.reachable = r;
            }
            if (karte) {
              status.tasks = karte;
            }
            gesehen.add(klaraAiLage(phase, status));
          }
        }
      }
    }
  }
  return gesehen;
}

/** Satzweise, damit eine Zuschreibung an ihrem eigenen Satz gemessen wird und nicht am Absatz. */
function saetze(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const KLARA_BEZUG: Record<Sprache, RegExp> = {
  de: /Klaras Antwort/i,
  en: /Klara's answer/i,
  nl: /Klara's antwoord/i,
};

// „Arbeitet hier ein Modell?" — die Woerter, mit denen dieses Aufgabenfenster ueber Modelle spricht.
const MODELL_BEZUG =
  /\b(KI|AI)\b|\bmodell?\b|\bmodel\b|künstliche[rn]?\s+Intelligenz|artificial\s+intelligence|kunstmatige\s+intelligentie/i;

// Verneinung/Ausschluss im SELBEN Satz.
const VERNEINUNG =
  /\b(ohne|kein|keine|keinen|keinem|keiner|nicht|nie|niemals|without|no|not|never|zonder|geen|niet|nooit)\b/i;

function behauptetModellFuerKlara(sprache: Sprache, satz: string): boolean {
  return KLARA_BEZUG[sprache].test(satz) && MODELL_BEZUG.test(satz) && !VERNEINUNG.test(satz);
}

function schliesstModellFuerKlaraAus(sprache: Sprache, satz: string): boolean {
  return KLARA_BEZUG[sprache].test(satz) && MODELL_BEZUG.test(satz) && VERNEINUNG.test(satz);
}

// ================================================================================================
describe("AUFTRAG-mega79: die Anzeige haengt am tatsaechlichen Antwortweg", () => {
  const gemerktePrefilter = process.env.KLARWERK_DUP_PREFILTER;

  beforeEach(() => {
    process.env.KLARWERK_DUP_PREFILTER = "1"; // der Embedder-Chokepoint existiert real im Graph
    embedSpy.calls = 0;
  });

  afterEach(() => {
    if (gemerktePrefilter === undefined) {
      delete process.env.KLARWERK_DUP_PREFILTER;
    } else {
      process.env.KLARWERK_DUP_PREFILTER = gemerktePrefilter;
    }
  });

  it("die Kette wird ERHOBEN: Client, Aufgabenfenster, Route, Dienst, Reasoner — kein Modell, kein Embedder", async () => {
    const k = await erhebeKette();
    expect(k.modus, "Der Client setzt keinen Modus ab").toBeTypeOf("string");
    expect(k.geantwortet, "Ohne beantwortete Frage ist die Messung wertlos").toBe(true);
    expect(k.woertlich, "Keine Synthese: die Antwort ist die WOERTLICHE validierte Aussage").toBe(
      true,
    );
    expect(k.modellAufrufe, "Auf Klaras Antwortweg wurde ein Modell gerufen").toBe(0);
    expect(
      k.chokepointAufrufe,
      "Am Chokepoint (cappedModelClient) wurde ein Modellaufruf gezaehlt — irgendein Weg im " +
        "App-Graphen hat ein Modell gerufen, nicht nur der Reasoner-Weg",
    ).toBe(0);
    expect(k.embedderAufrufe, "Auf Klaras Antwortweg wurde ein Embedder gerufen").toBe(0);
    expect(
      k.gegenlaufModellAufrufe,
      "Der Modell-Spy greift nicht — dann waere die Null oben blind",
    ).toBeGreaterThan(0);
  }, 30000);

  // ==============================================================================================
  // JOB 1175 · DIE ZWEI POSITIVEN KALIBRIERZELLEN
  // ==============================================================================================
  //
  // KEIN ROTER ERSTLAUF — und das ist hier richtig so, statt einen zu behaupten: Diese beiden Faelle
  // pruefen nicht das Produkt, sondern das MESSWERKZEUG. Ein Spion, der greift, greift ab der ersten
  // Sekunde; ein roter Erstlauf waere nur zu erzeugen, indem man den Spion vorher kaputt macht.
  //
  // WARUM SIE TROTZDEM DER WICHTIGERE TEIL SIND: Jeder gruene Negativfall oben steht auf einer Null.
  // Eine Null aus einem Zaehler, der nie hochgezaehlt hat, ist von einer Null aus Blindheit nicht zu
  // unterscheiden. Der Embedder-Zaehler stand seit mega79 genau so da — er hat in keinem einzigen
  // Fall je einen Aufruf gesehen.
  //
  // IHRE GEGENPROBE ist der Spion selbst: legt man ihn stumm (die Zaehlzeile entfernen), werden
  // GENAU diese beiden Faelle rot und kein anderer.

  it("KALIBRIERUNG MODELL: der Chokepoint-Spion zaehlt einen echten Modellaufruf", async () => {
    const { cappedModelClient } = await import("../../services/reasoner/src/model-concurrency");
    modellSpy.calls = 0;

    // Ein echter Aufruf durch DEN Wrapper, den `egress-chokepoint.test.ts:41-43` als Pflichtweg
    // fuehrt. Kein Netz, kein Schluessel: der innere Client ist ein Doppel — gemessen wird, dass der
    // SPION den Durchgang bemerkt, nicht was ein Anbieter antwortet.
    const antwort = await cappedModelClient(
      { name: "kalibrierung", complete: async () => "ECHTE MODELLANTWORT" },
      { rejectsConfidential: false },
    ).complete("system", "user", false);

    expect(antwort, "der gewrappte Client muss die Antwort durchreichen").toBe(
      "ECHTE MODELLANTWORT",
    );
    expect(
      modellSpy.calls,
      "Der Chokepoint-Spion hat einen echten Modellaufruf NICHT bemerkt — dann ist jede Null " +
        "oben wertlos",
    ).toBe(1);
  });

  it("KALIBRIERUNG EMBEDDER: der Embedder-Spion zaehlt einen echten embed()-Aufruf", async () => {
    const { createEmbeddingProviderFromEnv } = await import("../../services/embedding");
    embedSpy.calls = 0;

    // Der Vorgabemodus des Moduls ist `stub` (services/embedding/src/provider.ts:113-116) — ein
    // echter Provider mit echtem `embed()`, ohne Netz und ohne Schluessel. Genau der Weg, den der
    // Spion bei `:57-75` wrappt.
    const provider = createEmbeddingProviderFromEnv({});
    expect(provider, "ohne Provider gibt es nichts zu kalibrieren").toBeDefined();

    const ergebnis = await provider?.embed(["Ventil vor der Wartung entlasten"]);
    expect(ergebnis?.vectors.length, "der Provider muss einen Vektor liefern").toBe(1);
    expect(
      embedSpy.calls,
      "Der Embedder-Spion hat einen echten embed()-Aufruf NICHT bemerkt — genau die Luecke aus " +
        "G26 Punkt 2: ein Zaehler ohne positiven Beleg ist von einem kaputten nicht zu unterscheiden",
    ).toBe(1);
  });

  it("kein sichtbarer Zustand behauptet ein Modell fuer Klaras Antwort — in keiner Sprache", async () => {
    const k = await erhebeKette();
    // Die Kopplung: SOLANGE die Kette kein Modell ruft, darf kein Satz eines behaupten.
    expect(
      ketteErzwingtOhneModell(k),
      "Klaras Antwort erreicht ein Modell oder einen Embedder — dann ist nicht die Anzeige " +
        "falsch, sondern die Vertraulichkeitszusage. Das gehoert nach oben in den Bericht, " +
        "nicht in eine Textkorrektur.",
    ).toBe(true);

    const lagen = alleLagen();
    expect(lagen.size, "Kein einziger Anzeige-Zustand gesammelt — der Test waere blind").toBe(5);

    const verstoesse: string[] = [];
    for (const lage of lagen) {
      const key = `aiLage${lage.charAt(0).toUpperCase()}${lage.slice(1)}`;
      for (const sprache of SPRACHEN) {
        for (const satz of saetze(text(sprache, key))) {
          if (behauptetModellFuerKlara(sprache, satz)) {
            verstoesse.push(`${sprache}.${key}: „${satz}"`);
          }
        }
      }
    }
    expect(
      verstoesse.join("\n"),
      "Diese Saetze behaupten ein Modell fuer Klaras Antwort, obwohl die ausgefuehrte Kette keines ruft",
    ).toBe("");
  }, 30000);

  it("jeder Zustand SAGT den Ausschluss — auch „laedt“ und „nicht erreichbar“", async () => {
    const k = await erhebeKette();
    expect(ketteErzwingtOhneModell(k)).toBe(true);

    // Ein Zustand, der zu Klaras Antwort schweigt, laesst die Leserin die Hausstands-Aussage
    // darueber auf Klara beziehen — genau der Kurzschluss, aus dem der falsche Satz entstand.
    // Und „laedt"/„nicht erreichbar" betreffen NUR den Statusabruf: der Antwortweg ist auch ohne
    // jeden Abruf bekannt und muss deshalb auch dort dastehen.
    const stumm: string[] = [];
    for (const lage of alleLagen()) {
      const key = `aiLage${lage.charAt(0).toUpperCase()}${lage.slice(1)}`;
      for (const sprache of SPRACHEN) {
        if (!saetze(text(sprache, key)).some((s) => schliesstModellFuerKlaraAus(sprache, s))) {
          stumm.push(`${sprache}.${key}`);
        }
      }
    }
    expect(
      stumm.join("\n"),
      "Diese Zustaende sagen nicht, dass Klaras Antwort ohne Modell entsteht",
    ).toBe("");
  }, 30000);

  it("auch ausserhalb der Zustandssaetze behauptet kein Woerterbuch-Text ein Modell fuer Klaras Antwort", async () => {
    const k = await erhebeKette();
    expect(ketteErzwingtOhneModell(k)).toBe(true);

    // Gegen den Umzug: ein Satz, der die Behauptung aus `aiLage*` in einen anderen Schluessel
    // traegt, waere sonst unsichtbar. Geprueft wird das GANZE Woerterbuch je Sprache.
    const verstoesse: string[] = [];
    for (const sprache of SPRACHEN) {
      const dict = woerterbuch(sprache);
      const zeilen = /^\s*([A-Za-z0-9_]+):\s*"([^"]*)"/gm;
      let treffer = zeilen.exec(dict);
      let gezaehlt = 0;
      while (treffer) {
        gezaehlt += 1;
        for (const satz of saetze(treffer[2] ?? "")) {
          if (behauptetModellFuerKlara(sprache, satz)) {
            verstoesse.push(`${sprache}.${treffer[1]}: „${satz}"`);
          }
        }
        treffer = zeilen.exec(dict);
      }
      // Fail-closed: ein Woerterbuch, aus dem nichts gelesen wurde, waere ein gruener Nichtlauf.
      expect(gezaehlt, `${sprache}: kein einziger Text gelesen`).toBeGreaterThan(50);
    }
    expect(verstoesse.join("\n")).toBe("");
  }, 30000);
});
