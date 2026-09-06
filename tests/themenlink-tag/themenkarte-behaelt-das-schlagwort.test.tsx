// @vitest-environment jsdom
// ================================================================================================
// JOB 3115 · UX-02b — EIN FILTER AUS DER ADRESSE WIRD NICHT AM VERALTETEN BESTAND GEMESSEN.
// ================================================================================================
//
// DER BEFUND (Codex `CODEX-ANTWORT-35 §5`, `-36 §2`, Messung `R-0459` an 1.113): der Klick auf eine
// Themenkarte im Wissensnetz führt nach `/bibliothek?tag=<Schlagwort>`. Ist das Schlagwort erst
// NACH dem letzten Bestandsabruf entstanden, stand dort die volle Liste (32 statt 2), ohne
// gesetzten Filter — derselbe Link in einem frischen Fenster war korrekt.
//
// DIE URSACHE, und sie ist eine ZEITFRAGE, keine Wertefrage: die Fläche prüft den Filter aus der
// Adresse gegen die im Bestand vorkommenden Werte (`pruneFacetSelectionToKnownValues`, die Grenze
// aus mega11 Block C — ein eingeschleuster Wert darf nicht in einer gespeicherten Sicht landen).
// Ausgelöst wurde diese Prüfung, sobald `all.data !== undefined` war — also auch von einem
// ZWISCHENGESPEICHERTEN Stand, der das junge Schlagwort noch gar nicht kennen konnte. Bei einer
// Navigation innerhalb der Anwendung ist genau das der Normalfall.
//
// WIE HIER GEMESSEN WIRD (Bauform aus `tests/ablage-kontext/adresse-traegt-suche-und-eintrag.test.tsx`):
//
// (A) ECHTER QueryClient, TEILMOCK der Hooks. Der Unterschied zwischen „Zwischenspeicher" und
//     „Serverantwort" ist der GEGENSTAND dieser Datei — er lässt sich nur mit echtem
//     Zwischenspeicher messen. Ein Standbild-Mock (`{ data, isStale }`) würde die Frage wegdefinieren.
//
// (B) DER ALTERSUNTERSCHIED WIRD ECHT GESETZT: `setQueryData(..., { updatedAt })` legt den Stand
//     mit seinem Alter in den Speicher. Mit einer Frist von 30 s ist ein 60 s alter Stand beim
//     Montieren VERALTET — react-query fragt nach, und genau in dieser Lücke lief die Prüfung.
//     Die Frist steht hier als eigener Sollwert; `apps/web/src/main.tsx` wird nicht gelesen.
//
// (C) DER „SERVER" ANTWORTET MIT DEM NEUEN BESTAND. Der Zwischenspeicher trägt den alten. Damit
//     fällt „was der Client schon hat" und „was es wirklich gibt" auseinander — ohne diesen
//     Unterschied misst die Datei nichts.
//
// (D) UNABHÄNGIGE SOLLWERTE. Parametername, Schlagwort und Testanker stehen als Literale hier und
//     werden nicht aus der Produktquelle gelesen (Korrekturpflicht JOB 3034 R2).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

/** (D) Die Namen und Anker, unabhängig von der Produktquelle hingeschrieben. */
const TAG_PARAM = "tag";
const SCHLAGWORT = "Ventilpruefung";
const UNBEKANNTES_SCHLAGWORT = "gibt-es-nicht";
const BEKANNTES_SCHLAGWORT = "Abluft";
const ANKER = {
  liste: "bib-liste",
  hinweis: "auffrischung-fehlgeschlagen",
  hinweisErneut: "bib-hinweis-erneut",
  menuePunkte: "bib-liste-menue",
  menueFilter: "bib-menue-filter",
  sichtName: "bib-sichtname",
  sichtSpeichern: "bib-sicht-speichern",
  leer: "bib-leer",
} as const;
/** Der Satz des Listen-Fehlerzweigs (`BibliothekListe.tsx`) — als eigener Sollwert, s. (D). */
const LISTEN_FEHLER_SATZ = "Die Liste ließ sich nicht laden.";

