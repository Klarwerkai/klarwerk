// @vitest-environment jsdom
// ================================================================================================
// JOB 3019 — KA5 IM PANEL: DIE MARKIERUNG REIST ALS EIGENES FELD, STATT DIE FRAGE ZU VERDRAENGEN.
// ================================================================================================
//
// WARUM DIESE DATEI EXISTIERT. Der Serververtrag von KA5 steht seit JOB 3006 vollstaendig
// (`services/app/src/routes/ask-routes.ts` liest `selection`, `services/ask/src/service.ts`
// erweitert damit AUSSCHLIESSLICH die Suchterme der Vorauswahl) — und hatte keinen Aufrufer. Der
// einzige Client, der ueberhaupt eine Markierung hat, schickte sie nie: `prepareAskQuestion` liess
// die Markierung GEGEN den getippten Text gewinnen und warf die getippte Frage weg.
//
// GEMESSEN WIRD DER ABGESENDETE KOERPER, nicht der Quelltext. Ein `expect(html).toContain(...)`
// haette denselben Satz auch dann bestaetigt, wenn `askKlara` die Markierung gar nicht
// durchreicht. Deshalb: das AUSGELIEFERTE Fenster in jsdom laden (`splitTaskpane` der
// Klara-Panel-Fixture — kein zweiter Quelltext, keine Kopie), eine Office-Attrappe mit STEUERBARER
// `getSelectedDataAsync`, ein injizierter `fetch`, der jeden Koerper mitschreibt.
//
// WARUM EINE EIGENE OFFICE-ATTRAPPE UND NICHT `createKlaraPanel`. Die Fixture beantwortet
// `getSelectedDataAsync` fuer `CoercionType.Text` IMMER mit `""`
// (`tests/app/klara-panel-fixture.ts:153-162`) — genau die Groesse, die dieser Auftrag variiert,
// ist ueber sie nicht stellbar. Die Attrappe hier ist die aus
// `tests/klara-panel/p7-office-erkennung-am-fenster.test.tsx`, um eine setzbare Textmarkierung
// erweitert; die Fixture bleibt unveraendert.
//
// DIE KALIBRIERUNG IST TEIL DER MESSUNG (Abschnitt unten): jeder der vier Faelle wird einmal mit
// einem VERFAELSCHTEN Skript gefahren und MUSS dabei ein anderes Ergebnis liefern. Ein Fall, der
// eine Gegenaenderung nicht bemerkt, misst nichts. Verfaelscht wird nur der Skripttext im Speicher
// dieses Laufs — `taskpane.html` bleibt unangetastet.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { splitTaskpane } from "../app/klara-panel-fixture";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");
const { markup: MARKUP, script: SKRIPT } = splitTaskpane(HTML);

/** Die Fixtures aus dem Auftrag — woertlich, damit rot/gruen an denselben Worten haengt. */
const MARKIERUNG = "Rückstellung Gewährleistung";
const FRAGE = "Wie lange läuft die Frist?";

/** Der Deckel — GELESEN aus dem Aufgabenfenster, nicht hier abgeschrieben. */
const ASK_MAX = (() => {
  const treffer = /var WORD_ADDIN_ASK_MAX_CHARS = (\d+);/.exec(HTML);
  if (treffer === null) {
    throw new Error(`${TASKPANE}: WORD_ADDIN_ASK_MAX_CHARS ist nicht auffindbar`);
  }
  return Number(treffer[1]);
})();

// ---- Der Serverstand ---------------------------------------------------------------------------

