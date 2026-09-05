// @vitest-environment jsdom
// ================================================================================================
// JOB 3088 · Q1b — DER WIEDERHOLKNOPF DER BIBLIOTHEK HOLT AUCH DEN GELESENEN EINTRAG ZURÜCK.
// ================================================================================================
//
// DER BEFUND, DER DIESE DATEI ERZWINGT (Codex an der laufenden Anwendung, Live 1.98, Befund
// R-1613, Prüfschritt 2, wörtlich): „10s nach Erneut versuchen: /api/library/search und /api/kos
// 200; kein /api/kos/:id. Liste 26 Einträge; Detaildatierung bleibt fehlerhaft." Der Knopf der
// Fläche kannte genau zwei Abfragen (`BibliothekFlaeche.tsx`, `quellen`) — die Detailabfrage des
// gerade gelesenen Eintrags ist eine dritte und wohnt in `BibliothekLesen.tsx:158`.
//
// ------------------------------------------------------------------------------------------------
// WIE HIER GEMESSEN WIRD — und warum nicht an einem Standbild
// ------------------------------------------------------------------------------------------------
// Gemessen wird an ECHTEN `useQuery`-Abrufen gegen einen echten `QueryClient`: `useKo`, `useKos`,
// `useLibrarySearch` und `useKoVersions` bleiben die PRODUKTHAKEN (nur das „Netz" darunter,
// `api/endpoints`, ist ein Doppel, das die Rufe zählt). Das ist der einzige Aufbau, in dem der
// Gegenstand überhaupt erreichbar ist: Nach einem gescheiterten Nachschlag sind bei react-query
// `isError: true` UND `data` zugleich wahr, und genau diese Lage soll der Knopf auflösen. Ein Mock,
// der `useKo` durch ein festes Objekt ersetzte, hätte gar keinen Zwischenspeicher, den der Knopf
// treffen könnte — er wäre grün, egal was die Fläche tut.
//
// UNABHÄNGIGER SOLLWERT FÜR DEN SCHLÜSSEL (`DETAIL_SCHLUESSEL` unten): der Schlüssel der
// Detailabfrage steht hier als Literal und wird NICHT aus `koQueryKey` geholt. Sonst zöge eine
// Verstellung im Produkt die Messung mit, und die Gegenprobe aus §6 des Auftrags (`koQueryKey` auf
// `["ko-detail", id]` verstellen) bliebe still grün — dieselbe Fehlerklasse, die JOB 3034 R2 unter
// „(B) UNABHÄNGIGE SOLLWERTE" beschreibt.
//
// DIE SECHS FÄLLE (E und F kamen in Runde 2 aus dem Befund BEN dazu):
//   A  Cache mit gescheiterter Auffrischung, Klick → GENAU EIN `/api/kos/:id`. (Vorher: null.)
//   B  Detailabruf ohne Bestand gescheitert → der Fehlersatz geht durch den LISTEN-Knopf weg.
//   C  Nichts gewählt, leere Liste → NULL Detailrufe. Kein Ruf ins Leere.
//   D  Reichweite: `exact: true`. Die Versionsliste unter demselben Präfix wird NICHT mitgerufen.
//   E  Ein Detailabruf LÄUFT bereits → NULL zusätzliche Rufe, sein Ergebnis wird übernommen (§9).
//   F  MIT Bestand: der datierte Hinweis geht weg, und der Eintrag trägt den neu geholten Stand.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

/**
 * Der Schlüssel der Detailabfrage — als Literal, bewusst nicht aus dem Produkt importiert (s. Kopf).
 * Wer `koQueryKey` in `api/hooks.ts` verstellt, macht Fall A und B genau hier rot.
 */
const DETAIL_SCHLUESSEL = ["ko", "k-1"] as const;

/** Der Pflichttext der Lesefläche, unabhängig hingeschrieben (Fall B misst gegen ihn). */
const LESEN_FEHLER = "Der Eintrag ließ sich nicht laden.";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "k-1",
    title: "Titel",
    statement: "Aussage",
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
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

const BESTAND: readonly KnowledgeObject[] = [
  ko({ id: "k-1", title: "Ventil X bei Ueberdruck schliessen" }),
  ko({ id: "k-2", title: "Ruehrwerk Y vor der Reinigung entlueften" }),
];

