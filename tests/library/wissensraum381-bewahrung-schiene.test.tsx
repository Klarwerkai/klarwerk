// @vitest-environment jsdom
// ==================================================================================================
// AUFTRAG PRO 381 · BÜNDEL 3 (Bewahrung) · `R-14` — DER BEWEIS FÜR „ADDITIV“.
// ==================================================================================================
//
// PLAN PRO 378 §8.4 `R-14`: „Bei INAKTIVER Ortsschicht (kein `raum`, überall `home` abwesend) ist
// das Bibliotheks-DOM gegenüber heute unverändert: zehn Achsen, `category → tag`, Bereichsfilter,
// Sortierung, Gruppierung, Fenster, gespeicherte Sichten, Leerzustände."
//
// WIE DAS ÜBERHAUPT MESSBAR IST — die Entwurfsfrage dieser Datei: Ein „unverändert gegenüber heute“
// lässt sich zur Laufzeit gegen nichts vergleichen; ein zweites „heute“ gibt es im Prozess nicht.
// Ein abgelegter DOM-Schnappschuss wäre die Antwort, die PLAN 378 §8 ausdrücklich VERBIETET
// („Snapshot-Großumschreibungen“ stehen auch im Auftrag PRO 381 unter „Verboten“) — und er wäre
// wertlos, weil ihn jede Formatierungsänderung rot macht und deshalb reflexhaft neu geschrieben
// würde. Stattdessen steht hier ein NAMENTLICHES INVENTAR: jede Fähigkeit, die die Bibliothek heute
// hat, wird an der ECHTEN gemounteten Seite einzeln nachgewiesen. Das ist strenger als ein
// Schnappschuss (es prüft Verhalten, nicht Markup) und überlebt jede Umgestaltung, die nichts kaputt
// macht.
//
// DIESE DATEI IST EIN BEWAHRUNGSANKER — HEUTE GRÜN, und sie muss es durch die ganze Umsetzungswelle
// bleiben. PLAN 378 §10 „Reihenfolge“ Punkt 6: beim Montieren der Ortszeile in `Library.tsx` müssen
// `R-14` bis `R-16` DURCHGEHEND grün bleiben.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { ORT_URL_PARAM } from "./support/wissensraum-ort-vertrag";

/** Veränderlicher Bestand — jeder Fall setzt ihn VOR dem Mounten (vi.mock wird hochgezogen). */
const bestand = vi.hoisted(() => ({ kos: [] as unknown[] }));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok(bestand.kos),
    useLibrarySearch: () => ok(bestand.kos),
    useDirectory: () => ok([]),
    useConflicts: () => ok([]),
    // JOB 3068 (N5): die Lesefläche fragt das eigene Signal jetzt selbst — leer heißt „kein Befund".
    useEigeneBefunde: () => ok([]),
    // JOB 3063 (H4): die Fläche zeigt rechts den gewählten Eintrag. Diese Tests messen die LISTE;
    // die Lesefläche bleibt deshalb bewusst im Ladezustand — sie ist dann eine leere Fläche ohne
    // Text und mischt sich in keine Zusicherung ein.
    useKo: () => ({ data: undefined, isLoading: true, isError: false, error: null }),
    useAudit: () => ok([]),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { LIBRARY_RESULT_LIMIT } from "../../apps/web/src/lib/libraryDisplay";
import { Library } from "../../apps/web/src/pages/Library";
import { eintragText, menueOeffnen, menueSchliessen } from "./support/bib-flaeche";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ================================================================================================
// 10.08.2026 — ZEITBOMBE ENTSCHAERFT.
// ================================================================================================
//
// Die Alters-Facette faechert nach ≤30 Tagen / ≤180 Tagen / ≤1 Jahr / aelter — gemessen an der
// ECHTEN Uhr. Die vier Fixtures trugen feste Daten und verteilten sich NUR ZUFAELLIG auf mehrere
// Faecher, naemlich solange „heute" nahe genug an ihnen lag. Ab 2027 waeren alle vier ins letzte
// Fach gefallen, die Achse haette nur noch einen Wert getragen und waere ausgeblendet worden —
// und R-14 waere rot geworden, ohne dass jemand etwas geaendert haette.
//
// Gefunden durch einen Lauf mit um zwei Jahre vorgestellter Uhr, nicht durch Lesen.
// Die Abstaende sind jetzt RELATIV und treffen ihre Faecher an jedem Tag gleich.
const TAG_MS = 24 * 60 * 60 * 1000;
const VOR_TAGEN = (n: number): string => new Date(Date.now() - n * TAG_MS).toISOString();
const ALTER_D30 = VOR_TAGEN(10); // Fach „≤ 30 Tage"
const ALTER_D180 = VOR_TAGEN(100); // Fach „≤ 180 Tage"
const ALTER_Y1 = VOR_TAGEN(300); // Fach „≤ 1 Jahr"
const ALTER_ALT = "2019-03-01T00:00:00.000Z"; // bewusst fest: SOLL immer im aeltesten Fach liegen

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Titel",
    statement: "",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 50,
    trust: 50,
    status: "validiert",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: ALTER_D30,
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

