// @vitest-environment jsdom
// ================================================================================================
// JOB 3072 · N4 · RUNDE 2 — ZWEI ABFRAGEN, ZWEI EIGENE LEBEN: SUCHE UND ERHEBUNG.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Die erste Runde hat den erhobenen Zustand angebunden und im
// ERFOLGSFALL gemessen (`anzeigestatus-in-der-bibliothek.test.tsx`). Ihre Mocks lieferten aber
// dauerhaft dieselbe geglückte Antwort — beide Abfragen standen still. Der Prüfer hat mit zwei
// Gegenproben gezeigt, was dahinter lag (BEN, Runde 1, Korrekturpflichten 1 und 2):
//
//   BEN-1  Die Bibliothek steht auf ZWEI Abfragen, die UNABHÄNGIG auffrischen:
//          `GET /api/library/search` (Titel, Treffermenge) und `GET /api/kos` (der erhobene
//          Zustand). Der Merker der Fläche galt je ID, hing in seinem Rückfallzweig aber am
//          OBJEKT. Frischte die Suche erfolgreich auf, während der KO-Bestand unverändert blieb,
//          stand der neue Titel neben dem ALTEN Zustandswort.
//
//   BEN-2  `GET /api/kos` war seit Runde 1 eine ANZEIGEQUELLE, kam im Frischemodell der Fläche
//          aber nicht vor. Scheiterte ihre Auffrischung bei erfolgreicher Suche, blieb ein alter
//          Serverzustand als „server" stehen — ohne Hinweis, mit einem Zähler, der eine Zahl
//          behauptete, und ohne Weg, ihn aufzufrischen. Das ist die Aussage ohne frische
//          Grundlage, die REGELN §7 und Auftrag §9 ausdrücklich verbieten.
//
// DER AUFBAU. Anders als in der Schwesterdatei sind die beiden Abfragen hier STELLBAR (`box`):
// jede Probe setzt Daten, Fehlerlage, Stand und Auffrischzähler je Abfrage einzeln und rendert
// dieselbe Wurzel neu — genau so, wie react-query es im Betrieb tut. Eine Probe mit konstanten
// Mocks kann keinen dieser beiden Fehler sehen; das ist der Befund, den diese Datei schließt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Titel",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    confidentiality: "intern",
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as KnowledgeObject;
}

const HERKUNFT_ERHOBEN = {
  status: "geprueft",
  zuweisungen: "geprueft",
  bewertungen: "geprueft",
  konflikt: "ungeprueft",
  revalidierung: "geprueft",
  ungeprueft: { konflikt: "Der Konfliktweg wird derzeit umgebaut (JOB 3002)." },
} as const;

/** Die Lage EINER Abfrage — so viel und nicht mehr braucht die Fläche von react-query. */
interface Lage {
  data: readonly KnowledgeObject[] | undefined;
  isError: boolean;
  isRefetchError: boolean;
  fetchStatus: "idle" | "fetching" | "paused";
  dataUpdatedAt: number;
}

const STAND_SUCHE = Date.parse("2026-09-05T11:30:00.000Z");
const STAND_KOS = Date.parse("2026-09-05T09:15:00.000Z");

function gut(data: readonly KnowledgeObject[], stand: number): Lage {
  return { data, isError: false, isRefetchError: false, fetchStatus: "idle", dataUpdatedAt: stand };
}

const box = vi.hoisted(() => ({
  suche: null as unknown,
  kos: null as unknown,
  aufgefrischt: [] as string[],
  // STABILE REFERENZ, und das ist hier kein Schönheitsfehler, sondern die halbe Probe: react-query
  // gibt bei unveränderter Antwort DIESELBE `data`-Referenz zurück (strukturelles Teilen). Ein Mock,
  // der je Render ein frisches `[]` liefert, ließe jeden Merker der Fläche bei jedem Zug zerfallen —
  // BEN-1 wäre grün, ohne dass irgendetwas repariert wäre.
  konflikte: [] as unknown[],
}));