// Das „Netz": `lage` gilt für den NÄCHSTEN Ruf je Kanal, `rufe` zählt die tatsächlichen Rufe.
// Dadurch lässt sich ein erfolgreicher Erstabruf mit einem gescheiterten Nachschlag kombinieren —
// die Lage, die Codex gemessen hat. `bestand` ist, was ein GELUNGENER Abruf liefert.
//
// RUNDE 2 (Befund BEN): dazu die Lage „haengt" — ein Abruf, der losgelaufen ist und (noch) nicht
// antwortet. Sein Versprechen bleibt in `loeser` liegen und wird vom Test von Hand eingelöst. Ohne
// dieses kontrolliert offene Versprechen ist der Fall „Cache mit LAUFENDER Auffrischung" (Auftrag
// §9) gar nicht messbar: eine Rufzählung über abgeschlossene Abrufe sieht die Überlappung nicht.
const netz = vi.hoisted(() => ({
  lage: { suche: "ok", kos: "ok", detail: "ok" } as Record<string, string>,
  rufe: { suche: 0, kos: 0, detail: 0, versionen: 0 } as Record<string, number>,
  bestand: [] as { id: string; title?: string }[],
  loeser: {} as Record<string, (() => void) | undefined>,
}));

// Das Doppel sitzt AM NETZ (`api/endpoints`), nicht an den Haken: `useKo`, `useKos`,
// `useLibrarySearch` und `useKoVersions` bleiben das Produkt, samt ihrer Schlüssel.
vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const echt = await importOriginal<Record<string, unknown>>();
  const e = echt.endpoints as Record<string, Record<string, unknown>>;
  // `liefere` ist ABSICHTLICH eine Funktion und kein Wert: bei „haengt" wird sie erst beim Einlösen
  // ausgewertet, sodass ein laufender Abruf einen NEUEREN Stand mitbringen kann als den, der beim
  // Losschicken im Speicher lag. Genau daran misst Fall E, dass sein Ergebnis übernommen wird.
  const ruf = async <T,>(kanal: string, liefere: () => T): Promise<T> => {
    netz.rufe[kanal] = (netz.rufe[kanal] ?? 0) + 1;
    if (netz.lage[kanal] === "fehler") {
      throw new Error(`Netz weg (${kanal})`);
    }
    if (netz.lage[kanal] === "haengt") {
      return await new Promise<T>((erfuelle) => {
        netz.loeser[kanal] = () => erfuelle(liefere());
      });
    }
    return liefere();
  };
  return {
    ...echt,
    endpoints: {
      ...e,
      ko: {
        ...e.ko,
        list: () => ruf("kos", () => [...netz.bestand]),
        get: (id: string) => ruf("detail", () => netz.bestand.find((k) => k.id === id) ?? null),
        // Die Versionsliste liegt unter dem PRÄFIX der Detailabfrage (`["ko", id, "versions"]`) —
        // Fall D misst an ihr, wie weit der Knopf reicht. Sie scheitert nie; ihre Rufzahl ist die
        // Messgröße, nicht ihr Zustand.
        versions: () => ruf("versionen", () => []),
      },
      library: { ...e.library, search: () => ruf("suche", () => [...netz.bestand]) },
      // Ein einzelner Nebenabruf der Zeile „Mehr", der sonst gegen ein nicht vorhandenes Netz liefe.
      lifecycle: { ...e.lifecycle, couplingsFor: async () => [] },
    },
  };
});

// TEILMOCK der Haken (Muster aus `stufe-im-klartext.test.tsx:107`): überschrieben wird nur, was
// diesen Gegenstand NICHT trägt. Die vier Haken oben bleiben ausdrücklich echt.
vi.mock("../../apps/web/src/api/hooks", async (importOriginal) => {
  const echt = await importOriginal<Record<string, unknown>>();
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  const leer = () => ok([]);
  return {
    ...echt,
    useAudit: leer,
    useConflicts: leer,
    useDirectory: leer,
    useEigeneBefunde: leer,
    useKoEvidence: leer,
    useKoNeighbors: leer,
    useLifecyclePending: leer,
    useExternalPolicy: () => ok({ stage: "blocked" }),
    useReasonerStatus: () => ok({ active: false, mode: "off" }),
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
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { AUFFRISCHUNG_HINWEIS_MARKE } from "../../apps/web/src/lib/confidentiality";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
let qc: QueryClient;

async function ruhe(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
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
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY, refetchOnWindowFocus: false },
    },
  });
  await act(async () => {
    root?.render(createElement(QueryClientProvider, { client: qc }, baum));
  });
  await ruhe();
}