interface Antwort {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

function gut(koerper: unknown): Antwort {
  return { ok: true, status: 200, json: () => Promise.resolve(koerper) };
}

function absage(status: number): Antwort {
  return { ok: false, status, json: () => Promise.resolve({}) };
}

/** Jeder Abruf des Fensters, in Reihenfolge — die Grundlage jeder Aussage dieser Datei. */
interface Abruf {
  url: string;
  koerper: unknown;
}

let abrufe: Abruf[] = [];

/**
 * Die Klara-Sitzungsrouten antworten mit 503: diese Datei misst den Ask-Koerper, nicht die
 * Sitzungssicht. Ohne Sitzung sind die Bindungskopfzeilen leer und der Ausfuehrungsriegel
 * (`klaraS4FragenGesperrt`) laesst die Frage durch — genau der Zustand, in dem heute gefragt wird.
 */
function bedienen(url: string): Antwort {
  if (url === "/api/auth/me") {
    return gut({ id: "u1", name: "Prueferin" });
  }
  if (url === "/api/reasoner/status") {
    return gut({ enabled: false, reachable: "none" });
  }
  if (url === "/api/ask") {
    return gut({ result: { answered: false, answer: null, sources: [], trust: 0 } });
  }
  if (url.startsWith("/api/klara/")) {
    return absage(503);
  }
  return absage(404);
}

/** Der Ask-Koerper des letzten `POST /api/ask` — oder ein Testfehler, wenn keiner abging. */
function askKoerper(): Record<string, unknown> {
  const ask = abrufe.filter((a) => a.url === "/api/ask");
  expect(ask.length, "kein POST /api/ask abgesetzt").toBe(1);
  return ask[0]?.koerper as Record<string, unknown>;
}

// ---- Die Office-Attrappe ------------------------------------------------------------------------

const EREIGNISSE = { DocumentSelectionChanged: "documentSelectionChanged" } as const;
const COERCION = { Text: "text", Html: "html" } as const;
const ASYNC_STATUS = { Succeeded: "succeeded", Failed: "failed" } as const;

/** Was Word als TEXT der Markierung liefert — die Groesse, die diese Datei variiert. */
let markierungImDokument = "";

function officeStellen(): void {
  (window as unknown as { Office?: unknown }).Office = {
    EventType: EREIGNISSE,
    CoercionType: COERCION,
    AsyncResultStatus: ASYNC_STATUS,
    onReady: (cb: () => void): void => cb(),
    context: {
      document: {
        url: "",
        addHandlerAsync(_typ: string, _fn: () => void): void {
          /* das Fenster meldet sich an; fuer diese Messung genuegt, dass es geht */
        },
        getSelectedDataAsync(
          typ: string,
          fn: (r: { status: string; value: string }) => void,
        ): void {
          fn({
            status: ASYNC_STATUS.Succeeded,
            value: typ === COERCION.Text ? markierungImDokument : "",
          });
        },
      },
    },
  };
}

// ---- Laden und Messen ---------------------------------------------------------------------------

const zuhoerer: Array<{ ziel: EventTarget; typ: string; fn: EventListenerOrEventListenerObject }> =
  [];

/**
 * jsdom teilt EIN `window` ueber alle Faelle einer Datei. Ohne Abmelden reagierten im letzten Fall
 * alle zuvor geladenen Fensterinstanzen gleichzeitig — ein Messfehler des Pruefstands.
 */
function zuhoererMitschreiben(ziel: EventTarget): void {
  const original = ziel.addEventListener.bind(ziel);
  (ziel as unknown as { addEventListener: typeof original }).addEventListener = (
    typ: string,
    fn: EventListenerOrEventListenerObject,
    opts?: boolean | AddEventListenerOptions,
  ) => {
    zuhoerer.push({ ziel, typ, fn });
    original(typ, fn, opts);
  };
}

/**
 * Eine Verfaelschung des ausgelieferten Skripts — NUR im Speicher dieses Laufs. Sie schlaegt fehl,
 * wenn die Fundstelle nicht genau einmal vorkommt: eine ins Leere laufende Ersetzung taeuschte
 * eine Gegenprobe vor, die gar nichts verfaelscht hat.
 */
function verfaelschen(skript: string, suche: string, ersatz: string): string {
  const teile = skript.split(suche);
  expect(teile.length, `Fundstelle nicht genau einmal vorhanden: ${suche}`).toBe(2);
  return teile.join(ersatz);
}

type Sprache = "de" | "en" | "nl";

/**
 * Der Wortlaut eines Schluessels — GELESEN aus dem ausgelieferten Woerterbuch, nie abgeschrieben.
 * `{max}` wird wie im Panel ersetzt. Waere der Satz hier notiert, pruefte diese Datei ihre eigene
 * Annahme statt den ausgelieferten Text.
 */
function wortlautRoh(sprache: Sprache, key: string): string {
  const von = HTML.indexOf(`      ${sprache}: {`);
  expect(von, `${TASKPANE}: Sprachblock ${sprache} nicht gefunden`).toBeGreaterThan(0);
  const treffer = new RegExp(`^\\s*${key}: "([^"]*)"`, "m").exec(HTML.slice(von));
  expect(treffer, `${TASKPANE}: ${key} fehlt im Block ${sprache}`).not.toBeNull();
  const wert = treffer?.[1] ?? "";
  expect(wert.length, `${TASKPANE}: ${key} [${sprache}] ist leer`).toBeGreaterThan(0);
  return wert;
}

function wortlaut(sprache: Sprache, key: string): string {
  return wortlautRoh(sprache, key).replaceAll("{max}", String(ASK_MAX));
}

interface Lage {
  /** Was Word als Markierung meldet. */
  markierung: string;
  /** Was die Anwenderin ins Feld getippt hat. */
  eingabe: string;
  /** In welcher Sprache das Fenster steht (Standard: de). */
  sprache?: Sprache;
  /** Verfaelscht das Skript vor dem Ausfuehren (Kalibrierung). */
  mutieren?: (skript: string) => string;
}

interface Panel {
  /** Der Text der Zeile ueber dem Eingabefeld — das, was ein Mensch dort liest. */
  herkunftszeile: string;
  /** Der Text der Statuszeile NACH der Antwort — die zweite Stelle, die ueber Deckel spricht. */
  statuszeile: string;
}

async function leerlauf(runden = 12): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    await Promise.resolve();
    await new Promise((weiter) => process.nextTick(weiter));
  }
}