/** (B) Die Frist, gegen die „veraltet" hier gemessen wird — der eigene Sollwert dieser Datei. */
const FRIST_MS = 30_000;

function ko(overrides: Record<string, unknown>): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Titel",
    statement: "Ohne Belang fuer die Suche.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "validiert",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    confidentiality: "intern",
    createdAt: "2026-08-12T00:00:00.000Z",
    history: [{ version: 1, at: "2026-08-12T00:00:00.000Z", author: "u9", note: "erstellt" }],
    comments: [],
    attachments: [],
    sources: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

// Der Stand, den die laufende Sitzung schon geholt hat: drei Einträge, KEINER trägt das Schlagwort.
const ALT = [
  ko({ id: "a", title: "Abluft A1 messen", tags: ["Abluft"] }),
  ko({ id: "b", title: "Filter F2 wechseln", tags: ["Abluft"] }),
  ko({ id: "c", title: "Motor M3 schmieren", tags: ["Antrieb"] }),
];
// Zwei Einträge sind seither entstanden, beide mit dem jungen Schlagwort. Sie stehen am Server,
// nicht im Zwischenspeicher — der Unterschied, um den es geht.
const JUNG = [
  ko({ id: "n1", title: "Ventil V7 pruefen", tags: [SCHLAGWORT] }),
  ko({ id: "n2", title: "Ventil V8 pruefen", tags: [SCHLAGWORT] }),
];
const NEU = [...ALT, ...JUNG];
const JUNGE_TITEL = JUNG.map((k) => k.title).sort();
const ALLE_TITEL = NEU.map((k) => k.title).sort();

// Jeder wirklich hinausgegangene Ruf. Daran hängt F7.
const netz = vi.hoisted(() => ({ kos: 0, suche: 0 }));
/**
 * Was der „Server" gerade tut — je Fall gesetzt. `kosTor` hält den Bestandsabruf KONTROLLIERT offen
 * (JOB 3115 R2, Korrekturpflicht 2): nur so lässt sich messen, was die Fläche zeigt, WÄHREND noch
 * nichts feststeht. Ein sofort auflösender Abruf lässt dieses Fenster gar nicht entstehen.
 */
const lage = vi.hoisted(() => ({
  kosScheitert: false,
  kosTor: null as Promise<void> | null,
}));

vi.mock("../../apps/web/src/api/hooks", async (importOriginal) => {
  const echt = await importOriginal<Record<string, unknown>>();
  const rq = await import("../../apps/web/node_modules/@tanstack/react-query");
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  const leer = () => ok([]);
  const passt = (k: KnowledgeObject, q: string): boolean =>
    q.length === 0 ||
    `${k.title} ${k.statement} ${k.category}`.toLowerCase().includes(q.toLowerCase());
  return {
    ...echt,
    // (A)/(B) Echte Abfrage mit echter Frist — nur die Antwort ist gesteuert.
    useKos: () =>
      rq.useQuery({
        queryKey: ["kos", undefined],
        queryFn: async () => {
          netz.kos += 1;
          if (lage.kosTor) {
            await lage.kosTor;
          }
          if (lage.kosScheitert) {
            throw new Error("Bestand nicht erreichbar");
          }
          return NEU;
        },
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: FRIST_MS,
      }),
    // (C) Die Suche ist eine eigene Abfrage und kennt den neuen Bestand — sie ist nie die Ursache.
    useLibrarySearch: (params: { q?: string }) =>
      rq.useQuery({
        queryKey: ["library", "search", params],
        queryFn: async () => {
          netz.suche += 1;
          return NEU.filter((k) => passt(k, params.q ?? ""));
        },
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: FRIST_MS,
      }),
    useKo: (id: string) =>
      rq.useQuery({
        queryKey: (echt.koQueryKey as (id: string) => readonly unknown[])(id),
        queryFn: async () => {
          const k = NEU.find((x) => x.id === id);
          if (!k) {
            throw new Error("404");
          }
          return k;
        },
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: Number.POSITIVE_INFINITY,
      }),
    useAudit: leer,
    useConflicts: leer,
    useDirectory: leer,
    useEigeneBefunde: leer,
    useKoEvidence: leer,
    useKoNeighbors: leer,
    useKoVersions: leer,
    useLifecyclePending: leer,
    useExternalPolicy: () => ok({ stage: "blocked" }),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u9", role: "admin" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "admin" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { readLibraryViews } from "../../apps/web/src/lib/libraryFacets";
import { Library } from "../../apps/web/src/pages/Library";
import {
  listenZaehler,
  menueOeffnen,
  menueSchliessen,
  tippe,
  waehleImMenue,
  zeilenTitel,
} from "../library/support/bib-flaeche";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

/** Die Adresse des gemounteten Baums, sichtbar gemacht (`MemoryRouter` führt seine eigene). */
function Adresse(): JSX.Element {
  return createElement("span", { "data-adresse": useLocation().search });
}

async function ruhe(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

/**
 * Montiert die Bibliothek an der gegebenen Adresse. `keim` legt VOR dem ersten Zeichnen einen Stand
 * in den echten Zwischenspeicher — genau die Lage nach einer Navigation innerhalb der Anwendung.
 */
async function montiere(eingang: string, keim?: (qc: QueryClient) => void): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  keim?.(qc);
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [eingang] }, [
          createElement(Adresse, { key: "a" }),
          createElement(Library, { key: "l" }),
        ]),
      ),
    );
  });
  await ruhe();
}

