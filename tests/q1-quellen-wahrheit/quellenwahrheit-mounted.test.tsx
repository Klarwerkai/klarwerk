// @vitest-environment jsdom
// ================================================================================================
// JOB 3267 · Q1/M2-R — DIE QUELLENAUSKUNFT DER ANTWORT SAGT DIE WAHRHEIT.
// ================================================================================================
//
// DIE BELEGTE LAGE (Codex, m2-homeoffice-browser-en.json, Live 1.174; Ursachenfund 037f24c7):
// Die englische Antwort übernahm die Homeoffice-Regel samt Fußnote 1 — und der einzige Quelllink
// sagte im Tooltip „Consulted but not used: this source was available to the AI but does not
// appear in the answer text." Ursache ist NICHT die Attribution, sondern ihre Verwechslung mit dem
// Prüfstand: `Ask.tsx:1208-1215` setzte am gelben Punkt einer NICHT validierten Quelle
// BEDINGUNGSLOS `ask.attribution.consulted.hint`. Der gelbe Punkt zeigt einen PRÜFSTAND
// (`validated === false`), sein Tooltip behauptete eine NICHTVERWENDUNG. Zwei verschiedene Fragen,
// ein Wort — und das Wort war falsch.
//
// WAS HIER GEMESSEN WIRD, und zwar an der GEMOUNTETEN Fragenfläche mit nachgestellter Antwort
// (nur so sind die Widerspruchsfälle überhaupt herstellbar — der echte Server erzeugt sie nicht
// auf Bestellung):
//
//   Q1  Eine TRAGENDE, OFFENE Quelle: der Chip sagt „verwendet", der gelbe Punkt beschreibt den
//       PRÜFSTAND („Offen") und behauptet nirgends eine Nichtverwendung.
//   Q2  Eine Quelle mit tragfähiger Attribution UND ohne gerenderten Referenzanker: „nicht
//       verwendet".
//   Q3  Fehlende Attribution (`citedSources` fehlt): JEDE Quelle „Zuordnung unbekannt" — nie
//       „verwendet", nie „nicht verwendet".
//   Q4  WIDERSPRUCH: `citedSources` ist da, zeigt aber auf eine Kennung ausserhalb von `sources`.
//       Die Fläche rendert dann die Marke aus dem Text — Quelle 1 trägt einen sichtbaren
//       Referenzanker, während die Attribution sie nicht nennt. Sie heisst „Zuordnung unbekannt",
//       NIEMALS „nicht verwendet". Quelle 2 (kein Anker) heisst es AUCH NICHT: in dieser Lage ist
//       keine einzige Kennung auflösbar, also ist über keine Zeile etwas bekannt (R3, s. Q8).
//   Q5  DE/EN Wortlaut, an genau denselben Lagen.
//   Q6  Der Prüfstand bleibt sichtbar und trägt sein EIGENES Wort (Offen/Validiert), getrennt vom
//       Verwendungswort.
//   Q7  DIE INVARIANTE über alle Lagen: keine Quelle, deren Fussnote im Antworttext GERENDERT ist,
//       wird je als „nicht verwendet" ausgewiesen.
//   Q8  NICHTLEER IST NICHT TRAGFÄHIG (Ben, Runde 2): nennt `citedSources` ausschliesslich fremde
//       Kennungen, ist JEDE Zeile „Zuordnung unbekannt" — auch ohne jede Marke im Text. Steht
//       daneben EINE auflösbare Kennung, trägt die Zuordnung wieder, und die nicht genannte Quelle
//       heisst belegt „nicht verwendet". Das ist der Beleg, dass Q4/Q8 nicht alles auf „unbekannt"
//       kippen.
//
// DIE ZUORDNUNG LÄUFT ÜBER DEN ECHTEN GERENDERTEN ANKER (`sup[data-fussnote]`) UND DIE QUELL-ID
// (Stelle in `result.sources`) — kein Ziffern- oder Textmatch im Antworttext, keine neue
// Attribution-Heuristik. Genau das misst dieser Test: er liest die Marken aus dem DOM, nicht aus
// dem Rohtext.
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Das Antwortergebnis, das die montierte Fläche bekommt. `vi.hoisted`, weil `vi.mock` nach oben
 * gezogen wird und die Fabrik keine gewöhnliche Modulvariable sehen darf (Muster aus
 * `tests/ask/job3064-deckungsrueckfall-fussnote.test.tsx`).
 */