function el(id: string): HTMLElement {
  const gefunden = document.getElementById(id);
  expect(gefunden, `#${id} fehlt im Aufgabenfenster`).not.toBeNull();
  return gefunden as HTMLElement;
}

/** Fenster laden, Markierung und Eingabe stellen, „Klara fragen" druecken, alles abwarten. */
async function fragen(lage: Lage): Promise<Panel> {
  expect(MARKUP.length, `${TASKPANE}: Markup ist leer`).toBeGreaterThan(2000);
  markierungImDokument = lage.markierung;
  document.body.innerHTML = MARKUP;
  officeStellen();
  zuhoererMitschreiben(window);
  zuhoererMitschreiben(document);
  new Function(lage.mutieren ? lage.mutieren(SKRIPT) : SKRIPT)();
  await leerlauf();

  if (lage.sprache !== undefined && lage.sprache !== "de") {
    // Derselbe Weg wie ein Mensch: der Sprachknopf im Kopf. `setLang` zeichnet die Herkunftszeile
    // nicht neu — das tut erst das naechste Tippen, und genau so laeuft es unten.
    (el(`lang-${lage.sprache}`) as HTMLButtonElement).click();
    await leerlauf();
  }

  const feld = el("ask-input") as HTMLTextAreaElement;
  feld.value = lage.eingabe;
  // Derselbe Weg, den ein Mensch nimmt: tippen loest die Herkunftszeile aus, der Klick den Ask.
  feld.dispatchEvent(new window.Event("input", { bubbles: true }));
  await leerlauf();
  const herkunftszeile = el("ask-source-note").textContent ?? "";

  (el("ask-btn") as HTMLButtonElement).click();
  await leerlauf();
  return { herkunftszeile, statuszeile: el("ask-status").textContent ?? "" };
}

beforeEach(() => {
  abrufe = [];
  markierungImDokument = "";
  zuhoerer.length = 0;
  vi.stubGlobal("fetch", (url: string, init?: { body?: string }) => {
    let koerper: unknown;
    if (typeof init?.body === "string") {
      try {
        koerper = JSON.parse(init.body);
      } catch {
        koerper = init.body;
      }
    }
    abrufe.push({ url, koerper });
    return Promise.resolve(bedienen(url) as unknown as Response);
  });
});