/**
 * Ein Bestand, der ALLE ZEHN Achsen mit Werten füllt — sonst prüfte das Inventar Gruppen, die
 * mangels Optionen gar nicht gezeichnet werden, und wäre grün, ohne etwas zu belegen.
 */
function vielfaeltigerBestand(): KnowledgeObject[] {
  return [
    ko({
      id: "a",
      title: "Alpha Ventil",
      category: "Anlage 1",
      tags: ["ventil"],
      author: "anna",
      confidentiality: "intern",
      type: "best_practice",
      trust: 90,
      createdAt: ALTER_D30,
    }),
    ko({
      id: "b",
      title: "Beta Pumpe",
      category: "Anlage 2",
      tags: ["pumpe"],
      author: "bert",
      confidentiality: "vertraulich",
      type: "technik",
      trust: 30,
      createdAt: ALTER_ALT,
    }),
    ko({
      id: "c",
      title: "Gamma Reifen",
      category: "Fuhrpark",
      tags: ["reifen"],
      author: "clara",
      confidentiality: "intern",
      type: "best_practice",
      trust: 60,
      status: "offen",
      createdAt: ALTER_Y1,
    }),
    // Der vierte Beitrag trägt die beiden Achsen, die sonst nur EINEN Wert hätten und deshalb gar
    // nicht gezeichnet würden: `origin` (Demo/Nicht-Demo über `demoSeed`) und `language` (die
    // Ableitung `languageFromTitle` macht aus einem englischen Titel „en"). Ohne ihn wäre das
    // Inventar unvollständig, ohne dass es auffiele — genau die Art stiller Lücke, die dieser
    // Anker verhindern soll.
    ko({
      id: "d",
      title: "Delta Tyre Change Procedure And Safety Notes",
      category: "Fuhrpark",
      tags: ["reifen"],
      author: "dave",
      confidentiality: "intern",
      type: "best_practice",
      trust: 0,
      demoSeed: true,
      createdAt: ALTER_D180,
    } as Partial<KnowledgeObject>),
  ];
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let currentUrl = "";

function UrlProbe(): null {
  const loc = useLocation();
  currentUrl = `${loc.pathname}${loc.search}`;
  return null;
}

function mount(entry = "/bibliothek"): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: [entry] },
          createElement(UrlProbe),
          createElement(Library),
        ),
      ),
    );
  });
}

function res(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

// JOB 3063 (H4): die Facettenschiene ist in das Menü „Filter ▾" gezogen (AUFTRAG 3063 §5a). Eine
// Facetten-Option ist damit ein Menüeintrag mit `role="menuitemcheckbox"`, dessen Beschriftung
// „<Wert> · <Anzahl>" lautet. Die FÄHIGKEIT ist dieselbe; nur der Ort und die Rolle sind neu.
/** Beide Menüs der Liste — die Abteilung/Kategorie steht in „Bereich", alles Übrige in „Filter". */
const FACETTEN_MENUES = ["bib-menue-bereich", "bib-menue-filter"] as const;

function optionRow(value: string): HTMLElement | undefined {
  for (const testId of FACETTEN_MENUES) {
    const menue = menueOeffnen(container, testId);
    const treffer = [...menue.querySelectorAll('[role="menuitemcheckbox"]')].find((e) => {
      const t = eintragText(e);
      return t === value || t.startsWith(`${value} · `);
    });
    if (treffer instanceof HTMLElement) {
      return treffer;
    }
    menueSchliessen(container, testId);
  }
  return undefined;
}

function clickOption(value: string): void {
  const eintrag = optionRow(value);
  if (!(eintrag instanceof HTMLButtonElement)) {
    throw new Error(`Option „${value}“ fehlt; DOM: ${text()}`);
  }
  act(() => {
    eintrag.click();
  });
  for (const testId of FACETTEN_MENUES) {
    menueSchliessen(container, testId);
  }
}

/** Der sichtbare Text des offenen Filtermenüs — dort stehen seit H4 die Achsen. */
function filterMenueText(): string {
  return (menueOeffnen(container, "bib-menue-filter").textContent ?? "").replace(/\s+/g, " ");
}

function setDateInput(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Die ZEHN Achsen, wörtlich aus `Library.tsx` `LIBRARY_FILTER_CONFIGS` (`:116-127`). */
const PRIMAER = [
  "lib.facet.maturity",
  "lib.facet.category",
  "lib.facet.tag",
  "lib.facet.confidentiality",
  "lib.facet.author",
];
const SEKUNDAER = [
  "lib.facet.origin",
  "lib.facet.type",
  "lib.facet.language",
  "lib.facet.age",
  "lib.facet.trust",
];

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  bestand.kos = vielfaeltigerBestand();
  currentUrl = "";
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  window.localStorage.clear();
});