const bestand = vi.hoisted(() => ({
  ergebnis: null as null | Record<string, unknown>,
  kos: [] as Record<string, unknown>[],
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => bestand.kos) },
    conflicts: { list: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
    reasoner: {
      status: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        reachable: "active",
        tasks: { answer: true },
      })),
    },
    ask: {
      ask: vi.fn(async () => ({
        result: { ...bestand.ergebnis, captionSources: [] },
        gap: null,
        receipt: "r",
      })),
      helpful: vi.fn(),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

// ------------------------------------------------------------------------------------------------
// DIE LAGE — der Homeoffice-Fall aus der Vorführung, auf zwei Quellen gestellt.
// ------------------------------------------------------------------------------------------------
const HEIM = "ko-homeoffice";
const RAND = "ko-randnotiz";
const HEIM_TITEL = "Homeoffice zwei Tage je Woche";
const RAND_TITEL = "Randnotiz Arbeitszeitkonto";
const FRAGE = "Wie viele Tage Homeoffice sind moeglich?";
// Die Fussnote [1] steht IM TEXT — genau die Lage der Vorführung.
const ANTWORT = "Homeoffice ist an zwei Tagen je Woche moeglich [1].";

function ko(id: string, title: string, status: "offen" | "validiert"): Record<string, unknown> {
  return {
    id,
    title,
    statement: title,
    conditions: [],
    measures: [],
    type: "regel",
    category: "Arbeitsorganisation",
    tags: [],
    confidence: 80,
    trust: status === "validiert" ? 90 : 45,
    status,
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    history: [],
  };
}

bestand.kos = [ko(HEIM, HEIM_TITEL, "offen"), ko(RAND, RAND_TITEL, "validiert")];

// Dieselbe Aussage OHNE Klammer — für die Lagen, in denen gar keine Marke gerendert werden soll.
const ANTWORT_OHNE_MARKE = "Homeoffice ist an zwei Tagen je Woche moeglich.";

function antwort(
  citedSources: string[] | undefined,
  text: string = ANTWORT,
): Record<string, unknown> {
  return {
    answered: true,
    answer: text,
    knowledgeClass: "ungeprueft",
    trust: 70,
    sources: [HEIM, RAND],
    steps: [],
    demo: false,
    ...(citedSources === undefined ? {} : { citedSources }),
  };
}

/** Die vier Lagen dieses Auftrags — jede eine eigene, benannte Wahrheit. */
const LAGEN = {
  // Q1/Q2: der Server nennt die tragende Quelle, und sie ist die OFFENE.
  tragend: antwort([HEIM]),
  // Q3: der Server kennt das Feld nicht (Altbestand) — „unbekannt", nicht „keine".
  ohneZuordnung: antwort(undefined),
  // Q3b: das Modell lieferte keine verwertbare Marke — derselbe Zustand (mega52 A5).
  leereZuordnung: antwort([]),
  // Q4: die Zuordnung ist DA, zeigt aber ins Leere. Die Fläche rendert dann die Marke aus dem
  // Text: Quelle 1 hat einen sichtbaren Anker, die Attribution nennt sie nicht. Widerspruch.
  widerspruch: antwort(["ko-gibt-es-nicht"]),
  // Q8: EINE gültige und EINE fremde Kennung. Die Zuordnung ist damit nachweislich lesbar — die
  // fremde Kennung sagt über die übrigen Zeilen nichts, und Quelle 2 trägt die Antwort.
  gemischt: antwort([RAND, "ko-gibt-es-nicht"]),
};

/**
 * Die Lagen OHNE gerenderte Marke. Sie stehen getrennt, weil Q7 von jeder Lage in `LAGEN`
 * mindestens eine Marke verlangt (die Invariante misst dort sonst nichts).
 *
 * `benGegenfall` ist wörtlich der Fall aus bens Prüfung der Runde 2: zwei vorhandene Quellen, eine
 * ausschliesslich fremde Kennung, kein Anker im Text. Bis R3 hiessen dort BEIDE Quellen „nicht
 * verwendet" — eine Negativaussage, für die es keinen Beleg gibt.
 */
const LAGEN_OHNE_MARKE = {
  benGegenfall: antwort(["ko-gibt-es-nicht"], ANTWORT_OHNE_MARKE),
  gemischtOhneMarke: antwort([RAND, "ko-gibt-es-nicht"], ANTWORT_OHNE_MARKE),
};

// ------------------------------------------------------------------------------------------------
// DIE VORRICHTUNG.
// ------------------------------------------------------------------------------------------------
const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

interface Flaeche {
  container: HTMLElement;
  unmount: () => void;
}

const offen: Flaeche[] = [];

afterEach(async () => {
  for (const f of offen.splice(0)) {
    f.unmount();
  }
  await i18n.changeLanguage("de");
});

async function mount(sprache: "de" | "en"): Promise<Flaeche> {
  await i18n.changeLanguage(sprache);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: ["/fragen"] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  const f: Flaeche = {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
  offen.push(f);
  return f;
}

/** Fragt über das ECHTE Formular — kein Hineinschreiben in den Zustand. */
async function fragen(f: Flaeche): Promise<void> {
  const feld = f.container.querySelector("input") as HTMLInputElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(feld, FRAGE);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(async () => {
    (f.container.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
  });
}

/** Eine Lage stellen und die Fläche bis zur stehenden Antwortkarte fahren. */
async function lage(
  welche: Record<string, unknown>,
  sprache: "de" | "en" = "de",
): Promise<{ f: Flaeche; karte: HTMLElement }> {
  bestand.ergebnis = welche;
  const f = await mount(sprache);
  await fragen(f);
  const karte = f.container.querySelector<HTMLElement>('[data-testid="ask-answer"]');
  expect(karte, "es gibt keine Antwortkarte — die Messung wäre bedeutungslos").not.toBeNull();
  return { f, karte: karte as HTMLElement };
}

/** Das Seitenblatt „Mehr" öffnen (portaliert nach `document.body`, s. `Seitenblatt.tsx`). */
async function mehr(f: Flaeche): Promise<void> {
  await act(async () => {
    f.container.querySelector<HTMLButtonElement>('[data-testid="ask-menu"]')?.click();
    await flush();
  });
  await act(async () => {
    document.querySelector<HTMLButtonElement>('[data-testid="ask-menu-punkt-mehr"]')?.click();
    await flush();
  });
}

/** Die WIRKLICH gerenderten Fussnoten der Antwortkarte — nicht die Klammern im Rohtext. */
const markenIn = (c: ParentNode): number[] =>
  [...c.querySelectorAll("sup[data-fussnote]")]
    .map((e) => Number(e.getAttribute("data-fussnote")))
    .sort((a, b) => a - b);

/** Der Chip zur Quellennummer n — die Chips tragen die Form „n · Titel". */
function chip(karte: ParentNode, n: number): HTMLElement {
  const treffer = [...karte.querySelectorAll<HTMLElement>('[data-testid="ask-quellen-chip"]')].find(
    (c) => (c.textContent ?? "").trim().startsWith(`${n} ·`),
  );
  expect(treffer, `kein Quellen-Chip mit der Nummer ${n}`).toBeDefined();
  return treffer as HTMLElement;
}

/** Der Verwendungszustand am Chip — maschinenlesbar, nicht über den übersetzten Text geraten. */
function verwendung(karte: ParentNode, n: number): string | null {
  const plakette = chip(karte, n).querySelector<HTMLElement>(
    '[data-testid="ask-quellen-chip-verwendung"]',
  );
  expect(plakette, `Chip ${n} trägt keine Verwendungsangabe`).not.toBeNull();
  return (plakette as HTMLElement).getAttribute("data-verwendung");
}

const wort = (e: Element | null): string => (e?.textContent ?? "").trim();

// ================================================================================================
// Q1/Q2 · DIE TRAGENDE, OFFENE QUELLE — DER FALL DER VORFÜHRUNG.
// ================================================================================================
describe("JOB 3267 Q1 · tragende Quelle, offener Prüfstand", () => {
  it("Q1a · der Chip der tragenden Quelle sagt „verwendet“ — und ihre Fussnote steht im Text", async () => {
    const { karte } = await lage(LAGEN.tragend);
    expect(markenIn(karte), "die Fussnote 1 wird gar nicht gerendert").toContain(1);
    expect(verwendung(karte, 1)).toBe("verwendet");
  });

  it("Q1b · DER BEFUND VON CODEX: der gelbe Punkt beschreibt den PRÜFSTAND, nie eine Nichtverwendung", async () => {
    const { karte } = await lage(LAGEN.tragend);
    const punkt = chip(karte, 1).querySelector<HTMLElement>(
      '[data-testid="ask-quellen-chip-punkt"]',
    );
    expect(punkt, "die offene Quelle trägt keinen Prüfstand-Punkt mehr").not.toBeNull();
    const hinweis = punkt?.getAttribute("title") ?? "";
    expect(hinweis.length, "der Punkt sagt gar nichts").toBeGreaterThan(0);
    // Genau der Satz aus der Vorführung darf hier NICHT stehen.
    expect(hinweis, `der Punkt behauptet weiter eine Nichtverwendung: „${hinweis}“`).not.toContain(
      "nicht verwendet",
    );
    expect(hinweis).not.toContain("Herangezogen, aber nicht verwendet");
    // Er sagt stattdessen, was er wirklich zeigt: den Prüfstand dieser Quelle.
    expect(hinweis, `der Punkt nennt den Prüfstand nicht: „${hinweis}“`).toContain("Offen");
  });

  it("Q2 · die nicht genannte Quelle OHNE gerenderten Anker heisst „nicht verwendet“", async () => {
    const { karte } = await lage(LAGEN.tragend);
    expect(markenIn(karte), "zu Quelle 2 steht doch eine Marke im Text").not.toContain(2);
    expect(verwendung(karte, 2)).toBe("nichtVerwendet");
  });
});

// ================================================================================================
// Q3 · OHNE TRAGFÄHIGE ZUORDNUNG GIBT ES KEINE AUSSAGE.
// ================================================================================================
describe("JOB 3267 Q3 · fehlende Zuordnung bleibt unbekannt", () => {
  it("Q3a · `citedSources` fehlt (Altbestand): KEINE Quelle wird eingeordnet", async () => {
    const { karte } = await lage(LAGEN.ohneZuordnung);
    expect(verwendung(karte, 1)).toBe("unbekannt");
    expect(verwendung(karte, 2)).toBe("unbekannt");
  });

  it("Q3b · leere Zuordnung (Modell ohne verwertbare Marke) ist derselbe Zustand", async () => {
    const { karte } = await lage(LAGEN.leereZuordnung);
    expect(verwendung(karte, 1)).toBe("unbekannt");
    expect(verwendung(karte, 2)).toBe("unbekannt");
  });

  it("Q3c · der Hinweis über der Quellenliste sagt es ausdrücklich", async () => {
    const { f } = await lage(LAGEN.ohneZuordnung);
    await mehr(f);
    expect(document.querySelector('[data-testid="ask-attribution-unknown"]')).not.toBeNull();
  });
});

// ================================================================================================
// Q4 · DER WIDERSPRUCH — DIE KONSISTENZREGEL.
// ================================================================================================
describe("JOB 3267 Q4 · Anker im Text schlägt eine Attribution, die ihn nicht kennt", () => {
  it("Q4a · Quelle MIT gerendertem Anker, von der Attribution nicht genannt: „Zuordnung unbekannt“", async () => {
    const { karte } = await lage(LAGEN.widerspruch);
    // KALIBRIERUNG DER LAGE: die Marke wird wirklich gerendert, sonst misst Q4a nichts.
    expect(markenIn(karte), "ohne gerenderte Marke gibt es keinen Widerspruch").toContain(1);
    expect(verwendung(karte, 1)).toBe("unbekannt");
    expect(
      verwendung(karte, 1),
      "die Fläche behauptet eine Nichtverwendung gegen den Anker",
    ).not.toBe("nichtVerwendet");
  });

  // KORRIGIERT IN RUNDE 3 (Ben, Korrekturpflicht 2). Bis Runde 2 stand hier die Erwartung „nicht
  // verwendet" für Quelle 2 — und sie war falsch: in dieser Lage nennt `citedSources` AUSSCHLIESSLICH
  // eine Kennung, die zu keiner Quelle dieser Antwort gehört. Dann ist über KEINE Zeile etwas
  // bekannt, auch nicht über die ohne Anker. Der Beleg, dass Q4 trotzdem nicht alles auf „unbekannt"
  // kippt, steht jetzt in Q8b — dort ist die Zuordnung tragfähig.
  it("Q4b · die unauflösbare Zuordnung sagt auch über die Quelle OHNE Anker nichts", async () => {
    const { karte } = await lage(LAGEN.widerspruch);
    expect(markenIn(karte)).not.toContain(2);
    expect(
      verwendung(karte, 2),
      "die Fläche behauptet eine Nichtverwendung, obwohl keine einzige Kennung auflösbar ist",
    ).toBe("unbekannt");
  });
});

// ================================================================================================
// Q8 · NICHTLEER IST NICHT TRAGFÄHIG — DER GEGENFALL VON BEN (RUNDE 2).
// ================================================================================================
describe("JOB 3267 Q8 · eine Zuordnung ohne auflösbare Kennung trägt keine Aussage", () => {
  it("Q8a · zwei Quellen, nur eine fremde Kennung, keine Marke im Text: BEIDE „unbekannt“", async () => {
    const { karte } = await lage(LAGEN_OHNE_MARKE.benGegenfall);
    // KALIBRIERUNG: ohne gerenderte Marke kann die Konsistenzregel nichts retten — was hier steht,
    // steht allein wegen der geprüften Tragfähigkeit.
    expect(markenIn(karte), "diese Lage soll gar keine Marke rendern").toEqual([]);
    expect(verwendung(karte, 1)).toBe("unbekannt");
    expect(verwendung(karte, 2)).toBe("unbekannt");
  });

  it("Q8a2 · und die Quellenliste sagt dasselbe: kein „nicht verwendet“, dafür der Hinweis", async () => {
    const { f } = await lage(LAGEN_OHNE_MARKE.benGegenfall);
    await mehr(f);
    expect(document.querySelectorAll('[data-testid="ask-source-unclear"]').length).toBe(2);
    expect(document.querySelector('[data-testid="ask-source-consulted"]')).toBeNull();
    expect(document.querySelector('[data-testid="ask-attribution-unknown"]')).not.toBeNull();
  });

  it("Q8b · eine gültige NEBEN einer fremden Kennung bleibt tragfähig — und kippt nicht alles", async () => {
    const { karte } = await lage(LAGEN_OHNE_MARKE.gemischtOhneMarke);
    expect(verwendung(karte, 2), "die genannte, auflösbare Quelle trägt die Antwort").toBe(
      "verwendet",
    );
    expect(
      verwendung(karte, 1),
      "die nicht genannte Quelle ohne Anker ist hier belegt „nicht verwendet“",
    ).toBe("nichtVerwendet");
  });

  it("Q8c · EN: derselbe Unterschied in Worten — unknown gegen not used", async () => {
    const a = await lage(LAGEN_OHNE_MARKE.benGegenfall, "en");
    expect(
      wort(chip(a.karte, 1).querySelector('[data-testid="ask-quellen-chip-verwendung"]')),
    ).toBe("unknown");
    a.f.unmount();
    offen.splice(offen.indexOf(a.f), 1);
    const b = await lage(LAGEN_OHNE_MARKE.gemischtOhneMarke, "en");
    expect(
      wort(chip(b.karte, 2).querySelector('[data-testid="ask-quellen-chip-verwendung"]')),
    ).toBe("used");
    expect(
      wort(chip(b.karte, 1).querySelector('[data-testid="ask-quellen-chip-verwendung"]')),
    ).toBe("not used");
  });
});

// ================================================================================================
// Q5 · DER WORTLAUT, DE UND EN.
// ================================================================================================
describe("JOB 3267 Q5 · DE/EN sagen dasselbe", () => {
  it("Q5a · DE: verwendet · nicht verwendet · unbekannt", async () => {
    const a = await lage(LAGEN.tragend);
    expect(
      wort(chip(a.karte, 1).querySelector('[data-testid="ask-quellen-chip-verwendung"]')),
    ).toBe("verwendet");
    expect(
      wort(chip(a.karte, 2).querySelector('[data-testid="ask-quellen-chip-verwendung"]')),
    ).toBe("nicht verwendet");
    a.f.unmount();
    offen.splice(offen.indexOf(a.f), 1);
    const b = await lage(LAGEN.ohneZuordnung);
    expect(
      wort(chip(b.karte, 1).querySelector('[data-testid="ask-quellen-chip-verwendung"]')),
    ).toBe("unbekannt");
  });

  it("Q5b · EN: used · not used · unknown, und der Tooltip sagt die ganze Aussage", async () => {
    const a = await lage(LAGEN.tragend, "en");
    const plakette = chip(a.karte, 1).querySelector<HTMLElement>(
      '[data-testid="ask-quellen-chip-verwendung"]',
    );
    expect(wort(plakette)).toBe("used");
    expect(plakette?.getAttribute("title") ?? "").toContain("Used");
    expect(
      wort(chip(a.karte, 2).querySelector('[data-testid="ask-quellen-chip-verwendung"]')),
    ).toBe("not used");
    a.f.unmount();
    offen.splice(offen.indexOf(a.f), 1);
    const b = await lage(LAGEN.ohneZuordnung, "en");
    const unklar = chip(b.karte, 1).querySelector<HTMLElement>(
      '[data-testid="ask-quellen-chip-verwendung"]',
    );
    expect(wort(unklar)).toBe("unknown");
    expect(unklar?.getAttribute("title") ?? "").toContain("Attribution unknown");
  });

  it("Q5c · EN: der gelbe Punkt nennt den Prüfstand, nicht die Nichtverwendung", async () => {
    const { karte } = await lage(LAGEN.tragend, "en");
    const hinweis =
      chip(karte, 1)
        .querySelector<HTMLElement>('[data-testid="ask-quellen-chip-punkt"]')
        ?.getAttribute("title") ?? "";
    expect(hinweis, `der Punkt behauptet weiter eine Nichtverwendung: „${hinweis}“`).not.toContain(
      "not used",
    );
    expect(hinweis).toContain("Open");
  });
});

// ================================================================================================
// Q6 · DER PRÜFSTAND BLEIBT SICHTBAR — MIT EIGENEM WORT.
// ================================================================================================
describe("JOB 3267 Q6 · Prüfstand und Verwendung sind zwei Aussagen", () => {
  it("Q6a · die Quellenliste zeigt den Prüfstand je Quelle (Offen/Validiert)", async () => {
    const { f } = await lage(LAGEN.tragend);
    await mehr(f);
    const stufen = [
      ...document.querySelectorAll<HTMLElement>('[data-testid="ask-source-pruefstand"]'),
    ].map((e) => e.getAttribute("data-pruefstand"));
    expect(stufen, "der Prüfstand ist aus der Quellenliste verschwunden").toContain("offen");
    expect(stufen).toContain("validiert");
    const offeneStufe = [
      ...document.querySelectorAll<HTMLElement>('[data-testid="ask-source-pruefstand"]'),
    ].find((e) => e.getAttribute("data-pruefstand") === "offen");
    expect(wort(offeneStufe ?? null)).toBe("Offen");
  });

  it("Q6b · die tragende OFFENE Quelle trägt beide Wörter nebeneinander — und sie widersprechen sich nicht", async () => {
    const { f } = await lage(LAGEN.tragend);
    await mehr(f);
    const tragend = document.querySelector<HTMLElement>('[data-testid="ask-source-carrying"]');
    expect(
      tragend,
      "die tragende Quelle ist in der Liste nicht als verwendet ausgewiesen",
    ).not.toBeNull();
    const zeile = tragend?.closest("li");
    expect(wort(zeile?.querySelector('[data-testid="ask-source-pruefstand"]') ?? null)).toBe(
      "Offen",
    );
    expect((zeile?.textContent ?? "").replace(/\s+/g, " ")).toContain(HEIM_TITEL);
  });

  it("Q6c · bei unbekannter Zuordnung trägt die Zeile das eigene Kennzeichen, nicht „nicht verwendet“", async () => {
    const { f } = await lage(LAGEN.ohneZuordnung);
    await mehr(f);
    expect(document.querySelectorAll('[data-testid="ask-source-unclear"]').length).toBe(2);
    expect(document.querySelector('[data-testid="ask-source-consulted"]')).toBeNull();
    expect(document.querySelector('[data-testid="ask-source-carrying"]')).toBeNull();
  });
});

// ================================================================================================
// Q6d · DIE CHIPFORM BLEIBT — DER PIN DES ZIELBILDS ÜBERLEBT DAS NEUE WORT.
// ================================================================================================
// `tests/design/zielbild-h5-fragen.test.ts` misst V9 am ERSTEN `<span>` eines Chips
// (`chipTextWort === "1 · Titel"`) und V18 an `textContent`, das mit der Ziffer beginnen muss.
// Beides läuft nur in Chromium gegen die gebaute App. Die neue Verwendungsplakette steht deshalb
// NACH dem Titel — und dieser Fall hält das hier fest, wo es ohne Browser messbar ist. Wer die
// Plakette nach vorn zöge, würde erst im Tor rot; ab jetzt schon hier.
describe("JOB 3267 Q6d · die gepinnte Chipform „n · Titel“ bleibt unangetastet", () => {
  it("Q6d · das erste <span> eines punktlosen Chips trägt „n · Titel“, und der Chiptext beginnt mit der Ziffer", async () => {
    const { karte } = await lage(LAGEN.tragend);
    // Quelle 2 ist validiert — sie trägt keinen Punkt, genau wie die Demo-Quelle des Zielbilds.
    const zwei = chip(karte, 2);
    expect(
      zwei.querySelector('[data-testid="ask-quellen-chip-punkt"]'),
      "Quelle 2 trägt einen Punkt — der Fall misst nicht mehr die punktlose Chipform",
    ).toBeNull();
    expect(wort(zwei.querySelector("span"))).toBe(`2 · ${RAND_TITEL}`);
    expect((zwei.textContent ?? "").trim().startsWith("2 ·")).toBe(true);
  });
});

// ================================================================================================
// Q7 · DIE INVARIANTE ÜBER ALLE LAGEN.
// ================================================================================================
describe("JOB 3267 Q7 · kein Widerspruch zwischen Antworttext und Quellenauskunft", () => {
  it("Q7 · keine Quelle mit gerendertem Referenzanker heisst je „nicht verwendet“", async () => {
    for (const [name, welche] of Object.entries(LAGEN)) {
      const { f, karte } = await lage(welche);
      const marken = markenIn(karte);
      expect(
        marken.length,
        `Lage „${name}“ rendert keine einzige Marke — die Invariante misst dort nichts`,
      ).toBeGreaterThan(0);
      for (const n of marken) {
        expect(
          verwendung(karte, n),
          `Lage „${name}“: Marke ${n} steht im Text, der Chip sagt „nicht verwendet“`,
        ).not.toBe("nichtVerwendet");
      }
      f.unmount();
      offen.splice(offen.indexOf(f), 1);
    }
  });
});