/** Die Fläche mit VORGEWÄHLTEM Eintrag — der Weg, auf dem gelesen wird (`/wissen/:id`). */
async function gelesen(): Promise<void> {
  await mounte(
    createElement(
      MemoryRouter,
      { initialEntries: ["/wissen/k-1"] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: "/wissen/:id", element: createElement(KnowledgeDetail) }),
      ),
    ),
  );
}

/** Dieselbe Fläche ohne Vorauswahl (`/bibliothek`) — für den leeren Fall C. */
async function bibliothek(): Promise<void> {
  await mounte(
    createElement(MemoryRouter, { initialEntries: ["/bibliothek"] }, createElement(Library)),
  );
}

function netzLage(suche: string, kos: string, detail: string): void {
  netz.lage = { suche, kos, detail };
}

/** Eine Auffrischung, wie sie im Betrieb entsteht (Fokus, Invalidierung) — NICHT über den Knopf. */
async function frischeAuf(): Promise<void> {
  await act(async () => {
    void qc.refetchQueries();
    await new Promise((r) => setTimeout(r, 0));
  });
  await ruhe();
}

function knopf(): HTMLButtonElement {
  const el = container.querySelector('[data-testid="bib-hinweis-erneut"]');
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`Der Wiederholknopf der Fläche fehlt; DOM: ${container.textContent}`);
  }
  return el;
}

/** Der EINE Knopf der Liste — nicht der kleine auf der Lesefläche. */
async function erneutVersuchen(): Promise<void> {
  const k = knopf();
  await act(async () => {
    k.click();
    await new Promise((r) => setTimeout(r, 0));
  });
  await ruhe();
}

function leseTitel(): string | null {
  return container.querySelector('[data-testid="bib-titel"]')?.textContent?.trim() ?? null;
}

/** Die datierten Sätze „Stand von … · Auffrischung fehlgeschlagen" auf der ganzen Fläche. */
function hinweise(): HTMLElement[] {
  return [
    ...container.querySelectorAll(`[data-testid="${AUFFRISCHUNG_HINWEIS_MARKE}"]`),
  ] as HTMLElement[];
}

/** Das offene Versprechen eines hängenden Abrufs einlösen — mit dem Stand von JETZT. */
async function loese(kanal: string): Promise<void> {
  const l = netz.loeser[kanal];
  if (!l) {
    throw new Error(`Kein offener Abruf auf dem Kanal „${kanal}"`);
  }
  netz.loeser[kanal] = undefined;
  await act(async () => {
    l();
    await new Promise((r) => setTimeout(r, 0));
  });
  await ruhe();
}

/** Den Titel des ersten Eintrags austauschen, ohne den geteilten Bestand zu verändern. */
function neuerTitel(titel: string): void {
  netz.bestand = netz.bestand.map((k, i) => (i === 0 ? { ...k, title: titel } : k));
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
  netzLage("ok", "ok", "ok");
  netz.rufe = { suche: 0, kos: 0, detail: 0, versionen: 0 };
  netz.bestand = [...BESTAND] as unknown as { id: string; title?: string }[];
  netz.loeser = {};
});

afterEach(() => {
  abbauen();
});

// ------------------------------------------------------------------------------------------------
// Der Wortlaut-Pin: der Sollwert oben und die Produkttabelle müssen übereinstimmen.
// ------------------------------------------------------------------------------------------------
describe("JOB 3088 · Wortlaut-Pin", () => {
  it("lib.lesen.fehler lautet auf Deutsch genau so", () => {
    expect(String(i18n.getResource("de", "translation", "lib.lesen.fehler"))).toBe(LESEN_FEHLER);
  });
});