vi.mock("../../apps/web/src/api/hooks", async () => {
  const echt = await vi.importActual<Record<string, unknown>>("../../apps/web/src/api/hooks");
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  const abfrage = (name: "suche" | "kos") => {
    const lage = box[name] as Lage;
    return {
      ...lage,
      isLoading: lage.data === undefined && !lage.isError,
      error: lage.isError ? new Error("kaputt") : null,
      refetch: () => {
        box.aufgefrischt.push(name);
        return Promise.resolve({});
      },
    };
  };
  return {
    ...echt,
    useLibrarySearch: () => abfrage("suche"),
    useKos: () => abfrage("kos"),
    useDirectory: () => ok([{ id: "u9", name: "Eva" }]),
    useConflicts: () => ok(box.konflikte),
    useEigeneBefunde: () => ok([]),
    useKo: (id: string) => ok(((box.kos as Lage).data ?? []).find((k) => k.id === id)),
    useAudit: () => ok([]),
    useReasonerStatus: () => ok({ active: false, mode: "off" }),
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
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { formatKoTimestamp } from "../../apps/web/src/lib/koDates";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

/**
 * Einmal aufbauen. Jedes spätere `neuZeichnen` trifft DIESELBE Komponenteninstanz — Zustand,
 * Effekte und vor allem der Merker aus `useMemo` leben weiter. Der Elementbaum wird dabei NEU
 * gebaut: React steigt bei einem Zeichen-für-Zeichen identischen Element aus und rendert gar
 * nicht erst; die Probe wäre dann grün, ohne etwas gemessen zu haben.
 */
function mount(adresse = "/bibliothek"): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const baum = (): ReturnType<typeof createElement> =>
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(MemoryRouter, { initialEntries: [adresse] }, createElement(Library)),
    );
  act(() => {
    root.render(baum());
  });
  neuZeichnen = () =>
    act(() => {
      root.render(baum());
    });
}
let neuZeichnen: () => void = () => {};

beforeEach(() => {
  box.aufgefrischt = [];
  window.localStorage.clear();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function zeile(id: string): HTMLElement {
  const el = container.querySelector(`[data-testid="bib-zeile"][data-bib-id="${id}"]`);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Zeile „${id}" fehlt`);
  }
  return el;
}
function zeilenTitel(id: string): string {
  return (zeile(id).querySelector('[data-bib-text="zeile-titel"]')?.textContent ?? "").trim();
}
function zeilenWort(id: string): string {
  const meta = zeile(id).querySelector('[data-bib-text="zeile-meta"]');
  return (meta?.textContent ?? "").split("·").slice(1).join("·").trim();
}
function zeilenTon(id: string): string {
  const klassen = zeile(id).querySelector('[data-testid="bib-punkt"]')?.className ?? "";
  return ["pos", "warn", "crit"].find((t) => klassen.includes(`bg-trust-${t}-fill`)) ?? "(keiner)";
}
function sichtbareIds(): string[] {
  return [...container.querySelectorAll('[data-testid="bib-zeile"]')].map(
    (el) => el.getAttribute("data-bib-id") ?? "?",
  );
}
function hinweisTexte(): string[] {
  return [...container.querySelectorAll('[data-testid="auffrischung-fehlgeschlagen"]')].map((el) =>
    (el.textContent ?? "").trim(),
  );
}
function zaehler(): string {
  return (container.querySelector('[data-bib-text="zaehler"]')?.textContent ?? "").trim();
}
/**
 * JEDER sichtbare Wiederholungsweg, egal aus welchem Zweig er kommt. Bewusst über die BESCHRIFTUNG
 * und nicht über eine Marke gesucht: der Prüfer hat den Knopf so gesucht (BEN, Runde 2), und wer
 * ihn drücken will, sieht ebenfalls nur das Wort. Ein Test, der eine eigene Marke abfragt, wäre
 * grün, während auf dem Bildschirm nichts steht.
 */
function erneutKnoepfe(): HTMLButtonElement[] {
  return [...container.querySelectorAll("button")].filter(
    (b) => (b.textContent ?? "").trim() === WORT("lib.liste.erneut"),
  );
}
function erneutKnopf(): HTMLButtonElement {
  const knoepfe = erneutKnoepfe();
  if (knoepfe.length !== 1) {
    throw new Error(`Genau ein Wiederholungsknopf erwartet, gefunden: ${knoepfe.length}`);
  }
  return knoepfe[0] as HTMLButtonElement;
}
/** Der Hinweissatz, den die Bauform des Hauses für einen bestimmten Stand schreibt. */
function standSatz(stand: number): string {
  return WORT("state.staleRefetchFailed").replace(
    "{{zeit}}",
    String(formatKoTimestamp(new Date(stand).toISOString(), "de")),
  );
}
const WORT = (schluessel: string): string =>
  String(i18n.getResource("de", "translation", schluessel));
/** Der Zähler trägt einen Plural — er muss durch die Übersetzung, nicht an ihr vorbei. */
const GEZAEHLT = (n: number): string => i18n.t("lib.liste.eintraege", { count: n });

describe("JOB 3072 R2 · BEN-1 — die Suche frischt auf, der KO-Bestand nicht", () => {
  // ----------------------------------------------------------------------------------------------
  // Der Eintrag steht ABSICHTLICH nicht im KO-Bestand: dann trägt ihn der benannte Rückfall
  // (`herkunft: "bestand"`), und die gezeigte Zahl hängt am SUCHOBJEKT. Genau dort saß der Merker
  // falsch — er galt je ID und überlebte den Objektwechsel.
  // ----------------------------------------------------------------------------------------------
  const FREMD = ko({
    id: "k-fremd",
    title: "Fremder Eintrag",
    status: "offen",
    anzeigestatus: "pruefung",
    anzeigestatusHerkunft: HERKUNFT_ERHOBEN,
  });

  beforeEach(() => {
    box.kos = gut([FREMD], STAND_KOS);
    box.suche = gut(
      [FREMD, ko({ id: "k-wandel", title: "Erste Fassung", status: "validiert" })],
      STAND_SUCHE,
    );
  });

  it("BEN-1 · nach erfolgreicher Suchauffrischung folgen Wort und Ton dem NEUEN Objekt", () => {
    mount();
    expect(zeilenTitel("k-wandel")).toBe("Erste Fassung");
    expect(zeilenWort("k-wandel")).toBe(WORT("status.validiert"));
    expect(zeilenTon("k-wandel")).toBe("pos");

    // Die Suche antwortet neu — neues Objekt, anderer Kern-Enum. Der KO-Bestand ist Zeichen für
    // Zeichen und Referenz für Referenz derselbe (`box.kos` bleibt unangetastet).
    box.suche = gut(
      [FREMD, ko({ id: "k-wandel", title: "Zweite Fassung", status: "offen" })],
      STAND_SUCHE + 1000,
    );
    neuZeichnen();

    expect(zeilenTitel("k-wandel")).toBe("Zweite Fassung");
    // Vor der Korrektur stand hier „Validiert" neben „Zweite Fassung".
    expect(zeilenWort("k-wandel")).toBe(WORT("status.offen"));
    expect(zeilenTon("k-wandel")).toBe("warn");
  });

  it("BEN-1b · der Umschalter folgt mit — der Eintrag verlässt „Freigegeben“", () => {
    mount("/bibliothek?zustand=validiert");
    expect(sichtbareIds()).toContain("k-wandel");

    box.suche = gut(
      [FREMD, ko({ id: "k-wandel", title: "Zweite Fassung", status: "offen" })],
      STAND_SUCHE + 1000,
    );
    neuZeichnen();

    expect(sichtbareIds()).not.toContain("k-wandel");
  });

  it("BEN-1c · Kalibrierung: bleibt das Suchobjekt gleich, bleibt auch das Wort stehen", () => {
    mount();
    const vorher = zeilenWort("k-wandel");
    neuZeichnen();
    expect(zeilenWort("k-wandel")).toBe(vorher);
    // Und der erhobene Nachbar bleibt in beiden Zügen der erhobene.
    expect(zeilenWort("k-fremd")).toBe(WORT("status.pruefung"));
  });
});

describe("JOB 3072 R2 · BEN-2 — die Statusquelle scheitert, die Suche nicht", () => {
  const ALT = ko({
    id: "k-alt",
    title: "Alter Stand",
    status: "offen",
    anzeigestatus: "pruefung",
    anzeigestatusHerkunft: HERKUNFT_ERHOBEN,
  });
  const SUCHTREFFER = ko({ id: "k-alt", title: "Alter Stand", status: "offen" });

  it("BEN-2 · gescheiterte KO-Auffrischung: der Zustand bleibt stehen UND der Hinweis sagt es", () => {
    box.suche = gut([SUCHTREFFER], STAND_SUCHE);
    box.kos = {
      data: [ALT],
      isError: true,
      isRefetchError: true,
      fetchStatus: "idle",
      dataUpdatedAt: STAND_KOS,
    };
    mount();

    // REGELN §7: der zuletzt erfolgreich geholte Zustand bleibt SICHTBAR — nichts wird geleert.
    expect(zeilenWort("k-alt")).toBe(WORT("status.pruefung"));
    // …und die Fläche behauptet nicht, er sei aktuell. Genau EIN Satz, in der Bauform des Hauses.
    expect(hinweisTexte()).toHaveLength(1);
    // Der Satz nennt den Stand der QUELLE, die nicht frisch ist — nicht den jüngeren der Suche.
    expect(hinweisTexte()[0]).toBe(standSatz(STAND_KOS));
    // Der Zähler ist eine Aussage über JETZT und trägt sie in dieser Lage nicht.
    expect(zaehler()).toBe(WORT("lib.liste.eintraegeUnbekannt"));
  });

  it("BEN-2b · Kalibrierung: sind BEIDE Quellen frisch, steht kein Satz und der Zähler zählt", () => {
    box.suche = gut([SUCHTREFFER], STAND_SUCHE);
    box.kos = gut([ALT], STAND_KOS);
    mount();
    expect(hinweisTexte()).toHaveLength(0);
    expect(zaehler()).toBe(GEZAEHLT(1));
    // …und kein Wiederholungsweg ohne Anlass: ein dauerhaft stehender Knopf wäre die zweite
    // Aussage, die diese Fläche nicht macht — hier ist alles frisch.
    expect(erneutKnoepfe()).toHaveLength(0);
  });

  it("BEN-2c · offline pausierte KO-Auffrischung: der Zähler behauptet keine Zahl", () => {
    box.suche = gut([SUCHTREFFER], STAND_SUCHE);
    box.kos = { ...gut([ALT], STAND_KOS), fetchStatus: "paused" };
    mount();
    expect(zeilenWort("k-alt")).toBe(WORT("status.pruefung"));
    expect(zaehler()).toBe(WORT("lib.liste.eintraegeUnbekannt"));
  });

  it("BEN-2d · Erholung: frischt die Statusquelle wieder durch, verschwindet der Satz und der neue Zustand steht da", () => {
    box.suche = gut([SUCHTREFFER], STAND_SUCHE);
    box.kos = {
      data: [ALT],
      isError: true,
      isRefetchError: true,
      fetchStatus: "idle",
      dataUpdatedAt: STAND_KOS,
    };
    mount();
    expect(hinweisTexte()).toHaveLength(1);

    box.kos = gut(
      [{ ...ALT, anzeigestatus: "validiert", status: "validiert" } as KnowledgeObject],
      STAND_KOS + 60_000,
    );
    neuZeichnen();

    expect(hinweisTexte()).toHaveLength(0);
    expect(zeilenWort("k-alt")).toBe(WORT("status.validiert"));
    expect(zaehler()).toBe(GEZAEHLT(1));
  });

  it("BEN-2e · der Wiederholungsknopf frischt BEIDE Quellen auf, nicht nur die Suche", () => {
    // Der harte Erstfehler ist die einzige Lage, in der die Liste den Knopf zeigt. Fasste er nur
    // die Suche an, käme der Bestand zurück — und der Zustand bliebe für immer „bestand".
    box.suche = {
      data: undefined,
      isError: true,
      isRefetchError: false,
      fetchStatus: "idle",
      dataUpdatedAt: 0,
    };
    box.kos = {
      data: undefined,
      isError: true,
      isRefetchError: false,
      fetchStatus: "idle",
      dataUpdatedAt: 0,
    };
    mount();
    const knopf = [...container.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === WORT("lib.liste.erneut"),
    );
    if (!knopf) {
      throw new Error("Wiederholungsknopf fehlt");
    }
    act(() => {
      knopf.click();
    });
    expect([...box.aufgefrischt].sort()).toEqual(["kos", "suche"]);
  });
});

// ==================================================================================================
// JOB 3072 R3/R4 · BEN-3 — DER WEG ZURÜCK ZUR FRISCHE, UND WO ER AUSDRÜCKLICH NICHT HINGEHÖRT.
// ==================================================================================================
//
// DER BEFUND DER RUNDE 2 (BEN, Korrekturpflicht 1). Der Wiederholungs-Handler fasste seit Runde 2
// beide Quellen an, war im BEANSTANDETEN Fall aber gar nicht erreichbar: den Knopf zeichnet
// `BibliothekListe.tsx:192` nur im Zweig `fehler`, und der verlangt eine gescheiterte Suche OHNE
// Bestand. Bei einer gescheiterten AUFFRISCHUNG mit Bestand — dem Fall, für den der Hinweis
// überhaupt gebaut ist — gab es keinen Weg zurück zur Frische. BEN-2e prüfte nur den Erstfehler
// ohne Bestand und konnte das nicht sehen. Die Lücke liegt an einer Naht: `BibliothekListe.tsx`
// steht NICHT in den Zielpfaden (§4/§10), der Knopf kommt deshalb aus dem `hinweis`-Knoten, den die
// Fläche selbst baut.
//
// ==================================================================================================
// DIE KORREKTUR DER RUNDE 4 — „PAUSIERT" IST NICHT „FEHLGESCHLAGEN".
// ==================================================================================================
// Runde 3 hat aus BENs erster Hälfte („bei Pause mit Bestand den Frischehinweis zeigen") den Schluss
// gezogen, der offline angehaltene Abruf sei ein Fehlschlag, und den Satz auch dort gezeigt. Das Tor
// hat es gefangen, zweimal, kein Flackern: `tests/vertraulichkeit-klartext/stufe-im-klartext.test.tsx`
// (JOB 3034) sichert an Detailseite UND Bibliothek zu — „eine pausierte Auffrischung ist kein
// Fehler" (`:423`, `:480`) — und begründet es im selben Test damit, dass offline GAR NICHT gerufen
// wird (`netz.rufe` unverändert, `:419`/`:476`). Es ist nichts fehlgeschlagen, also darf nichts
// „fehlgeschlagen" sagen. Diese Zusicherung ist älter, gemessen und bleibt maßgeblich.
//
// WAS DARAUS FOLGT, und es ist die ehrlichere Fassung: die Fläche SCHWEIGT offline, statt zu
// behaupten. Der Zähler nimmt seine Zahl trotzdem zurück („–", BEN-2c) — Schweigen über den
// aktuellen Bestand ist immer erlaubt, eine Fehlermeldung über ein Ereignis, das nicht stattfand,
// nicht. BEN-3a und BEN-3d messen ab dieser Runde genau das, in beide Richtungen.
describe("JOB 3072 R4 · BEN-3 — der Weg zurück zur Frische, und das Schweigen bei Pause", () => {
  const ALT = ko({
    id: "k-alt",
    title: "Alter Stand",
    status: "offen",
    anzeigestatus: "pruefung",
    anzeigestatusHerkunft: HERKUNFT_ERHOBEN,
  });
  const SUCHTREFFER = ko({ id: "k-alt", title: "Alter Stand", status: "offen" });
  const KOS_PAUSIERT: Lage = { ...gut([ALT], STAND_KOS), fetchStatus: "paused" };
  const KOS_GESCHEITERT: Lage = {
    data: [ALT],
    isError: true,
    isRefetchError: true,
    fetchStatus: "idle",
    dataUpdatedAt: STAND_KOS,
  };

  it("BEN-3a · offline pausierte KO-Auffrischung: KEIN Fehlersatz — die Fläche schweigt und zeigt unverändert", () => {
    box.suche = gut([SUCHTREFFER], STAND_SUCHE);
    box.kos = KOS_PAUSIERT;
    mount();

    // Der Zustand bleibt unverändert stehen (REGELN §7, JOB 3034).
    expect(zeilenWort("k-alt")).toBe(WORT("status.pruefung"));
    // KEIN Satz: offline wurde gar nicht gerufen, es ist nichts fehlgeschlagen. Das ist die
    // Zusicherung, an der Runde 3 im Tor gescheitert ist — hier gemessen, damit sie nicht ein
    // zweites Mal bricht (Zwilling: `stufe-im-klartext.test.tsx:423`/`:480`).
    expect(hinweisTexte()).toHaveLength(0);
    // Und kein Fehlerelement irgendeiner Art, auch kein Wiederholungsknopf.
    expect(erneutKnoepfe()).toHaveLength(0);
    // Zurückgenommen wird trotzdem die ZAHL — sie ist eine Aussage über JETZT (BEN-2c).
    expect(zaehler()).toBe(WORT("lib.liste.eintraegeUnbekannt"));
  });

  it("BEN-3b · gescheiterte Auffrischung MIT Bestand: der Wiederholungsknopf ist wirklich da und frischt beide Quellen", () => {
    box.suche = gut([SUCHTREFFER], STAND_SUCHE);
    box.kos = KOS_GESCHEITERT;
    mount();

    // Die Zeilen stehen, der Satz steht — und bis zur Korrektur endete es hier: kein Weg zurück.
    expect(zeilenWort("k-alt")).toBe(WORT("status.pruefung"));
    expect(hinweisTexte()).toHaveLength(1);
    const knopf = erneutKnopf();
    act(() => {
      knopf.click();
    });
    expect([...box.aufgefrischt].sort()).toEqual(["kos", "suche"]);
  });

  it("BEN-3c · und der Klick trägt: nach erfolgreicher Auffrischung sind Satz, Zustand und Zähler nachgeführt", () => {
    box.suche = gut([SUCHTREFFER], STAND_SUCHE);
    box.kos = KOS_GESCHEITERT;
    mount();
    act(() => {
      erneutKnopf().click();
    });

    // Was der Klick auslöst, kommt im Betrieb als neue Antwort zurück — hier gestellt.
    box.kos = gut(
      [{ ...ALT, anzeigestatus: "validiert", status: "validiert" } as KnowledgeObject],
      STAND_KOS + 60_000,
    );
    neuZeichnen();

    expect(hinweisTexte()).toHaveLength(0);
    expect(erneutKnoepfe()).toHaveLength(0);
    expect(zeilenWort("k-alt")).toBe(WORT("status.validiert"));
    expect(zaehler()).toBe(GEZAEHLT(1));
  });

  it("BEN-3d · Kalibrierung der Grenze: dieselbe Quelle, einmal pausiert, einmal gescheitert — nur eine sagt etwas", () => {
    // Ein und derselbe Bestand, ein und derselbe Stand. Der EINZIGE Unterschied ist die Lage der
    // Auffrischung. Eine Fläche, die pauschal schweigt oder pauschal warnt, fällt hier durch.
    box.suche = gut([SUCHTREFFER], STAND_SUCHE);
    box.kos = KOS_PAUSIERT;
    mount();
    expect(hinweisTexte()).toHaveLength(0);
    expect(zeilenWort("k-alt")).toBe(WORT("status.pruefung"));

    box.kos = KOS_GESCHEITERT;
    neuZeichnen();

    expect(hinweisTexte()).toHaveLength(1);
    expect(hinweisTexte()[0]).toBe(standSatz(STAND_KOS));
    // Der Zustand ist in BEIDEN Lagen derselbe — es ändert sich nur, was die Fläche dazu sagt.
    expect(zeilenWort("k-alt")).toBe(WORT("status.pruefung"));
  });

  it("BEN-3e · scheitert die SUCHE bei vorhandenem Bestand, gilt dasselbe — ein Satz, ein Knopf", () => {
    box.suche = {
      data: [SUCHTREFFER],
      isError: true,
      isRefetchError: true,
      fetchStatus: "idle",
      dataUpdatedAt: STAND_SUCHE,
    };
    box.kos = gut([ALT], STAND_KOS);
    mount();

    expect(zeilenWort("k-alt")).toBe(WORT("status.pruefung"));
    expect(hinweisTexte()).toHaveLength(1);
    // Der ÄLTESTE gescheiterte Stand zählt — hier ist nur die Suche gescheitert.
    expect(hinweisTexte()[0]).toBe(standSatz(STAND_SUCHE));
    expect(erneutKnoepfe()).toHaveLength(1);
  });

  it("BEN-3f · Pause NEBEN Fehler: die pausierte Quelle trägt nichts zum Satz bei", () => {
    // Die pausierte Suche ist die JÜNGERE (`STAND_SUCHE` > `STAND_KOS`). Zählte sie mit, stünde ihr
    // Stand nicht im Satz — sie fiele aber in die Auswahl und der Knopf könnte sich verdoppeln.
    // Genannt wird der Stand der einzigen wirklich gescheiterten Quelle, und der Satz steht genau
    // einmal.
    box.suche = { ...gut([SUCHTREFFER], STAND_SUCHE), fetchStatus: "paused" };
    box.kos = KOS_GESCHEITERT;
    mount();

    expect(hinweisTexte()).toHaveLength(1);
    expect(hinweisTexte()[0]).toBe(standSatz(STAND_KOS));
    expect(erneutKnoepfe()).toHaveLength(1);
    // Der Knopf holt trotzdem BEIDE Quellen — auch die pausierte gehört zur Fläche.
    act(() => {
      erneutKnopf().click();
    });
    expect([...box.aufgefrischt].sort()).toEqual(["kos", "suche"]);
  });
});
