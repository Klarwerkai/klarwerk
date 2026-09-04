// @vitest-environment jsdom
// ================================================================================================
// JOB 3034 — DIE STUFE STEHT DA, UND DIE FEHLENDE STUFE SAGT, DASS SIE FEHLT.
// ================================================================================================
//
// GEMESSEN WIRD AM GERENDERTEN TEXT der beiden echten Seiten, nicht am Rückgabewert eines Helfers.
// Ein Helfer, der „Nicht eingestuft" liefert, und eine Fläche, die ihn nie zeigt, wären zusammen
// grün und trotzdem wirkungslos — genau die Fehlerklasse, die `Library.origin-chip.test.tsx:9-14`
// beschreibt.
//
// GEMESSEN WIRD AN EINER SEMANTISCH DER VERTRAULICHKEITSSTUFE ZUGEORDNETEN DOM-GRUPPE
// (`[data-testid="ko-vertraulichkeitsstufe"]`, `title="Vertraulichkeit"`) und NICHT an einem
// beliebigen Vorkommen des Wortes „unbekannt"/„nicht eingestuft" im Kartentext. Das ist die
// Korrekturpflicht aus JOB 3011 R4 (LEHREN.md): „C(a) an eine fachlich beziehungsweise zugänglich
// als Vertraulichkeitsstufe ausgezeichnete DOM-Gruppe binden, nicht an beliebige Elemente mit
// passendem Text." Der Fall `kategorie: "Vertraulichkeit unbekannt"` steht deshalb unten als
// eigene Kalibrierung: er darf die Messung NICHT bewegen.
//
// DIE DREI ROTFÄLLE DES AUFTRAGS (§6):
//   R1  Detail, `confidentiality: "intern"`            → „Öffentlich-intern" sichtbar.
//   R2  Detail, `null` + provenance `"unknown"`        → „Nicht eingestuft" sichtbar.
//   R3  Bibliothek, `"vertraulich"` UND eine Zeile ohne Stufe → beide Klartexte in IHRER Zeile.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 2 — WAS BEN AN RUNDE 1 ZERLEGT HAT, UND WAS DIESE DATEI DESHALB ANDERS MACHT:
//
// (A) ECHTER QueryClient STATT STANDBILD. Runde 1 ersetzte `useKo`/`useKos`/`useLibrarySearch`
//     durch feste Objekte („isLoading", „isError", fertig). Damit war der eine Zustand, der die
//     Sache kaputt machte, gar nicht erreichbar: nach einem gescheiterten AUFFRISCHEN sind bei
//     react-query `isError: true` UND `data` gefüllt — zugleich. Hier laufen jetzt echte
//     `useQuery`-Abrufe gegen einen echten `QueryClient`; die Zustände entstehen durch echte
//     Abrufe (`netz`), nicht durch behauptete Flags.
//
// (B) UNABHÄNGIGE SOLLWERTE. Runde 1 verglich den gerenderten Text mit derselben i18n-Tabelle, aus
//     der die Fläche ihn zog: eine Wortlautmutation auf „Kartoffel" blieb grün, weil beide Seiten
//     der Gleichung mitmutierten. Die Pflichttexte stehen deshalb unten als Literale in `KLARTEXT`
//     und werden zusätzlich gegen die i18n-Tabelle gepinnt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

/** Die eine Marke, an der gemessen wird — kein CSS-Klassenraten, keine Textsuche in der Karte. */
const STUFE = '[data-testid="ko-vertraulichkeitsstufe"]';
/** Die Marke des Hinweises „Stand von … · Auffrischung fehlgeschlagen". */
const HINWEIS = '[data-testid="auffrischung-fehlgeschlagen"]';

/**
 * (B) DIE PFLICHTTEXTE, UNABHÄNGIG VON DER PRODUKTQUELLE HINGESCHRIEBEN.
 * Diese Literale sind der Sollwert. Sie stammen NICHT aus `i18n.ts`; wer dort den Wortlaut ändert,
 * macht diese Datei rot — und genau das ist der Zweck (BEN, Korrekturpflicht 3).
 */
const KLARTEXT = {
  intern: "Öffentlich-intern",
  vertraulich: "Vertraulich",
  streng_vertraulich: "Streng vertraulich",
  nichtEingestuft: "Nicht eingestuft",
  feld: "Vertraulichkeit",
} as const;

function ko(overrides: Record<string, unknown>): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Ventil X schliesst bei Ueberdruck",
    statement: "Bei Ueberdruck Ventil X manuell schliessen.",
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
    createdAt: "2026-08-12T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