// ------------------------------------------------------------------------------------------------
// FALL A — der Kern. Vor der Änderung: `detail` +0, und dieser Fall war rot.
// ------------------------------------------------------------------------------------------------
describe("JOB 3088 · A — der Listenknopf holt den gelesenen Eintrag mit zurück", () => {
  it("nach dem Klick wird /api/kos/:id GENAU EINMAL gerufen — Liste und Eintrag zusammen", async () => {
    await gelesen();
    expect(leseTitel(), "der Eintrag muss erst einmal wirklich dagestanden haben").toBe(
      "Ventil X bei Ueberdruck schliessen",
    );

    // Das Netz bricht weg: alle drei Abfragen scheitern beim Nachschlag, der Bestand bleibt liegen.
    netzLage("fehler", "fehler", "fehler");
    await frischeAuf();

    const zustand = qc.getQueryState([...DETAIL_SCHLUESSEL]);
    expect(zustand?.status, "die Detailabfrage muss wirklich gescheitert sein").toBe("error");
    expect(zustand?.data, "und ihr Bestand muss wirklich noch im Speicher liegen").toBeTruthy();

    const vorher = { ...netz.rufe };
    await erneutVersuchen();

    expect(netz.rufe.suche, "die Suche wird geholt wie bisher").toBe((vorher.suche ?? 0) + 1);
    expect(netz.rufe.kos, "der Bestand wird geholt wie bisher").toBe((vorher.kos ?? 0) + 1);
    // Der Kern: vor JOB 3088 stand hier +0 („Der Listenknopf hat den gelesenen Eintrag nicht mit
    // zurückgeholt"). Genau EINS, nicht zwei — ein doppelter Ruf wäre die stille Doppelung.
    expect(
      netz.rufe.detail,
      "Der Listenknopf hat den gelesenen Eintrag nicht mit zurückgeholt.",
    ).toBe((vorher.detail ?? 0) + 1);
  });
});

// ------------------------------------------------------------------------------------------------
// FALL B — die sichtbare Folge: der Fehlersatz geht von SELBST weg, ohne Zutun an der Lesefläche.
// ------------------------------------------------------------------------------------------------
describe("JOB 3088 · B — der Fehlersatz über der Lesefläche verschwindet durch den Listenknopf", () => {
  it("gelingt der zweite Detailruf, steht der Titel da und der Fehlersatz ist weg", async () => {
    // Der Detailabruf scheitert von Anfang an — es gibt keinen Bestand, also den Fehlerzweig
    // (`BibliothekLesen.tsx:404-417`) samt seinem eigenen kleinen Knopf.
    netzLage("ok", "ok", "fehler");
    await gelesen();
    expect(container.textContent).toContain(LESEN_FEHLER);

    // Erst jetzt bricht auch die Liste weg: dadurch trägt die Fläche ihren Hinweis samt dem GROSSEN
    // Knopf — der ist der Gegenstand dieses Auftrags.
    netzLage("fehler", "fehler", "fehler");
    await frischeAuf();
    expect(qc.getQueryState([...DETAIL_SCHLUESSEL])?.status).toBe("error");
    expect(container.textContent, "der Fehlersatz steht vor dem Klick da").toContain(LESEN_FEHLER);

    // Das Netz ist wieder da. EIN Klick auf den Listenknopf, nichts sonst.
    netzLage("ok", "ok", "ok");
    const vorher = { ...netz.rufe };
    await erneutVersuchen();

    expect(netz.rufe.detail).toBe((vorher.detail ?? 0) + 1);
    expect(leseTitel(), "der Eintrag ist wieder da").toBe("Ventil X bei Ueberdruck schliessen");
    expect(container.textContent, "und sein Fehlersatz ist von selbst gegangen").not.toContain(
      LESEN_FEHLER,
    );
  });
});