// ==================================================================================================
// JOB 3063 (H4) — DER ANKER HÄLT DIE FÄHIGKEITEN, NICHT DIE SCHIENE.
// ==================================================================================================
//
// Diese Datei sagt in ihrem eigenen Kopf, wie sie gelesen werden will: „NAMENTLICHES INVENTAR: jede
// FÄHIGKEIT … einzeln nachgewiesen … Das ist strenger als ein Schnappschuss (es prüft Verhalten,
// nicht Markup) und überlebt jede Umgestaltung, die nichts kaputt macht."
//
// JOB 3063 ist genau so eine Umgestaltung: die Facettenschiene, die Sortier-Auswahl, die
// Gruppierungsreihe und der Knopf „Weitere laden" sind aus dem Sichtfeld in Menüs bzw. ins
// Nachladen am Listenende gezogen (AUFTRAG 3063 §5a, Eigentümerentscheidung 04.09.2026). Die zehn
// Achsen, die Abhängigkeit `category → tag`, der Bereichsfilter mit eigenen URL-Parametern,
// Sortierung, Gruppierung, gemerkte Sichten, das aufziehbare Fenster und die Leerzustände sind
// ALLE noch da — und werden hier weiter einzeln nachgewiesen, an ihrem neuen Ort.
//
// WAS DIESER ANKER NICHT MEHR BEHAUPTET: die AUFTEILUNG „fünf primär sichtbar, fünf hinter
// ‚Weitere Filter'". Sie war eine Aussage über ein Bauteil, das es nicht mehr gibt. Im Menü stehen
// alle zehn gleichrangig als Untermenüs.
describe("PRO 381 · R-14 — bei inaktiver Ortsschicht ist die Bibliothek unverändert", () => {
  it("R-14 (a) BEWAHRUNGSANKER: alle zehn Achsen stehen im Menü „Filter“", () => {
    mount();
    const menue = filterMenueText();
    for (const key of [...PRIMAER, ...SEKUNDAER]) {
      expect(menue, `Achse „${key}“ fehlt im Filtermenü`).toContain(res(key));
    }
    expect(PRIMAER.length + SEKUNDAER.length).toBe(10);
  });

  it("R-14 (b) BEWAHRUNGSANKER: die Abhängigkeit `category → tag` trägt weiter", () => {
    mount();
    // Ohne Auswahl stehen die Schlagwörter beider Kategorien zur Verfügung.
    expect(optionRow("ventil")).toBeTruthy();
    expect(optionRow("pumpe")).toBeTruthy();
    // Kategorie „Anlage 1“ wählen → nur deren Schlagwort bleibt (die EINZIGE modellierte
    // Abhängigkeit der Schiene, `Library.tsx:137`).
    clickOption("Anlage 1");
    expect(optionRow("ventil")).toBeTruthy();
    expect(optionRow("pumpe")).toBeFalsy();
  });

  it("R-14 (c) BEWAHRUNGSANKER: der Bereichsfilter läuft weiter über EIGENE URL-Parameter", () => {
    mount();
    expect(filterMenueText()).toContain(res("lib.facet.rangeLabel"));
    const felder = [...container.querySelectorAll('input[type="date"]')];
    expect(felder, "der Bereichsfilter hat keine zwei Datumsfelder mehr").toHaveLength(2);

    const von = felder[0];
    if (!(von instanceof HTMLInputElement)) {
      throw new Error("Bereichsfeld „von“ fehlt");
    }
    setDateInput(von, "2026-01-01");
    // Der Präzedenzfall des ganzen Vertrags: ein Bereich ist kein Facettenwert, er hat einen
    // EIGENEN Parameter neben der Facettenauswahl (`Library.tsx:142-145`). Der Ort folgt ihm.
    expect(currentUrl).toContain("von=2026-01-01");
    expect(currentUrl).not.toContain("category=");
    // Der ALTE Bestand fällt heraus, der neue bleibt — der Filter wirkt wirklich.
    expect(text()).not.toContain("Beta Pumpe");
    expect(text()).toContain("Alpha Ventil");
  });

  it("R-14 (d) BEWAHRUNGSANKER: Sortierung, Gruppierung und gemerkte Sichten stehen", () => {
    mount();
    // Sortierung und Gruppierung: im Menü „Filter", je ein Untermenü mit den vollen Werten.
    const filter = filterMenueText();
    expect(filter).toContain(res("lib.sort.label"));
    expect(filter).toContain(res("lib.groupBy.label"));
    const eintraege = [
      ...menueOeffnen(container, "bib-menue-filter").querySelectorAll(
        '[role="menuitem"], [role="menuitemcheckbox"]',
      ),
    ].map((e) => eintragText(e));
    // Vier Sortierungen und fünf Gruppierungen — die Werte, die vorher als Reihen dastanden.
    for (const key of [
      "lib.sort.relevance",
      "lib.sort.title",
      "lib.sort.trust",
      "lib.sort.recent",
    ]) {
      expect(eintraege, `Sortierung „${key}“ fehlt`).toContain(res(key));
    }
    expect(eintraege, "die Gruppierung „keine“ fehlt").toContain(res("lib.groupBy.none"));
    menueSchliessen(container, "bib-menue-filter");
    // Gemerkte Sichten: im Menü „…" der Liste.
    expect(
      (menueOeffnen(container, "bib-liste-menue").textContent ?? "").replace(/\s+/g, " "),
    ).toContain(res("lib.menue.sichten"));
  });

  it("R-14 (e) BEWAHRUNGSANKER: das aufziehbare Fenster der Trefferliste bleibt aufziehbar", () => {
    bestand.kos = Array.from({ length: LIBRARY_RESULT_LIMIT + 20 }, (_unused, i) =>
      ko({ id: `k${i}`, title: `Treffer ${i}` }),
    );
    mount();
    expect(LIBRARY_RESULT_LIMIT).toBe(200);
    // JOB 3063: das Fenster wächst am Listenende von selbst weiter, statt über einen Knopf
    // „Weitere N laden" (AUFTRAG §5, Lieferung 2). Der Auslöser ist `amListenende`.
    //
    // WAS jsdom HIER TUT, ehrlich benannt: es kennt keine Layouthöhen — `scrollTop`,
    // `clientHeight` und `scrollHeight` sind alle 0, `amListenende` ist damit dauerhaft wahr, und
    // das Fenster wächst ohne Zutun bis zum Ende. Gemessen wird deshalb genau das WACHSTUM ÜBER DIE
    // ERSTE SEITE HINAUS (220 > 200) — die Fähigkeit, um die es geht. Die Bindung an die
    // Scrollposition selbst ist eine Layoutfrage und steht als reine Rechnung in
    // `tests/design/h4-zustand.test.ts` (`amListenende`) sowie in Chromium in
    // `tests/design/zielbild-h4-bibliothek.test.ts`.
    const zeilen = container.querySelectorAll('[data-testid="bib-zeile"]').length;
    expect(zeilen, "das Fenster ist auf der ersten Seite stehengeblieben").toBe(
      LIBRARY_RESULT_LIMIT + 20,
    );
    expect(zeilen).toBeGreaterThan(LIBRARY_RESULT_LIMIT);
    expect(text()).toContain("Treffer 210");
  });

  it("R-14 (f) BEWAHRUNGSANKER: der ehrliche Leerzustand bleibt", () => {
    bestand.kos = [];
    mount();
    expect(text()).toContain(res("lib.liste.leer"));
  });

  it("R-14 (g) BEWAHRUNGSANKER: heute existiert KEINE Ortsschicht — kein Pfad, kein Umschalter", () => {
    // Der Iststand, gegen den „additiv“ behauptet wird (PLAN 378 §2.1 `I-1`, §3): es gibt im
    // ganzen Web-Bestand kein Ortsfeld und kein Breadcrumb-Bauteil. Diese Zeile hält den Nullpunkt
    // fest — sie wird GRÜN BLEIBEN, solange PRO 381 gilt, und ist genau die Zeile, die eine
    // spätere Welle bewusst ändern muss, wenn sie die Ortszeile montiert.
    mount(`/bibliothek?${ORT_URL_PARAM}=raum-1`);
    expect(container.querySelectorAll("nav[aria-label]")).toHaveLength(0);
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
    // Und der Fremdparameter in der Adresse ändert die Treffermenge nicht — „kein Raum“ heisst
    // „gesamtes Unternehmen“, nie „leerer Raum“.
    expect(text()).toContain("Alpha Ventil");
    expect(text()).toContain("Beta Pumpe");
    expect(text()).toContain("Gamma Reifen");
    expect(text()).toContain("Delta Tyre Change");
  });
});