afterEach(() => {
  for (const z of zuhoerer) {
    z.ziel.removeEventListener(z.typ, z.fn);
  }
  zuhoerer.length = 0;
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  (window as unknown as { Office?: unknown }).Office = undefined;
  (window as unknown as { klaraBestandsblick?: unknown }).klaraBestandsblick = undefined;
});

// ================================================================================================
// FALL A — Markierung UND getippte Frage: die Frage wird gestellt, die Markierung reist mit
// ================================================================================================
describe("JOB 3019 · Fall A — die getippte Frage gewinnt, die Markierung schaerft die Suche", () => {
  it("`body.question` ist die getippte Frage, `body.selection` die Markierung", async () => {
    // VORHER ROT: `question` trug die Markierung, `selection` fehlte im Koerper ganz
    // (`prepareAskQuestion` liess `from = "selection"` gewinnen und warf den getippten Text weg).
    await fragen({ markierung: MARKIERUNG, eingabe: FRAGE });

    expect(askKoerper()).toEqual({
      question: FRAGE,
      locale: "de",
      mode: "retrieval-only",
      selection: MARKIERUNG,
    });
  });

  it("die Markierung wird GETRIMMT und auf den Deckel gekappt — die Frage bleibt die Frage", async () => {
    const lang = `${"A".repeat(ASK_MAX + 500)} `;
    await fragen({ markierung: `   ${lang}`, eingabe: FRAGE });

    const koerper = askKoerper();
    expect(koerper.question).toBe(FRAGE);
    expect(String(koerper.selection)).toBe("A".repeat(ASK_MAX));
  });
});

// ================================================================================================
// FALL B — die Zeile ueber dem Eingabefeld sagt danach die Wahrheit
// ================================================================================================
describe("JOB 3019 · Fall B — die Herkunftszeile nennt beides und leugnet die Eingabe nicht mehr", () => {
  it("nennt Eingabe UND Markierung und behauptet nicht mehr, der Text unten gehe nicht mit", async () => {
    // VORHER ROT: hier stand `askSourceSelectionOverride` mit dem Satz „der Text unten wird dabei
    // NICHT gesendet." — nach dieser Aenderung ist er falsch.
    const panel = await fragen({ markierung: MARKIERUNG, eingabe: FRAGE });

    expect(panel.herkunftszeile).not.toContain("NICHT gesendet");
    expect(panel.herkunftszeile).not.toContain("Hebe die Markierung auf");
    // Sie nennt beide Teile: woher die Frage kommt und was die Markierung tut.
    expect(panel.herkunftszeile).toContain("Eingabe");
    expect(panel.herkunftszeile).toContain("Markierung");
    // Und sie ist keine leere Zeile, die zufaellig alle Verbote erfuellt.
    expect(panel.herkunftszeile.length).toBeGreaterThan(30);
  });

  it("die gekappte Markierung wird an derselben Zeile gemeldet, nicht verschwiegen", async () => {
    const panel = await fragen({ markierung: "B".repeat(ASK_MAX + 1), eingabe: FRAGE });
    expect(panel.herkunftszeile).toContain(String(ASK_MAX));
  });
});

// ================================================================================================
// FALL C — Markierung ohne Eingabe: die Regressionsklammer (Koerper wie heute)
// ================================================================================================
describe("JOB 3019 · Fall C — ohne getippten Text bleibt alles, wie es war", () => {
  it("`question` ist die Markierung, und ein `selection`-Feld gibt es NICHT", async () => {
    // Die Markierung IST hier schon die Frage. Sie ein zweites Mal als `selection` zu senden
    // verdoppelte dieselben Terme in `erweiterteSuchterme` (services/ask/src/service.ts:513-515).
    await fragen({ markierung: MARKIERUNG, eingabe: "" });

    const koerper = askKoerper();
    expect(koerper).toEqual({ question: MARKIERUNG, locale: "de", mode: "retrieval-only" });
    expect(Object.keys(koerper)).not.toContain("selection");
  });
});