// ------------------------------------------------------------------------------------------------
// FALL C — kein Ruf ins Leere.
// ------------------------------------------------------------------------------------------------
describe("JOB 3088 · C — ohne gewählten Eintrag ruft der Knopf keinen Eintrag ab", () => {
  it("leere Liste, nichts gewählt: der Klick löst NULL /api/kos/:id aus", async () => {
    netz.bestand = [];
    await bibliothek();
    expect(container.querySelector('[data-testid="bib-lesen"]'), "nichts steht rechts").toBeNull();

    netzLage("fehler", "fehler", "fehler");
    await frischeAuf();

    const vorher = { ...netz.rufe };
    await erneutVersuchen();

    expect(netz.rufe.suche, "der Knopf tut sehr wohl etwas").toBe((vorher.suche ?? 0) + 1);
    expect(netz.rufe.kos).toBe((vorher.kos ?? 0) + 1);
    expect(netz.rufe.detail, "aber er ruft keinen Eintrag ab, den niemand liest").toBe(
      vorher.detail ?? 0,
    );
    expect(netz.rufe.detail, "und es gab hier nie einen Detailruf").toBe(0);
  });
});

// ------------------------------------------------------------------------------------------------
// FALL D — die Reichweite ist festgeschrieben: `exact: true`.
// ------------------------------------------------------------------------------------------------
describe("JOB 3088 · D — die Reichweite des Knopfs: nur die Detailabfrage, nicht ihr Präfix", () => {
  it('die Versionsliste unter `["ko", id, "versions"]` wird NICHT mitgerufen', async () => {
    await gelesen();

    // Die Zeile „Mehr" aufklappen — erst dann hält `MehrAbschnitte` die Versionsabfrage
    // (`MehrAbschnitte.tsx:151`). Ohne sie wäre dieser Fall trivial grün.
    const mehr = container.querySelector('[data-testid="bib-mehr"]');
    if (!(mehr instanceof HTMLButtonElement)) {
      throw new Error(`Zeile „Mehr" fehlt; DOM: ${container.textContent}`);
    }
    await act(async () => {
      mehr.click();
      await new Promise((r) => setTimeout(r, 0));
    });
    await ruhe();
    expect(netz.rufe.versionen, "die Versionsabfrage muss wirklich montiert sein").toBeGreaterThan(
      0,
    );

    netzLage("fehler", "fehler", "fehler");
    await frischeAuf();

    const vorher = { ...netz.rufe };
    await erneutVersuchen();

    expect(netz.rufe.detail, "der gelesene Eintrag kommt zurück").toBe((vorher.detail ?? 0) + 1);
    // DIE ENTSCHEIDUNG, FESTGESCHRIEBEN: `exact: true`. Über die Versionsliste sagt dieser Knopf
    // nichts, also ruft er sie auch nicht. Wer das Feld entfernt oder auf den Präfix umstellt,
    // macht genau diese Zeile rot.
    expect(netz.rufe.versionen, "die Versionsliste bleibt unberührt (exact: true)").toBe(
      vorher.versionen ?? 0,
    );
  });
});