// Der Bestand, den ein GELUNGENER Abruf liefert.
const lage = vi.hoisted(() => ({
  ko: null as unknown,
  kos: [] as unknown[],
}));

// (A) Das „Netz" der echten Abrufe. `zustand` gilt für den NÄCHSTEN Abruf — dadurch lässt sich ein
// erfolgreicher Erstabruf mit einem gescheiterten oder hängenden Zweitabruf kombinieren, was der
// gesamte Punkt dieser Runde ist. `rufe` zählt die tatsächlichen Abrufe (für den Offline-Fall:
// pausiert heißt, es wird NICHT gerufen).
const netz = vi.hoisted(() => ({
  zustand: "ok" as "ok" | "fehler" | "haengt",
  rufe: 0,
}));

// TEILMOCK, kein Vollersatz (Muster aus `KnowledgeDetail.origin-chip.test.tsx:46-49`): die
// Detailseite zieht über Unterkomponenten weitere Haken, die mit dem Gegenstand nichts zu tun
// haben. Überschrieben wird nur, was dieser Test wirklich steuert — und die drei Haken, die den
// Gegenstand tragen, laufen als ECHTE `useQuery`-Abrufe gegen den echten `QueryClient` des Tests.
vi.mock("../../apps/web/src/api/hooks", async (importOriginal) => {
  const echt = await importOriginal<Record<string, unknown>>();
  // Derselbe Pfad wie unten beim `QueryClientProvider`: von `tests/` aus löst der nackte Name nicht
  // auf, und es MUSS dieselbe Modulinstanz sein — sonst hätte der Haken einen anderen
  // Zwischenspeicher als der Provider des Tests.
  const rq = await import("../../apps/web/node_modules/@tanstack/react-query");
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  const leer = () => ok([]);
  const abfrage = <T,>(schluessel: unknown[], liefere: () => T) =>
    rq.useQuery({
      queryKey: schluessel,
      queryFn: async () => {
        netz.rufe += 1;
        if (netz.zustand === "fehler") {
          throw new Error("Netz weg");
        }
        if (netz.zustand === "haengt") {
          // Ein Abruf, der (noch) nicht antwortet: genau der Zustand „läuft".
          await new Promise(() => {});
        }
        return liefere();
      },
      retry: false,
      gcTime: Number.POSITIVE_INFINITY,
      staleTime: 0,
    });
  return {
    ...echt,
    useKo: (id: string) => abfrage(["ko", id], () => lage.ko),
    useKos: () => abfrage(["kos"], () => lage.kos),
    useLibrarySearch: () => abfrage(["lib", "search"], () => lage.kos),
    useAudit: leer,
    useConflicts: leer,
    useDirectory: leer,
    useKoEvidence: leer,
    useKoNeighbors: leer,
    useKoVersions: leer,
    useLifecyclePending: leer,
    useExternalPolicy: () => ok({ stage: "blocked" }),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u9", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import {
  isKnownNonConfidential,
  vertraulichkeitsAuskunft,
} from "../../apps/web/src/lib/confidentiality";
import { libraryFilterValues } from "../../apps/web/src/lib/libraryFacets";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
let qc: QueryClient;

/** Lässt die angestoßenen Abrufe und die daraus folgenden Renderdurchgänge auslaufen. */
async function ruhe(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

async function mounte(baum: ReturnType<typeof createElement>): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  await act(async () => {
    root?.render(createElement(QueryClientProvider, { client: qc }, baum));
  });
  await ruhe();
}

async function detail(objekt: unknown): Promise<void> {
  lage.ko = objekt;
  await mounte(
    createElement(
      MemoryRouter,
      { initialEntries: ["/wissen/ko-1"] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: "/wissen/:id", element: createElement(KnowledgeDetail) }),
      ),
    ),
  );
}

async function bibliothek(bestand: unknown[]): Promise<void> {
  lage.kos = bestand;
  await mounte(
    createElement(MemoryRouter, { initialEntries: ["/bibliothek"] }, createElement(Library)),
  );
}

/** Eine Auffrischung anstoßen — genau so, wie sie im Betrieb entsteht (Fokus, Invalidierung). */
async function frischeAuf(): Promise<void> {
  await act(async () => {
    void qc.refetchQueries();
    await new Promise((r) => setTimeout(r, 0));
  });
  await ruhe();
}

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

beforeEach(() => {
  netz.zustand = "ok";
  netz.rufe = 0;
});