// ================================================================================================
// FALL D — Eingabe ohne Markierung: die zweite Regressionsklammer
// ================================================================================================
describe("JOB 3019 · Fall D — ohne Markierung bleibt der Koerper Zeichen fuer Zeichen der heutige", () => {
  it("`question` ist die Eingabe, und ein `selection`-Feld gibt es NICHT", async () => {
    await fragen({ markierung: "", eingabe: FRAGE });

    const koerper = askKoerper();
    expect(koerper).toEqual({ question: FRAGE, locale: "de", mode: "retrieval-only" });
    expect(Object.keys(koerper)).not.toContain("selection");
  });

  it("eine rein weisse Markierung ist keine Markierung", async () => {
    await fragen({ markierung: "   \n\t ", eingabe: FRAGE });

    expect(askKoerper()).toEqual({ question: FRAGE, locale: "de", mode: "retrieval-only" });
  });
});

// ================================================================================================
// FALL T — DIE WAHRHEITSTABELLE DER ZWEI DECKEL (BENs Korrekturpflicht 1 aus Runde 1)
// ================================================================================================
//
// Zwei Felder, ein Deckel, ZWEI Merker: `truncated` (die Frage) und `selectionTruncated` (die
// Markierung). Runde 1 hatte nur drei der vier Lagen bedacht — in der vierten sagte die Zeile
// „deine Frage bleibt vollstaendig", obwohl die Frage selbst gekappt war. Hier stehen alle vier,
// gemessen am GERENDERTEN Text des laufenden Fensters.
const LANG = "L".repeat(ASK_MAX + 40);
const KURZ_FRAGE = "Wie lange laeuft die Frist?";
const KURZ_MARKE = "Kurze Markierung";