/** Ein Bestand im Zwischenspeicher, mit seinem Alter. `alterMs` misst gegen `FRIST_MS`. */
const bestandImSpeicher =
  (kos: readonly KnowledgeObject[], alterMs: number) =>
  (qc: QueryClient): void => {
    qc.setQueryData(["kos", undefined], kos, { updatedAt: Date.now() - alterMs });
  };

function abbauen(): void {
  if (root) {
    const alt = root;
    act(() => {
      alt.unmount();
    });
    root = null;
  }
  container?.remove();
}

const adresse = (): string =>
  container.querySelector("[data-adresse]")?.getAttribute("data-adresse") ?? "";
const adressWert = (name: string): string | null => new URLSearchParams(adresse()).get(name);

/** Die Beschriftung des Filtermenüs — sie trägt die Zahl der aktiven Wahlen als TEXT („Filter · 1"). */
function filterMenueText(): string {
  const el = container.querySelector(`[data-testid="${ANKER.menueFilter}"]`);
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error("Filtermenü fehlt");
  }
  return (el.textContent ?? "").trim();
}

function da(testId: string): boolean {
  return container.querySelector(`[data-testid="${testId}"]`) !== null;
}

function knopf(testId: string): HTMLButtonElement {
  const el = container.querySelector(`[data-testid="${testId}"]`);
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`Schaltfläche „${testId}" fehlt`);
  }
  return el;
}

/** Der Speicherknopf im Menü „…" — er steht nur, wenn überhaupt eine Wahl getroffen ist. */
function speicherKnopf(name: string): HTMLButtonElement {
  menueOeffnen(container, ANKER.menuePunkte);
  const feld = container.querySelector(`#${ANKER.sichtName}`);
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error("Namensfeld der gespeicherten Sicht fehlt");
  }
  tippe(feld, name);
  return knopf(ANKER.sichtSpeichern);
}

/**
 * Der Fehlerzweig der LISTE (`BibliothekListe.tsx`: Satz plus Wiederholknopf) — er trägt kein
 * eigenes `data-testid`, wird hier also über seinen Satz gefunden. `null`, wenn er nicht dasteht.
 */
function listenFehlerKnopf(): HTMLButtonElement | null {
  const liste = container.querySelector(`[data-testid="${ANKER.liste}"]`);
  const satz = [...(liste?.querySelectorAll("p") ?? [])].find(
    (p) => (p.textContent ?? "").trim() === LISTEN_FEHLER_SATZ,
  );
  const knopf = satz?.parentElement?.querySelector("button");
  return knopf instanceof HTMLButtonElement ? knopf : null;
}