// ------------------------------------------------------------------------------------------------
// FALL E (RUNDE 2, Befund BEN, Korrekturpflicht 1) — CACHE MIT LAUFENDER AUFFRISCHUNG.
// ------------------------------------------------------------------------------------------------
// Auftrag §9, wörtlich: „Cache mit laufender Auffrischung: Bestand bleibt sichtbar, kein
// Fehlersatz, kein zweiter Ruf durch den Klick, solange einer läuft."
//
// Runde 1 verletzte das, ohne es zu merken: `refetchQueries` bricht vorgabemäßig
// (`cancelRefetch: true`) den laufenden Abruf ab und startet ihn neu. Eine Rufzählung über
// ABGESCHLOSSENE Abrufe sieht das nicht — deshalb hängt hier ein kontrolliert offenes Versprechen
// im Netz, das der Test selbst einlöst.
describe("JOB 3088 · E — läuft schon ein Detailabruf, startet der Knopf keinen zweiten", () => {
  it("null zusätzliche Detailrufe, und das laufende Ergebnis wird danach übernommen", async () => {
    await gelesen();
    expect(leseTitel()).toBe("Ventil X bei Ueberdruck schliessen");

    // Die Listen brechen weg (nur so bietet die Fläche den großen Knopf überhaupt an), der
    // Detailabruf LÄUFT dagegen noch — er ist losgeschickt und antwortet nicht.
    netzLage("fehler", "fehler", "haengt");
    await frischeAuf();
    expect(
      qc.getQueryState([...DETAIL_SCHLUESSEL])?.fetchStatus,
      "der Detailabruf muss wirklich laufen",
    ).toBe("fetching");
    expect(
      qc.getQueryState([...DETAIL_SCHLUESSEL])?.data,
      "und der Bestand muss dabei liegen bleiben",
    ).toBeTruthy();
    expect(leseTitel(), "der Bestand bleibt sichtbar").toBe("Ventil X bei Ueberdruck schliessen");
    // Der laufende Abruf erzeugt über dem Eintrag KEINE Fehleraussage (der eine datierte Satz auf
    // dieser Fläche gehört der Liste, deren Abrufe wirklich gescheitert sind — JOB 3063 R6).
    expect(container.textContent, "ein laufender Abruf ist kein Fehler").not.toContain(
      LESEN_FEHLER,
    );

    // Der laufende Abruf bringt einen NEUEREN Stand mit, als beim Losschicken im Speicher lag —
    // daran ist gleich zu erkennen, dass sein Ergebnis ankommt und nicht verworfen wurde.
    neuerTitel("Ventil X — nachgefuehrte Fassung");

    const vorher = { ...netz.rufe };
    await erneutVersuchen();

    expect(netz.rufe.detail, "Ein laufender Detailabruf darf keinen zweiten GET auslösen").toBe(
      vorher.detail ?? 0,
    );
    expect(
      qc.getQueryState([...DETAIL_SCHLUESSEL])?.fetchStatus,
      "der EINE Abruf läuft unverändert weiter",
    ).toBe("fetching");

    // Und er wird nicht ins Leere gelaufen sein: kommt er an, steht sein Ergebnis auf der Fläche.
    await loese("detail");
    expect(leseTitel(), "das Ergebnis des laufenden Abrufs wird übernommen").toBe(
      "Ventil X — nachgefuehrte Fassung",
    );
  });
});

// ------------------------------------------------------------------------------------------------
// FALL F (RUNDE 2, Befund BEN, Prüflücke 6) — ERHOLUNG MIT VORHANDENEM BESTAND.
// ------------------------------------------------------------------------------------------------
// Fall B startet ausdrücklich OHNE Bestand (Erstabruf gescheitert, Fehlerzweig). Der Fall, den
// Codex an Live 1.98 gemessen hat, ist der andere: Bestand da, Auffrischung gescheitert, datierter
// Satz auf der Fläche. Hier wird gemessen, dass genau DIESER Satz durch den Listenknopf weggeht
// und der Eintrag dabei wirklich neu geholt wird.
describe("JOB 3088 · F — mit Bestand: der datierte Hinweis geht weg, der Eintrag ist neu geholt", () => {
  it("nach dem Klick kein „Auffrischung fehlgeschlagen“ mehr, und der Eintrag trägt den neuen Stand", async () => {
    await gelesen();
    expect(leseTitel()).toBe("Ventil X bei Ueberdruck schliessen");

    netzLage("fehler", "fehler", "fehler");
    await frischeAuf();
    const detailZustand = qc.getQueryState([...DETAIL_SCHLUESSEL]);
    expect(detailZustand?.status, "die Detailabfrage ist gescheitert").toBe("error");
    expect(detailZustand?.data, "hat aber weiter ihren Bestand").toBeTruthy();
    expect(hinweise().length, "der datierte Satz steht auf der Fläche").toBeGreaterThanOrEqual(1);
    expect(leseTitel(), "und der Eintrag steht weiter da").toBe(
      "Ventil X bei Ueberdruck schliessen",
    );

    // Das Netz ist wieder da und trägt einen neuen Stand des Eintrags.
    netzLage("ok", "ok", "ok");
    neuerTitel("Ventil X — nachgefuehrte Fassung");
    const vorher = { ...netz.rufe };
    await erneutVersuchen();

    expect(netz.rufe.detail).toBe((vorher.detail ?? 0) + 1);
    expect(hinweise(), "der datierte Satz ist von selbst gegangen").toHaveLength(0);
    expect(leseTitel(), "und der Eintrag trägt den neu geholten Stand").toBe(
      "Ventil X — nachgefuehrte Fassung",
    );
  });
});