describe("JOB 3019 · Fall T — Frage-Deckel × Markierungs-Deckel, alle vier Kombinationen", () => {
  it("T1 · keiner gekappt: die Zeile spricht ueber keinen Deckel, die Statuszeile schweigt", async () => {
    const panel = await fragen({ markierung: KURZ_MARKE, eingabe: KURZ_FRAGE });

    expect(panel.herkunftszeile).toBe(wortlaut("de", "askSourceSelectionOverride"));
    expect(panel.statuszeile).toBe("");
  });

  it("T2 · nur die Markierung gekappt: die Zeile sagt, die Frage bleibe vollstaendig — und sie ist es", async () => {
    const panel = await fragen({ markierung: LANG, eingabe: KURZ_FRAGE });

    expect(panel.herkunftszeile).toBe(
      `${wortlaut("de", "askSourceSelectionOverride")} ${wortlaut("de", "askSelectionTruncated")}`,
    );
    // Die Zusage ist wahr: die Frage geht ungekappt hinaus.
    expect(askKoerper().question).toBe(KURZ_FRAGE);
    expect(panel.statuszeile).toBe("");
  });

  it("T3 · nur die Frage gekappt: der Satz spricht ueber die FRAGE, nicht ueber die Markierung", async () => {
    const panel = await fragen({ markierung: KURZ_MARKE, eingabe: LANG });

    expect(panel.herkunftszeile).toBe(
      `${wortlaut("de", "askSourceSelectionOverride")} ${wortlaut("de", "askTruncated")}`,
    );
    // Der alte Wortlaut behauptete hier „Die Markierung war laenger als 2000 Zeichen" — falsch:
    // gekappt wurde die getippte Frage, die Markierung ist kurz und vollstaendig.
    expect(panel.herkunftszeile).not.toContain("Markierung war");
    expect(String(askKoerper().selection)).toBe(KURZ_MARKE);
    expect(String(askKoerper().question).length).toBe(ASK_MAX);
    // Und dieselbe Aussage steht nach der Antwort in der Statuszeile — derselbe Schluessel.
    expect(panel.statuszeile).toBe(wortlaut("de", "askTruncated"));
  });

  it("T4 · BEIDE gekappt: kein Satz behauptet mehr, die Frage bleibe vollstaendig", async () => {
    const panel = await fragen({ markierung: LANG, eingabe: LANG });

    expect(panel.herkunftszeile).toBe(
      `${wortlaut("de", "askSourceSelectionOverride")} ${wortlaut("de", "askBothTruncated")}`,
    );
    // DER BEFUND AUS RUNDE 1, als Vertrag: die Vollstaendigkeitszusage darf hier NICHT stehen.
    expect(panel.herkunftszeile).not.toContain(wortlaut("de", "askSelectionTruncated"));
    expect(panel.herkunftszeile).not.toContain("bleibt vollständig");
    // Beide Felder sind wirklich gekappt — sonst pruefte der Fall eine Lage, die es nicht gibt.
    expect(String(askKoerper().question).length).toBe(ASK_MAX);
    expect(String(askKoerper().selection).length).toBe(ASK_MAX);
    expect(panel.statuszeile).toBe(wortlaut("de", "askTruncated"));
  });

  it("T5 · nur Markierung, ohne Eingabe, ueber dem Deckel: sie IST die Frage und wird so gemeldet", async () => {
    const panel = await fragen({ markierung: LANG, eingabe: "" });

    expect(panel.herkunftszeile).toBe(
      `${wortlaut("de", "askSourceSelection")} ${wortlaut("de", "askTruncated")}`,
    );
    // Kein `selection`-Feld: die Markierung ist hier die Frage, nicht ihr Suchzusatz.
    expect(Object.keys(askKoerper())).not.toContain("selection");
  });

  it("T0 · KEIN Platzhalter bleibt stehen: `t()` ersetzt {max} nur EINMAL je Satz", async () => {
    // GEFUNDEN VON DIESER DATEI, nicht behauptet: `t()` (taskpane.html:2683) ruft `String.replace`
    // mit einer Zeichenkette und ersetzt deshalb genau das ERSTE Vorkommen. Die erste Fassung der
    // beiden neuen Saetze nannte `{max}` zweimal — auf der Flaeche stand danach woertlich
    // „nur die ersten {max} Zeichen". Dieser Fall haelt die Regel fest, statt sie zu vergessen.
    for (const sprache of ["de", "en", "nl"] as const) {
      for (const key of ["askTruncated", "askSelectionTruncated", "askBothTruncated"]) {
        const roh = wortlautRoh(sprache, key);
        expect(roh.split("{max}").length - 1, `${sprache}/${key}: {max} nicht genau einmal`).toBe(
          1,
        );
      }
    }
    const panel = await fragen({ markierung: LANG, eingabe: LANG });
    expect(panel.herkunftszeile).not.toContain("{max}");
    expect(panel.statuszeile).not.toContain("{max}");
  });

  it("T6 · dieselbe Wahrheitstabelle in EN und NL — keine Sprache verspricht mehr als DE", async () => {
    for (const sprache of ["en", "nl"] as const) {
      // Die Lage „beides gekappt" ist die, in der Runde 1 falsch war.
      const beides = await fragen({ markierung: LANG, eingabe: LANG, sprache });
      expect(beides.herkunftszeile, `${sprache}/beides`).toBe(
        `${wortlaut(sprache, "askSourceSelectionOverride")} ${wortlaut(sprache, "askBothTruncated")}`,
      );
      expect(beides.herkunftszeile, `${sprache}/beides`).not.toContain(
        wortlaut(sprache, "askSelectionTruncated"),
      );

      abrufe = [];
      document.body.innerHTML = "";
      // Und die Lage, in der die Zusage stimmt, steht dort auch wirklich.
      const nurMarke = await fragen({ markierung: LANG, eingabe: KURZ_FRAGE, sprache });
      expect(nurMarke.herkunftszeile, `${sprache}/nur-markierung`).toBe(
        `${wortlaut(sprache, "askSourceSelectionOverride")} ${wortlaut(sprache, "askSelectionTruncated")}`,
      );

      abrufe = [];
      document.body.innerHTML = "";
    }
  });
});

