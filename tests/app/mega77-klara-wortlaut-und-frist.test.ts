// ================================================================================================
// AUFTRAG-mega77 BLÖCKE A (Panel-Seite), B und C — WAS KLARA SAGT UND WANN SIE AUFHÖRT ZU WARTEN.
// ================================================================================================
//
// Zum Wächter-Merksatz: dieser Test erhebt seine Grundmenge selbst (die drei Wörterbücher werden
// aus der Datei GELESEN, nicht aufgezählt), erkennt Schrumpfen fail-closed (findet er weniger als
// drei Sprachen oder einen leeren Text, ist er rot) und pinnt für Block C VERHALTEN statt Namen:
// der Statusabruf-Block wird aus der Datei geschnitten und WIRKLICH AUSGEFÜHRT, gegen ein fetch,
// das nie antwortet.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

// Die Wörterbücher werden GELESEN, nicht gepflegt: fehlt eines, ist das ein Fehler und kein
// stillschweigend übersprungener Fall.
function woerterbuch(sprache: Sprache): string {
  const start = HTML.indexOf(`      ${sprache}: {`);
  expect(start, `${TASKPANE}: Wörterbuch ${sprache} nicht gefunden`).toBeGreaterThan(0);
  const ende = HTML.indexOf("\n      },", start);
  expect(ende, `${TASKPANE}: Ende des Wörterbuchs ${sprache} nicht gefunden`).toBeGreaterThan(
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

// ================================================================================================
// BLOCK A — die Panel-Seite: kein Feld, kein Satz, kein Schlüssel.
// ================================================================================================
describe("AUFTRAG-mega77 BLOCK A: der Ungeprüft-Zähler ist auch aus dem Aufgabenfenster raus", () => {
  it("weder Anzeigefläche noch Wörterbuch-Schlüssel noch Auswertung des Antwortfelds", () => {
    // Die Fläche, auf der die Zahl stand.
    expect(HTML, "Die Anzeigefläche des Zählers muss weg sein").not.toContain(
      'id="ask-gap-unchecked"',
    );
    // Der Schlüssel — in ALLEN drei Wörterbüchern, erhoben statt aufgezählt.
    for (const sprache of SPRACHEN) {
      expect(
        woerterbuch(sprache),
        `${sprache}: askGapUnchecked darf es nicht mehr geben`,
      ).not.toContain("askGapUnchecked");
    }
    // Und der Antwortkörper wird nicht mehr danach durchsucht.
    expect(HTML, "Das Panel darf das Serverfeld nicht mehr lesen").not.toContain(
      "ungeprueftUnterdrueckt",
    );
  });

  it("die Absage selbst bleibt — entfernt wurde die ZAHL, nicht die Ehrlichkeit", () => {
    expect(HTML).toContain('id="ask-gap-block"');
    for (const sprache of SPRACHEN) {
      expect(text(sprache, "askGapTitle").length).toBeGreaterThan(0);
      // JOB 3046 D2: die Luecke ist die Auskunft des Zielbilds KeinWissen.dc.html — EIN Satz
      // (askGapTitle) und die Fusszeile (askGapFuss); der Erklaertext askGapBody ist in allen drei
      // Sprachen ENTFERNT, kein toter Schluessel bleibt stehen.
      expect(text(sprache, "askGapFuss").length).toBeGreaterThan(0);
      expect(woerterbuch(sprache), `${sprache}: askGapBody darf es nicht mehr geben`).not.toContain(
        "askGapBody:",
      );
    }
  });
});

// ================================================================================================
// BLOCK B — zwei Sätze, die mehr versprachen als der Code hält.
// ================================================================================================
//
// (1) DIE BETRIEBSZUSAGE. „der markierte Text verlässt das Haus nicht" (EN „never leaves your
//     organisation", NL „verlaat het huis niet") ist durch diese Scheibe NICHT gedeckt:
//     Retrieval-only beweist, dass der markierte Text nicht an Modell oder Embedder geht — es
//     beweist nicht, WO der KLARWERK-Server steht, und per HTTP geht der Text an ihn.
// (2) DIE VERALLGEMEINERUNG. Die KI-Lage ist korrekt auf die Aufgabe `answer` gepinnt; der
//     sichtbare Satz sprach aber von ganz KLARWERK. Bei `tasks.answer === false` zeigte Klara
//     „keine KI", während für andere Aufgaben sehr wohl eine arbeitet — genau der Fall, aus dem
//     Pedis ursprünglicher Widerspruch entstand.
describe("AUFTRAG-mega77 BLOCK B: Klara sagt nur, was der Code belegt", () => {
  it("keine Aussage über Serverstandort oder Organisationsgrenze — in KEINER Sprache", () => {
    // Die verbotenen Halbsätze, je Sprache. Sie stehen hier als BEFUND (was entfernt wurde),
    // geprüft wird gegen das ganze Wörterbuch, nicht nur gegen den einen Schlüssel — ein Umzug
    // derselben Zusage in einen anderen Text wäre sonst unsichtbar.
    const verboten: Record<Sprache, string[]> = {
      de: ["verlässt das Haus", "verlaesst das Haus", "verlässt dein Haus"],
      en: ["leaves your organisation", "leaves your organization", "leaves the building"],
      nl: ["verlaat het huis", "verlaat je organisatie"],
    };
    for (const sprache of SPRACHEN) {
      const dict = woerterbuch(sprache);
      for (const satz of verboten[sprache]) {
        expect(dict, `${sprache}: „${satz}" ist eine ungedeckte Betriebszusage`).not.toContain(
          satz,
        );
      }
    }
  });

  it("der belastbare Teil steht dafür in allen drei Sprachen: kein externes Modell, wörtliches Zitat", () => {
    // BEIDE Hälften sind im Code belegt: `mode: "retrieval-only"` erzwingt serverseitig
    // validatedOnly + retrievalOnly (kein Modell-, kein Embedder-Aufruf erreichbar), und die
    // Antwort ist die wörtliche validierte Aussage statt einer Formulierung.
    const belegt: Record<Sprache, string[]> = {
      de: ["wörtlich", "nicht an eine externe KI"],
      en: ["word for word", "not sent to an external AI"],
      nl: ["woordelijk", "niet naar een externe AI"],
    };
    for (const sprache of SPRACHEN) {
      const satz = text(sprache, "askRuleNote");
      for (const teil of belegt[sprache]) {
        expect(satz, `${sprache}.askRuleNote muss „${teil}" nennen`).toContain(teil);
      }
    }
  });

  // ENTFERNT in AUFTRAG-mega79 BLOCK B — hier stand ein Wächter, der pinnte, dass die drei
  // Zustandssätze die WÖRTER „Klaras Antwort" (EN/NL entsprechend) enthalten. Er hat genau das
  // getan, wovor der Wächter-Merksatz warnt: Namensanwesenheit statt Verhalten. Und er hielt damit
  // eine FALSCHAUSSAGE dauerhaft grün — „Für Klaras Antwort arbeitet zurzeit eine externe KI" —,
  // obwohl Klaras Antwort nie ein Modell erreicht.
  //
  // Die Ablösung pinnt Verhalten: tests/app/mega79-klara-antwort-ohne-modell.test.ts ERHEBT die
  // Aufrufkette durch Ausführung (Client → Aufgabenfenster → echte HTTP-Route → Dienst → Reasoner,
  // Modell- und Embedder-Spy plus Gegenlauf) und koppelt die sichtbaren Sätze daran. Der Bezug auf
  // Klaras Antwort wird dort weiterhin erzwungen — aber als Teil einer Ausschluss-Aussage, nicht
  // als bloßes Vorkommen.

  it("„keine KI“ sagt ausdrücklich, dass andere Aufgaben anders liegen können", () => {
    // Ohne diesen Zusatz bliebe der Widerspruch für die Leserin bestehen: sie sieht in KLARWERK
    // eine KI arbeiten und hier „keine".
    const hinweis: Record<Sprache, string> = {
      de: "andere Aufgaben in KLARWERK",
      en: "Other tasks in KLARWERK",
      nl: "andere taken in KLARWERK",
    };
    for (const sprache of SPRACHEN) {
      expect(text(sprache, "aiLageKeine"), `${sprache}.aiLageKeine`).toContain(hinweis[sprache]);
    }
  });

  it("die beiden Phasen-Zustände sind unverändert — sie sind von Block B nicht betroffen", () => {
    for (const sprache of SPRACHEN) {
      expect(text(sprache, "aiLageLaedt").length).toBeGreaterThan(0);
      expect(text(sprache, "aiLageUnerreichbar").length).toBeGreaterThan(0);
    }
  });
});

// ================================================================================================
// BLOCK C — der Statusabruf braucht ein Ende.
// ================================================================================================
//
// KEIN QUELLTEXT-PIN. Der Block wird aus der Datei geschnitten und AUSGEFÜHRT — gegen ein `fetch`,
// das nie antwortet. Beobachtet wird der angezeigte Zustand, nicht der Name einer Konstante.
const C_START = "// KW-KLARA-AISTATE-FETCH-START";
const C_END = "// KW-KLARA-AISTATE-FETCH-END";

interface Lauf {
  /** Der zuletzt gesetzte Anzeige-Zustand (die Phase, die `renderAiLage` gesehen hat). */
  phase: () => string;
  /** Wurde der laufende Abruf wirklich abgebrochen? */
  abgebrochen: () => boolean;
  /** Die Frist, mit der `setTimeout` gerufen wurde. */
  frist: () => number | null;
  /** Die Frist auslösen. */
  fristAusloesen: () => void;
  /** Den Abruf nachträglich (zu spät) beantworten. */
  spaetAntworten: (body: unknown) => Promise<void>;
}

// Baut den echten Block mit kontrollierter Umgebung: `fetch` antwortet nie von selbst,
// `setTimeout` wird angehalten, damit die Frist gezielt ausgelöst werden kann.
function ladeStatusblock(): Lauf {
  const start = HTML.indexOf(C_START);
  const end = HTML.indexOf(C_END);
  expect(
    start,
    `${TASKPANE}: ${C_START} fehlt — der Statusabruf ist nicht auffindbar`,
  ).toBeGreaterThan(0);
  expect(end, `${TASKPANE}: ${C_END} fehlt`).toBeGreaterThan(start);
  const block = HTML.slice(start, end);

  let phase = "";
  let abgebrochen = false;
  let frist: number | null = null;
  let fristFn: (() => void) | null = null;
  let aufloesen: ((body: unknown) => void) | null = null;

  // Ein `fetch`, das NIE von selbst antwortet — genau der Fall aus dem Auftrag: weder erfüllt noch
  // verworfen. Der Abbruch über das Signal lehnt es ab (wie eine echte Laufzeit).
  const fetchStub = (_url: string, init: { signal: { addEventListener?: unknown } }) =>
    new Promise((res, rej) => {
      aufloesen = (body) => res({ ok: true, json: async () => body });
      const signal = init.signal as unknown as {
        addEventListener: (typ: string, fn: () => void) => void;
      };
      signal.addEventListener("abort", () => {
        abgebrochen = true;
        rej(new Error("AbortError"));
      });
    });

  const umgebung = {
    fetch: fetchStub,
    setTimeout: (fn: () => void, ms: number) => {
      frist = ms;
      fristFn = fn;
      return 1;
    },
    clearTimeout: () => {
      fristFn = null;
    },
    AbortController,
    // Die Anzeige: statt DOM nur das, was der Zustand aussagt.
    renderAiLage: () => {
      phase = umgebung.aiLagePhase;
    },
    aiLagePhase: "",
    aiLageStatus: null as unknown,
    // Die Frist wird bewusst NICHT als Zahl eingeschleust: der Block soll die vorhandene Konstante
    // des Aufgabenfensters benutzen. Sie kommt deshalb aus der DATEI.
    WORD_ADDIN_LOGIN_FETCH_TIMEOUT_MS: fristAusDatei(),
  };

  const factory = new Function(
    "umgebung",
    `with (umgebung) { var aiLagePhase = umgebung.aiLagePhase, aiLageStatus = umgebung.aiLageStatus;
       function renderAiLage() { umgebung.aiLagePhase = aiLagePhase; umgebung.renderAiLage(); }
       ${block}
       return ladeAiLage; }`,
  );
  (factory(umgebung) as () => void)();

  return {
    phase: () => phase,
    abgebrochen: () => abgebrochen,
    frist: () => frist,
    fristAusloesen: () => {
      fristFn?.();
    },
    spaetAntworten: async (body) => {
      aufloesen?.(body);
      await new Promise((r) => setTimeout(r, 0));
    },
  };
}

// Die Frist wird aus der Datei gelesen, nicht im Test dupliziert — sonst prüfte der Test seine
// eigene Annahme statt des Aufgabenfensters.
function fristAusDatei(): number {
  const treffer = /var WORD_ADDIN_LOGIN_FETCH_TIMEOUT_MS = (\d+);/.exec(HTML);
  expect(
    treffer,
    `${TASKPANE}: die vorhandene Statusabruf-Frist ist nicht auffindbar`,
  ).not.toBeNull();
  return Number(treffer?.[1]);
}

describe("AUFTRAG-mega77 BLOCK C: ein hängender Statusabruf endet in „nicht erreichbar“", () => {
  it("ohne Antwort steht zuerst „lädt“ — der Ladezustand ist kein Befund", () => {
    const lauf = ladeStatusblock();
    expect(lauf.phase(), "Vor der Frist darf NICHT „keine KI“ behauptet werden").toBe("laedt");
  });

  it("nach der Frist steht „unerreichbar“ — und der Abruf ist wirklich abgebrochen", () => {
    const lauf = ladeStatusblock();
    expect(lauf.phase()).toBe("laedt");
    lauf.fristAusloesen();
    expect(
      lauf.phase(),
      "Ein Abruf, der weder erfüllt noch verworfen wird, muss in „nicht erreichbar“ münden",
    ).toBe("unerreichbar");
    expect(
      lauf.abgebrochen(),
      "Die Frist muss den Abruf ABBRECHEN, nicht nur nebenher laufen",
    ).toBe(true);
  });

  it("die Frist ist die BESTEHENDE des Aufgabenfensters — keine neu erfundene Zahl", () => {
    // Begründung im Quelltext: derselbe kleine, same-origin Statusabruf wie der Login-Poll gegen
    // /api/auth/me. Die lange Ask-Frist gehört zu einem Abruf, der serverseitig wirklich rechnet.
    const lauf = ladeStatusblock();
    expect(lauf.frist()).toBe(fristAusDatei());
    // Und ausdrücklich NICHT die Ask-Frist.
    const ask = /var WORD_ADDIN_ASK_TIMEOUT_MS = (\d+);/.exec(HTML);
    expect(ask, "Die Ask-Frist muss es weiterhin geben").not.toBeNull();
    expect(lauf.frist()).not.toBe(Number(ask?.[1]));
  });

  it("eine ZU SPÄT eintreffende Antwort überschreibt das gefällte Urteil nicht", () => {
    // Sonst spränge die Anzeige nach dem ehrlichen „nicht erreichbar“ zurück auf einen Befund,
    // den wir zum Zeitpunkt der Frist nicht hatten.
    const lauf = ladeStatusblock();
    lauf.fristAusloesen();
    expect(lauf.phase()).toBe("unerreichbar");
    return lauf.spaetAntworten({ active: true, mode: "cloud" }).then(() => {
      expect(lauf.phase(), "Späte Antwort darf den Zustand nicht mehr ändern").toBe("unerreichbar");
    });
  });
});