afterEach(() => {
  abbauen();
  onlineManager.setOnline(true);
  lage.ko = null;
  lage.kos = [];
});

function stufen(): HTMLElement[] {
  return [...container.querySelectorAll(STUFE)] as HTMLElement[];
}

/** Der sichtbare Klartext der EINEN Stufenanzeige (Detailseite). */
function stufentext(): string | undefined {
  return stufen()[0]?.textContent?.trim();
}

/** Der Klartext der Stufe IN DER ZEILE, die diesen Titel trägt (Bibliothek). */
function stufeInZeile(titel: string): string | undefined {
  for (const chip of stufen()) {
    const zeile = chip.closest(".group");
    if (zeile?.textContent?.includes(titel)) {
      return chip.textContent?.trim();
    }
  }
  return undefined;
}

function hinweise(): HTMLElement[] {
  return [...container.querySelectorAll(HINWEIS)] as HTMLElement[];
}

function de(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

// ------------------------------------------------------------------------------------------------
// (B) Der Wortlaut-Pin: die Sollwerte oben und die Produkttabelle müssen übereinstimmen.
// Ohne diesen Block wäre `KLARTEXT` nur eine zweite Meinung; mit ihm wird jede Wortlautänderung in
// `i18n.ts` genau hier rot statt still.
// ------------------------------------------------------------------------------------------------
describe("JOB 3034 · Wortlaut-Pin — die Pflichttexte stehen unabhängig fest", () => {
  it.each([
    ["conf.level.intern", KLARTEXT.intern],
    ["conf.level.vertraulich", KLARTEXT.vertraulich],
    ["conf.level.streng_vertraulich", KLARTEXT.streng_vertraulich],
    ["conf.level.nichtEingestuft", KLARTEXT.nichtEingestuft],
    ["conf.field", KLARTEXT.feld],
  ])("%s lautet auf Deutsch genau so", (key, soll) => {
    expect(de(key)).toBe(soll);
  });
});

// ------------------------------------------------------------------------------------------------
// R1/R2 + die vier Fälle auf der Detailseite
// ------------------------------------------------------------------------------------------------
describe("JOB 3034 · Detailseite — jede Stufe im Klartext, auch die fehlende", () => {
  it("R1: ein Eintrag mit „intern“ zeigt „Öffentlich-intern“", async () => {
    await detail(ko({ confidentiality: "intern", confidentialityProvenance: "ko" }));
    expect(stufentext()).toBe(KLARTEXT.intern);
  });

  it("R2: ein Eintrag ohne Einstufung zeigt „Nicht eingestuft“ — nicht „intern“", async () => {
    await detail(ko({ confidentiality: null, confidentialityProvenance: "unknown" }));
    expect(stufentext()).toBe(KLARTEXT.nichtEingestuft);
    expect(stufentext()).not.toBe(KLARTEXT.intern);
  });

  it("„vertraulich“ und „streng vertraulich“ stehen weiterhin im Klartext", async () => {
    await detail(ko({ confidentiality: "vertraulich", confidentialityProvenance: "ko" }));
    expect(stufentext()).toBe(KLARTEXT.vertraulich);
    abbauen();
    await detail(ko({ confidentiality: "streng_vertraulich", confidentialityProvenance: "ko" }));
    expect(stufentext()).toBe(KLARTEXT.streng_vertraulich);
  });

  it("die Anzeige ist als Vertraulichkeitsstufe ausgezeichnet (nicht nur ein Wort im Text)", async () => {
    await detail(ko({ confidentiality: null, confidentialityProvenance: "unknown" }));
    const chip = stufen()[0];
    expect(chip?.getAttribute("title")).toBe(KLARTEXT.feld);
    expect(chip?.getAttribute("aria-label")).toBe(`${KLARTEXT.feld}: ${KLARTEXT.nichtEingestuft}`);
  });

  it("KALIBRIERUNG (JOB 3011 R4): ein freier Kategorienwert „unbekannt“ bewegt nichts", async () => {
    await detail(
      ko({
        category: "Vertraulichkeit unbekannt",
        confidentiality: "vertraulich",
        confidentialityProvenance: "ko",
      }),
    );
    expect(stufentext()).toBe(KLARTEXT.vertraulich);
  });
});

// ------------------------------------------------------------------------------------------------
// R3 — die Bibliothek
// ------------------------------------------------------------------------------------------------
describe("JOB 3034 · Bibliothek — die Stufe steht in der Trefferzeile", () => {
  it("R3: die vertrauliche Zeile sagt „Vertraulich“, die Zeile ohne Stufe „Nicht eingestuft“", async () => {
    await bibliothek([
      ko({ id: "a", title: "Vertraulicher Eintrag", confidentiality: "vertraulich" }),
      ko({ id: "b", title: "Altbestand ohne Stufe" }),
    ]);
    expect(stufeInZeile("Vertraulicher Eintrag")).toBe(KLARTEXT.vertraulich);
    expect(stufeInZeile("Altbestand ohne Stufe")).toBe(KLARTEXT.nichtEingestuft);
  });

  it("jede Trefferzeile trägt genau EINE Stufenanzeige — keine bleibt ohne Kennzeichen", async () => {
    await bibliothek([
      ko({ id: "a", title: "Intern", confidentiality: "intern" }),
      ko({ id: "b", title: "Vertraulich", confidentiality: "vertraulich" }),
      ko({ id: "c", title: "Streng", confidentiality: "streng_vertraulich" }),
      ko({ id: "d", title: "Ohne Stufe" }),
    ]);
    expect(stufen()).toHaveLength(4);
    expect(stufeInZeile("Intern")).toBe(KLARTEXT.intern);
    expect(stufeInZeile("Streng")).toBe(KLARTEXT.streng_vertraulich);
  });
});

// ------------------------------------------------------------------------------------------------
// §9 Zustandsmodell — mit ECHTEM QueryClient, Zustand für Zustand.
// „Nicht eingestuft" ist eine Aussage über den BESTAND, nie über den Ladezustand; und ein
// gescheiterter ABRUF ist keine Aussage über den Bestand, den man schon hat.
// ------------------------------------------------------------------------------------------------
describe("JOB 3034 · Zustandsmodell (echter QueryClient) — Detailseite", () => {
  it("laden: keine Stufenanzeige, kein „Nicht eingestuft“, kein Hinweis", async () => {
    netz.zustand = "haengt";
    await detail(ko({}));
    expect(stufen()).toHaveLength(0);
    expect(container.textContent).not.toContain(KLARTEXT.nichtEingestuft);
    expect(hinweise()).toHaveLength(0);
  });

  it("Erstabruf gescheitert (kein Bestand): keine Stufenanzeige — auch nicht „Nicht eingestuft“", async () => {
    netz.zustand = "fehler";
    await detail(ko({}));
    expect(stufen()).toHaveLength(0);
    expect(container.textContent).not.toContain(KLARTEXT.nichtEingestuft);
  });

  it("Bestand + GESCHEITERTE Auffrischung: Titel und Stufe bleiben stehen, der Fehler steht daneben", async () => {
    await detail(ko({ confidentiality: "intern", confidentialityProvenance: "ko" }));
    expect(stufentext()).toBe(KLARTEXT.intern);

    netz.zustand = "fehler";
    await frischeAuf();

    const abfrage = qc.getQueryState(["ko", "ko-1"]);
    expect(abfrage?.status, "der Abruf muss wirklich gescheitert sein").toBe("error");
    expect(abfrage?.data, "und der Bestand muss wirklich noch im Speicher liegen").toBeTruthy();

    expect(stufentext(), "die Stufe bleibt sichtbar").toBe(KLARTEXT.intern);
    expect(container.textContent).toContain("Ventil X schliesst bei Ueberdruck");
    expect(hinweise(), "der gescheiterte Abruf wird gesagt, nicht verschwiegen").toHaveLength(1);
    expect(hinweise()[0]?.textContent).toContain("Auffrischung fehlgeschlagen");
  });

  it("Bestand + LAUFENDE Auffrischung: die Stufe bleibt, ohne Fehlerhinweis", async () => {
    await detail(ko({ confidentiality: "vertraulich", confidentialityProvenance: "ko" }));
    netz.zustand = "haengt";
    await frischeAuf();
    expect(qc.getQueryState(["ko", "ko-1"])?.fetchStatus).toBe("fetching");
    expect(stufentext()).toBe(KLARTEXT.vertraulich);
    expect(hinweise()).toHaveLength(0);
  });

  it("offline: der Abruf pausiert, es wird nicht gerufen, die Stufe bleibt unverändert", async () => {
    await detail(ko({ confidentiality: "streng_vertraulich", confidentialityProvenance: "ko" }));
    const vorher = netz.rufe;
    onlineManager.setOnline(false);
    netz.zustand = "fehler";
    await frischeAuf();
    expect(netz.rufe, "offline wird nicht gerufen").toBe(vorher);
    expect(qc.getQueryState(["ko", "ko-1"])?.fetchStatus).toBe("paused");
    expect(stufentext()).toBe(KLARTEXT.streng_vertraulich);
    expect(hinweise(), "eine pausierte Auffrischung ist kein Fehler").toHaveLength(0);
  });
});

describe("JOB 3034 · Zustandsmodell (echter QueryClient) — Bibliothek", () => {
  it("erfolgreich leer: keine Zeile, keine Stufenanzeige, keine Aussage", async () => {
    await bibliothek([]);
    expect(stufen()).toHaveLength(0);
    expect(container.textContent).not.toContain(KLARTEXT.nichtEingestuft);
  });

  it("Erstabruf gescheitert (kein Bestand): keine Zeile, keine Stufenanzeige", async () => {
    netz.zustand = "fehler";
    await bibliothek([ko({ id: "a", title: "Altbestand ohne Stufe" })]);
    expect(stufen()).toHaveLength(0);
    expect(container.textContent).not.toContain(KLARTEXT.nichtEingestuft);
  });

  it("Bestand + GESCHEITERTE Auffrischung: die Trefferzeilen samt Stufe bleiben stehen", async () => {
    await bibliothek([
      ko({ id: "a", title: "Vertraulicher Eintrag", confidentiality: "vertraulich" }),
      ko({ id: "b", title: "Altbestand ohne Stufe" }),
    ]);
    expect(stufen()).toHaveLength(2);

    netz.zustand = "fehler";
    await frischeAuf();

    const abfrage = qc.getQueryState(["lib", "search"]);
    expect(abfrage?.status, "der Abruf muss wirklich gescheitert sein").toBe("error");
    expect(abfrage?.data, "und die Treffer müssen wirklich noch im Speicher liegen").toBeTruthy();

    expect(stufeInZeile("Vertraulicher Eintrag")).toBe(KLARTEXT.vertraulich);
    expect(stufeInZeile("Altbestand ohne Stufe")).toBe(KLARTEXT.nichtEingestuft);
    expect(hinweise().length, "der gescheiterte Abruf wird gesagt").toBeGreaterThanOrEqual(1);
  });

  it("Bestand + LAUFENDE Auffrischung: die Zeilen bleiben, ohne Fehlerhinweis", async () => {
    await bibliothek([
      ko({ id: "a", title: "Vertraulicher Eintrag", confidentiality: "vertraulich" }),
    ]);
    netz.zustand = "haengt";
    await frischeAuf();
    expect(qc.getQueryState(["lib", "search"])?.fetchStatus).toBe("fetching");
    expect(stufeInZeile("Vertraulicher Eintrag")).toBe(KLARTEXT.vertraulich);
    expect(hinweise()).toHaveLength(0);
  });

  it("offline: der Abruf pausiert, die Zeilen und ihre Stufen bleiben unverändert", async () => {
    await bibliothek([ko({ id: "b", title: "Altbestand ohne Stufe" })]);
    const vorher = netz.rufe;
    onlineManager.setOnline(false);
    netz.zustand = "fehler";
    await frischeAuf();
    expect(netz.rufe, "offline wird nicht gerufen").toBe(vorher);
    expect(qc.getQueryState(["lib", "search"])?.fetchStatus).toBe("paused");
    expect(stufeInZeile("Altbestand ohne Stufe")).toBe(KLARTEXT.nichtEingestuft);
    expect(hinweise()).toHaveLength(0);
  });
});

// ------------------------------------------------------------------------------------------------
// Die Regel selbst — EINE Auskunftsfunktion, die den Server spiegelt
// ------------------------------------------------------------------------------------------------
describe("JOB 3034 · vertraulichkeitsAuskunft — der Server gilt, sonst dieselbe Regel", () => {
  it("liefert der Server die Herkunft, gilt SIE", () => {
    expect(
      vertraulichkeitsAuskunft({ confidentiality: null, confidentialityProvenance: "unknown" }),
    ).toMatchObject({ level: null, provenance: "unknown", labelKey: "conf.level.nichtEingestuft" });
    expect(
      vertraulichkeitsAuskunft({
        confidentiality: "vertraulich",
        confidentialityProvenance: "ko",
      }),
    ).toMatchObject({ level: "vertraulich", provenance: "ko" });
  });

  it("fehlt die Herkunft (Listenroute), gilt die serverseitige Regel: gültige Stufe = „ko“", () => {
    expect(vertraulichkeitsAuskunft({ confidentiality: "intern" })).toMatchObject({
      level: "intern",
      provenance: "ko",
      labelKey: "conf.level.intern",
    });
    expect(vertraulichkeitsAuskunft({})).toMatchObject({
      level: null,
      provenance: "unknown",
      labelKey: "conf.level.nichtEingestuft",
    });
  });

  it("ein ungültiger Wert wird NICHT zu „intern“ geglättet", () => {
    expect(vertraulichkeitsAuskunft({ confidentiality: "quatsch" as never })).toMatchObject({
      level: null,
      provenance: "unknown",
    });
  });

  it("jede Auskunft trägt ein Kennzeichen — es gibt keinen Eintrag ohne Stufe", () => {
    for (const eingabe of [
      {},
      { confidentiality: "intern" as const },
      { confidentiality: "vertraulich" as const },
      { confidentiality: "streng_vertraulich" as const },
      { confidentiality: null, confidentialityProvenance: "unknown" as const },
    ]) {
      expect(vertraulichkeitsAuskunft(eingabe).showChip).toBe(true);
    }
  });

  it("„nicht eingestuft“ trägt einen eigenen Ton, klar unterschieden von „intern“", () => {
    const ohne = vertraulichkeitsAuskunft({});
    const intern = vertraulichkeitsAuskunft({ confidentiality: "intern" });
    expect(ohne.tone).not.toBe(intern.tone);
  });
});

// ------------------------------------------------------------------------------------------------
// §8.6 — die zwei Wege, die AUSDRÜCKLICH unverändert bleiben (die Anzeige ist kein Tor)
// ------------------------------------------------------------------------------------------------
describe("JOB 3034 · benannte Grenzen — Filterfacette und fail-safe-Riegel bleiben, wie sie waren", () => {
  it("die Filterfacette zählt den fehlenden Wert weiter als „intern“ (bewusste Abweichung)", () => {
    const jetzt = Date.parse("2026-09-03T00:00:00.000Z");
    expect(libraryFilterValues(ko({}), jetzt).confidentiality).toEqual(["intern"]);
    expect(
      libraryFilterValues(ko({ confidentiality: "vertraulich" }), jetzt).confidentiality,
    ).toEqual(["vertraulich"]);
  });

  it("isKnownNonConfidential bleibt der Riegel für die AUTOMATIK — unverändert", () => {
    expect(isKnownNonConfidential(undefined)).toBe(true);
    expect(isKnownNonConfidential(null)).toBe(true);
    expect(isKnownNonConfidential("intern")).toBe(true);
    expect(isKnownNonConfidential("vertraulich")).toBe(false);
    expect(isKnownNonConfidential("streng_vertraulich")).toBe(false);
    expect(isKnownNonConfidential("quatsch")).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
// Sprachparität — ein Schlüssel, den nur eine Sprache kennt, ist eine halbe Lieferung
// ------------------------------------------------------------------------------------------------
describe("JOB 3034 · Sprachparität — „Nicht eingestuft“ spricht alle drei Sprachen", () => {
  it.each(["de", "en", "nl"] as const)(
    "conf.level.nichtEingestuft ist in %s gesetzt",
    (sprache) => {
      const wert = i18n.getResource(sprache, "translation", "conf.level.nichtEingestuft");
      expect(typeof wert, `Schlüssel fehlt in ${sprache}`).toBe("string");
      expect(String(wert).trim().length, `Schlüssel ist in ${sprache} leer`).toBeGreaterThan(0);
    },
  );

  it.each(["de", "en", "nl"] as const)(
    "state.staleRefetchFailed ist in %s gesetzt und trägt die Zeitstelle",
    (sprache) => {
      const wert = String(i18n.getResource(sprache, "translation", "state.staleRefetchFailed"));
      expect(wert.length, `Schlüssel fehlt in ${sprache}`).toBeGreaterThan(0);
      expect(wert, `Zeitstelle fehlt in ${sprache}`).toContain("{{zeit}}");
    },
  );

  it("die drei Sprachen sagen es je eigenständig (kein stehengebliebenes Englisch)", () => {
    const en = String(i18n.getResource("en", "translation", "conf.level.nichtEingestuft"));
    const nl = String(i18n.getResource("nl", "translation", "conf.level.nichtEingestuft"));
    const dew = de("conf.level.nichtEingestuft");
    expect(nl).not.toBe(en);
    expect(dew).not.toBe(en);
  });
});