/** Ein Tor, das den Bestandsabruf offen hält, bis der Test es öffnet. */
function torAufmachen(): () => void {
  let oeffnen: () => void = () => {};
  lage.kosTor = new Promise<void>((r) => {
    oeffnen = r;
  });
  return () => {
    lage.kosTor = null;
    oeffnen();
  };
}

beforeEach(() => {
  netz.kos = 0;
  netz.suche = 0;
  lage.kosScheitert = false;
  lage.kosTor = null;
  window.localStorage.clear();
});

afterEach(() => {
  abbauen();
});

// ------------------------------------------------------------------------------------------------
// F1 / F7 — DER BEFUND
// ------------------------------------------------------------------------------------------------
describe("JOB 3115 · F1 — der Themenkarten-Link behält sein Schlagwort", () => {
  it("F1: veralteter Zwischenspeicher, junges Schlagwort — die Liste zeigt die zwei Treffer", async () => {
    await montiere(
      `/bibliothek?${TAG_PARAM}=${encodeURIComponent(SCHLAGWORT)}`,
      bestandImSpeicher(ALT, 60_000),
    );

    expect(zeilenTitel(container).sort(), "die volle Liste statt der zwei Treffer").toEqual(
      JUNGE_TITEL,
    );
    expect(adressWert(TAG_PARAM), "das Schlagwort ist aus der Adresse verschwunden").toBe(
      SCHLAGWORT,
    );
    expect(filterMenueText(), "die Filteranzeige weist keine aktive Wahl aus").toMatch(/·\s*1$/);
    expect(listenZaehler(container), "der Zähler nennt nicht die Trefferzahl").toBe(2);
  });

  it("F7: dieser Ablauf kostet GENAU EINEN zusätzlichen Bestandsabruf", async () => {
    await montiere(
      `/bibliothek?${TAG_PARAM}=${encodeURIComponent(SCHLAGWORT)}`,
      bestandImSpeicher(ALT, 60_000),
    );

    expect(netz.kos, "es lief ein zweiter Abruf neben dem ersten").toBe(1);
  });
});