// ================================================================================================
// KALIBRIERUNG — jeder der vier Faelle haengt wirklich am ausgelieferten Skript
// ================================================================================================
//
// Verfaelscht wird jeweils GENAU die Stelle, von der der Fall lebt. Aendert sich das Ergebnis
// dabei nicht, misst der Fall daneben nichts.
describe("JOB 3019 · Kalibrierung — die Faelle bemerken eine Gegenaenderung", () => {
  /** Die alte Regel wiederherstellen: die Markierung gewinnt gegen den getippten Text. */
  const alteVorrangregel = (skript: string): string =>
    verfaelschen(
      skript,
      'var from = manual.length > 0 ? "manual" : selection.length > 0 ? "selection" : "empty";',
      'var from = selection.length > 0 ? "selection" : manual.length > 0 ? "manual" : "empty";',
    );

  it("A haengt an der Vorrangregel: mit der alten Regel traegt `question` wieder die Markierung", async () => {
    await fragen({ markierung: MARKIERUNG, eingabe: FRAGE, mutieren: alteVorrangregel });

    const koerper = askKoerper();
    expect(koerper.question).toBe(MARKIERUNG);
    expect(koerper.selection).toBeUndefined();
  });

  it("A haengt zusaetzlich am Durchreichen: ohne den sechsten Parameter fehlt `selection`", async () => {
    await fragen({
      markierung: MARKIERUNG,
      eingabe: FRAGE,
      mutieren: (skript) =>
        verfaelschen(skript, "          prep.selection\n", "          undefined\n"),
    });

    const koerper = askKoerper();
    // Die Frage stimmt weiterhin — allein das Mitreisen ist zerstoert. Genau das misst Fall A.
    expect(koerper.question).toBe(FRAGE);
    expect(koerper.selection).toBeUndefined();
  });

  it("B haengt am Woerterbuchwert: mit dem alten Satz steht der Widerspruch wieder da", async () => {
    const panel = await fragen({
      markierung: MARKIERUNG,
      eingabe: FRAGE,
      mutieren: (skript) =>
        verfaelschen(
          skript,
          'askSourceSelectionOverride: "Gefragt wird: deine Eingabe unten.',
          'askSourceSelectionOverride: "Gefragt wird: deine Markierung im Dokument — der Text unten wird dabei NICHT gesendet.',
        ),
    });

    expect(panel.herkunftszeile).toContain("NICHT gesendet");
  });

  it("C und D haengen an der Leerprüfung: faellt sie, reist ein leeres `selection`-Feld mit", async () => {
    // Ohne die Bedingung schriebe das Fenster `selection: ""` in den Koerper — der Server saehe
    // dann ein gesetztes Feld, wo es keine Markierung gibt. Beide Klammern muessen das bemerken.
    const ohneLeerpruefung = (skript: string): string =>
      verfaelschen(
        skript,
        "selection: markierung.length > 0 ? markierung : undefined",
        'selection: markierung.length > 0 ? markierung : ""',
      );

    await fragen({ markierung: MARKIERUNG, eingabe: "", mutieren: ohneLeerpruefung });
    expect(Object.keys(askKoerper())).toContain("selection");

    abrufe = [];
    document.body.innerHTML = "";
    await fragen({ markierung: "", eingabe: FRAGE, mutieren: ohneLeerpruefung });
    expect(Object.keys(askKoerper())).toContain("selection");
  });
});

// ================================================================================================
// DER PRUEFSTAND SELBST — damit ein gruener Lauf nicht aus einem toten Fenster kommen kann
// ================================================================================================
describe("JOB 3019 · der Pruefstand misst ein LEBENDES Fenster", () => {
  it("das Skript stammt aus der ausgelieferten Seite und wird nicht nachgebaut", () => {
    expect(SKRIPT.length).toBeGreaterThan(10_000);
    expect(HTML).toContain(SKRIPT);
    expect(ASK_MAX).toBe(2000);
  });

  it("ohne Markierung UND ohne Eingabe geht gar keine Frage hinaus", async () => {
    // Sonst waeren die Faelle C und D auch dann gruen, wenn das Fenster blind absendet.
    await fragen({ markierung: "", eingabe: "" });
    expect(abrufe.filter((a) => a.url === "/api/ask")).toEqual([]);
  });
});