// ------------------------------------------------------------------------------------------------
// F2 — DIE WERTPRÜFUNG BLEIBT: EIN WERT, DEN ES NIRGENDS GIBT, FÄLLT WEG
// ------------------------------------------------------------------------------------------------
describe("JOB 3115 · F2 — ein wirklich unbekanntes Schlagwort fällt weiterhin weg", () => {
  it("F2: nach dem bestätigten Bestand ist die Dimension offen — kein Filter, kein No-Match", async () => {
    await montiere(
      `/bibliothek?${TAG_PARAM}=${encodeURIComponent(UNBEKANNTES_SCHLAGWORT)}`,
      bestandImSpeicher(ALT, 60_000),
    );

    // Offen heißt: die volle Liste steht da (und nicht null Treffer, wie bei No-Match).
    expect(zeilenTitel(container).sort()).toEqual(ALLE_TITEL);
    expect(filterMenueText(), "der unbekannte Wert wurde zu einem echten Filter").not.toMatch(/·/);
    expect(adressWert(TAG_PARAM), "der weggefallene Wert steht noch in der Adresse").toBeNull();
    expect(da(ANKER.leer), "es steht ein Leerzustand da").toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
// F3 / F4 — DIE BEIDEN HÄLFTEN DES WARTENS
// ------------------------------------------------------------------------------------------------
describe("JOB 3115 · F3/F4 — kein Warten ohne Ende, kein zu frühes Prüfen", () => {
  it("F3: ein FRISCHER Zwischenspeicher wird gar nicht erst nachgefragt — und trotzdem geprüft", async () => {
    await montiere(
      `/bibliothek?${TAG_PARAM}=${encodeURIComponent(SCHLAGWORT)}`,
      bestandImSpeicher(NEU, 0),
    );

    expect(netz.kos, "der frische Stand wurde ohne Not nachgefragt").toBe(0);
    expect(zeilenTitel(container).sort()).toEqual(JUNGE_TITEL);
    // Der Zähler nennt erst eine Zahl, wenn die Auswahl feststeht — er ist hier der Beleg, dass
    // die Fläche NICHT in einem Ladezustand hängen geblieben ist.
    expect(listenZaehler(container), "die Fläche hängt im Ladezustand").toBe(2);
  });

  it("F4: leerer Zwischenspeicher (direkter Link) — unverändert grün", async () => {
    await montiere(`/bibliothek?${TAG_PARAM}=${encodeURIComponent(SCHLAGWORT)}`);

    expect(netz.kos).toBe(1);
    expect(zeilenTitel(container).sort()).toEqual(JUNGE_TITEL);
    expect(listenZaehler(container)).toBe(2);
  });
});

// ------------------------------------------------------------------------------------------------
// F5 — SCHEITERT DER ABRUF, WIRD DER FILTER NICHT STILL WEGGEWORFEN
// ------------------------------------------------------------------------------------------------
describe("JOB 3115 · F5 — eine gescheiterte Auffrischung macht aus dem Link keine volle Liste", () => {
  it("F5: der Filter bleibt wirksam, der Stand-Satz steht da, der Wiederholweg holt die Prüfung nach", async () => {
    lage.kosScheitert = true;
    await montiere(
      `/bibliothek?${TAG_PARAM}=${encodeURIComponent(SCHLAGWORT)}`,
      bestandImSpeicher(ALT, 60_000),
    );

    // Nur „wirklich gerufen und wirklich gescheitert" — KEINE Zahl: an einem gescheiterten Stand
    // hängen zwei Beobachter (Liste und Lesefläche), und der zweite findet beim Montieren einen
    // veralteten Bestand vor und fragt selbst nach. Das ist bestehendes Verhalten; die Rufzählung
    // steht in F7, wo der Abruf durchkommt.
    expect(netz.kos, "der Abruf ist gar nicht hinausgegangen").toBeGreaterThanOrEqual(1);
    expect(zeilenTitel(container).sort(), "der Filter wurde still weggeworfen").toEqual(
      JUNGE_TITEL,
    );
    expect(adressWert(TAG_PARAM)).toBe(SCHLAGWORT);
    expect(da(ANKER.hinweis), "der Stand-Satz zur gescheiterten Auffrischung fehlt").toBe(true);
    expect(da(ANKER.hinweisErneut), "der Wiederholknopf fehlt").toBe(true);
    // Solange nichts bestätigt ist, nennt die Fläche keine Trefferzahl.
    expect(listenZaehler(container)).toBeNull();

    lage.kosScheitert = false;
    await act(async () => {
      knopf(ANKER.hinweisErneut).click();
    });
    await ruhe();

    expect(da(ANKER.hinweis), "der Satz steht noch da, obwohl der Abruf durchkam").toBe(false);
    expect(zeilenTitel(container).sort()).toEqual(JUNGE_TITEL);
    expect(listenZaehler(container), "die Prüfung wurde nicht nachgeholt").toBe(2);
    expect(filterMenueText()).toMatch(/·\s*1$/);
  });
});

// ------------------------------------------------------------------------------------------------
// F6 — EIN UNGEPRÜFTER WERT ERREICHT KEINE GESPEICHERTE SICHT
// ------------------------------------------------------------------------------------------------
describe("JOB 3115 · F6 — der Merken-Knopf wartet auf den bestätigten Bestand", () => {
  it("F6: mit ungeprüftem Keim gesperrt, nach dem bestätigten Bestand speichert es die geprüfte Auswahl", async () => {
    lage.kosScheitert = true;
    await montiere(
      `/bibliothek?${TAG_PARAM}=${encodeURIComponent(SCHLAGWORT)}`,
      bestandImSpeicher(ALT, 60_000),
    );

    expect(
      speicherKnopf("Ventile").disabled,
      "eine ungeprüfte Auswahl ließe sich in eine gespeicherte Sicht schreiben",
    ).toBe(true);
    menueSchliessen(container, ANKER.menuePunkte);

    lage.kosScheitert = false;
    await act(async () => {
      knopf(ANKER.hinweisErneut).click();
    });
    await ruhe();

    const speichern = speicherKnopf("Ventile");
    expect(speichern.disabled, "der Knopf bleibt gesperrt, obwohl der Bestand bestätigt ist").toBe(
      false,
    );
    act(() => {
      speichern.click();
    });

    const sichten = readLibraryViews(window.localStorage, "u9");
    expect(sichten.map((v) => v.name)).toEqual(["Ventile"]);
    expect((sichten[0]?.state as { facetSel?: unknown }).facetSel).toEqual({
      [TAG_PARAM]: [SCHLAGWORT],
    });
  });
});

// ------------------------------------------------------------------------------------------------
// F8 — KORREKTURPFLICHT 1 (BEN, RUNDE 1): EIN FILTERKLICK IST KEINE BESTÄTIGUNG
// ------------------------------------------------------------------------------------------------
// Runde 1 hat den Keim beim ersten Griff ins Filtermenü VERBRAUCHT und seine ungeprüften Restwerte
// nach `facetSel` geschrieben. Damit war die Grenze aus mega11 Block C umgangen: ein eingeschleuster
// Wert stand nach einem Klick auf eine ganz andere Wahl im Sichtenspeicher. Der Fall misst beide
// Hälften — die Sperre HÄLT, und die Wahl des Menschen überlebt die nachgeholte Prüfung.
describe("JOB 3115 · F8 — ein Griff an die Filter winkt keinen ungeprüften Wert durch", () => {
  it("F8: Mehrfachauswahl plus Filterklick vor dem bestätigten Bestand erreicht keine gespeicherte Sicht", async () => {
    lage.kosScheitert = true;
    await montiere(
      `/bibliothek?${TAG_PARAM}=${encodeURIComponent(UNBEKANNTES_SCHLAGWORT)}&${TAG_PARAM}=${encodeURIComponent(SCHLAGWORT)}`,
      bestandImSpeicher(ALT, 60_000),
    );

    // Ausgangslage: der Filter aus der Adresse wirkt (F5), geprüft ist er nicht.
    expect(zeilenTitel(container).sort()).toEqual(JUNGE_TITEL);
    expect(da(ANKER.hinweis)).toBe(true);

    // DER GRIFF: eine zweite, im Bestand vorkommende Wahl dazu. Der unbekannte Wert bleibt liegen.
    waehleImMenue(container, ANKER.menueFilter, BEKANNTES_SCHLAGWORT);
    expect(zeilenTitel(container).sort(), "die Wahl des Menschen wirkt nicht").toEqual(
      [
        ...JUNGE_TITEL,
        ...ALT.filter((k) => k.tags.includes(BEKANNTES_SCHLAGWORT)).map((k) => k.title),
      ].sort(),
    );

    expect(
      speicherKnopf("Meine Sicht").disabled,
      "ein Filterklick hat den ungeprüften Wert speicherfähig gemacht",
    ).toBe(true);
    menueSchliessen(container, ANKER.menuePunkte);

    // Jetzt kommt der Bestand durch — und erst er entscheidet über die Werte.
    lage.kosScheitert = false;
    await act(async () => {
      knopf(ANKER.hinweisErneut).click();
    });
    await ruhe();

    const speichern = speicherKnopf("Meine Sicht");
    expect(speichern.disabled, "der Knopf bleibt gesperrt trotz bestätigtem Bestand").toBe(false);
    act(() => {
      speichern.click();
    });

    const sichten = readLibraryViews(window.localStorage, "u9");
    const gespeichert = (sichten[0]?.state as { facetSel?: Record<string, string[]> }).facetSel;
    expect(
      gespeichert?.[TAG_PARAM] ?? [],
      "der ungeprüfte Wert steht im Sichtenspeicher, oder die Wahl des Menschen wurde überschrieben",
    ).not.toContain(UNBEKANNTES_SCHLAGWORT);
    expect([...(gespeichert?.[TAG_PARAM] ?? [])].sort()).toEqual(
      [BEKANNTES_SCHLAGWORT, SCHLAGWORT].sort(),
    );
  });
});

// ------------------------------------------------------------------------------------------------
// F9 — KORREKTURPFLICHT 2 (BEN, RUNDE 1): SCHWEIGEN HEISST KEINE ZEILE
// ------------------------------------------------------------------------------------------------
// Runde 1 hat der Liste nur `laedt` gereicht; `BibliothekListe` zeichnet ihre Posten aber
// bedingungslos. Gemessen wird deshalb NICHT die Prop, sondern was dasteht: Zeilen, Leerzustand,
// Zähler — bei einem kontrolliert offen gehaltenen Bestandsabruf.
describe("JOB 3115 · F9 — während der Bestand aussteht, steht keine Zeile da", () => {
  it("F9: offener Bestandsabruf — null Zeilen, kein Leerzustand, keine Zahl; danach die zwei Treffer", async () => {
    const oeffnen = torAufmachen();
    await montiere(
      `/bibliothek?${TAG_PARAM}=${encodeURIComponent(SCHLAGWORT)}`,
      bestandImSpeicher(ALT, 60_000),
    );

    expect(
      zeilenTitel(container),
      "die ungefilterte Vollmenge steht als fertige Antwort da",
    ).toEqual([]);
    expect(da(ANKER.leer), "ein Leerzustand behauptet ein gemessenes Nichts").toBe(false);
    expect(listenZaehler(container), "der Zähler nennt eine Zahl, die auf nichts steht").toBeNull();

    await act(async () => {
      oeffnen();
    });
    await ruhe();

    expect(zeilenTitel(container).sort()).toEqual(JUNGE_TITEL);
    expect(listenZaehler(container), "die Fläche hängt im Ladezustand").toBe(2);
  });
});

// ------------------------------------------------------------------------------------------------
// F10 — KORREKTURPFLICHT 3 (BEN, RUNDE 1): DER BESTANDS-ERSTFEHLER GEHÖRT IN DEN LISTENFEHLER
// ------------------------------------------------------------------------------------------------
// Ohne Zwischenspeicher greift `auffrischungGescheitert` nicht: es gibt keinen Stand, der stehen
// bliebe. Runde 1 wartete in dieser Lage endlos. Der Fall verlangt den vorhandenen Fehlerzweig samt
// Wiederholweg — und danach die geprüfte Auswahl.
describe("JOB 3115 · F10 — ein Bestands-Erstfehler ohne Zwischenspeicher sagt es und bietet den Weg zurück", () => {
  it("F10: Suche erfolgreich, Bestand gescheitert — Fehlersatz statt Rückfall-Liste, Wiederholen führt heraus", async () => {
    lage.kosScheitert = true;
    await montiere(`/bibliothek?${TAG_PARAM}=${encodeURIComponent(SCHLAGWORT)}`);

    expect(netz.suche, "die Suche ist gar nicht gelaufen").toBeGreaterThanOrEqual(1);
    const erneut = listenFehlerKnopf();
    expect(erneut, "der Listenfehler samt Wiederholknopf fehlt").not.toBeNull();
    expect(zeilenTitel(container), "eine Rückfall-Liste steht da, als wäre nichts gewesen").toEqual(
      [],
    );
    expect(da(ANKER.leer)).toBe(false);
    expect(listenZaehler(container)).toBeNull();

    lage.kosScheitert = false;
    await act(async () => {
      erneut?.click();
    });
    await ruhe();

    expect(
      listenFehlerKnopf(),
      "der Fehlersatz steht noch da, obwohl der Abruf durchkam",
    ).toBeNull();
    expect(zeilenTitel(container).sort()).toEqual(JUNGE_TITEL);
    expect(listenZaehler(container), "die Prüfung wurde nicht nachgeholt").toBe(2);
    expect(filterMenueText()).toMatch(/·\s*1$/);
  });
});
