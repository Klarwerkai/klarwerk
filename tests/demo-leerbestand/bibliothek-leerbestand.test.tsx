// @vitest-environment jsdom
// ================================================================================================
// JOB 3762 · L3 — DIE LEERE BIBLIOTHEK SAGT ETWAS ANDERES ALS DIE ERGEBNISLOSE SUCHE.
// ================================================================================================
//
// BEFUND VOR DEM BAU, und er gehört an den Anfang dieser Datei: die Zusage aus Lieferung 3 war auf
// `/bibliothek` BEREITS GEBAUT, bevor dieser Auftrag lief. Sie steht nicht in `pages/Library.tsx`
// (das ist seit JOB 3063 eine Hülle um `BibliothekFlaeche`), sondern in
// `components/bibliothek/BibliothekListe.tsx:386-393`:
//
//     {!laedt && !fehler && !pausiert && eintraege.length === 0 ? (
//       <div data-testid="bib-leer" …>
//         {q.trim() ? t("lib.liste.leerSuche") : t("lib.liste.leer")}
//         … {leerAktion}
//
// Zwei verschiedene Sätze (`lib.liste.leer` „Noch keine Einträge." / `lib.liste.leerSuche` „Nichts
// gefunden."), in DE, EN und NL vorhanden, dazu der erste Schritt als Knopf (`bib-leer-erfassen`,
// `BibliothekFlaeche.tsx:1463`) — und die drei Ausschlüsse `laedt`/`fehler`/`pausiert` sind genau
// das, was L5 verlangt. Dieser Auftrag baut die Zusage deshalb NICHT ein zweites Mal (Lieferung 6:
// „ein gemeinsamer Weg, kein dritter"); er BINDET sie fest. Bis hierher hing sie an den Tests der
// Aufträge, die sie gebaut haben (JOB 3099/3531) — keiner davon misst den Fall der leeren INSTANZ.
//
// WAS DIESE DATEI ALSO IST: der Wächter über eine vorhandene, gemessene Zusage — aus der Sicht der
// frisch aufgesetzten Demo. Vertauscht jemand die zwei Sätze, werden L3 und L3b rot.
//
// EIN BENANNTER RESTFALL, gemessen und ABSICHTLICH nicht hier grün gebogen (s. L3c): die
// Unterscheidung hängt allein am SUCHBEGRIFF (`q.trim()`), nicht an den übrigen Wahlen. Ein
// gefüllter Bestand mit einem Segment- oder Facettenfilter ohne Treffer und leerem Suchfeld zeigt
// deshalb „Noch keine Einträge." — eine Aussage über den BESTAND, obwohl nur die AUSWAHL leer ist.
// Die Stelle liegt in `BibliothekListe.tsx`/`BibliothekFlaeche.tsx` und damit ausserhalb der
// Zielpfade dieses Auftrags (§4); sie ist in der Rückgabe unter ABWEICHUNGEN benannt, nicht
// angefasst. L3c hält den Ist-Zustand fest, damit er nicht unbemerkt bleibt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

/** Ein Wissensobjekt — so vollständig, wie die Liste es liest. */
const KO = {
  id: "ko-1",
  title: "Ventil V1 prüfen",
  statement: "",
  conditions: [],
  measures: [],
  type: "best_practice",
  category: "Anlage 1",
  tags: [],
  confidence: 0,
  trust: 0,
  status: "validiert",
  version: 1,
  originalAuthor: "u1",
  author: "u1",
  neededValidations: 2,
  assignments: [],
  asset: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  history: [{ version: 1, at: "2026-08-01T00:00:00.000Z", author: "u1", note: "erstellt" }],
} as unknown as KnowledgeObject;

/**
 * Die Felder, die `BibliothekFlaeche` an einer Abfrage WIRKLICH liest — und die Runde 1 nur zum
 * Teil setzte (Bens Prüflücke 6): `fetchStatus` trägt das Anhalten (`:754`, `angehalten()`), NICHT
 * `isPaused`; `dataUpdatedAt` trägt den Stand im Auffrischungshinweis (`AuffrischungHinweis.tsx`).
 * Ohne beide waren die Übergänge aus §9 auf dieser Fläche gar nicht darstellbar.
 */
const abfrage = (
  data: unknown,
  extra: Partial<{ isLoading: boolean; isError: boolean; fetchStatus: string }> = {},
): Record<string, unknown> => ({
  data,
  isLoading: false,
  isError: false,
  isPaused: false,
  isRefetchError: false,
  fetchStatus: "idle",
  dataUpdatedAt: data === undefined ? 0 : Date.parse("2026-09-12T09:00:00.000Z"),
  ...extra,
});

const lage = vi.hoisted(() => ({
  /** `GET /api/library/search` — die Trefferliste der Fläche. */
  suche: {} as Record<string, unknown>,
  /** `GET /api/ko` — der Bestand, an dem Zustand und Filterschiene hängen. */
  bestand: {} as Record<string, unknown>,
}));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    koQueryKey: ["kos", undefined],
    useKos: () => ({ ...lage.bestand, error: null }),
    useLibrarySearch: () => ({ ...lage.suche, error: null }),
    useDirectory: () => ok([]),
    useConflicts: () => ok([]),
    useEigeneBefunde: () => ok([]),
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
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

function mount(adresse = "/bibliothek"): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    neu.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [adresse] }, createElement(Library)),
      ),
    );
  });
}

const leerfeld = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="bib-leer"]');
const leertext = (): string => (leerfeld()?.textContent ?? "").replace(/\s+/g, " ");

beforeEach(async () => {
  await i18n.changeLanguage("de");
  lage.suche = abfrage([]);
  lage.bestand = abfrage([]);
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
});

describe("JOB 3762 · L3 · die leere Bibliothek", () => {
  it("VORBEDINGUNG: die Oberfläche läuft auf Deutsch", () => {
    expect(i18n.language).toBe("de");
  });

  it("L3 · leerer Bestand, keine Suche ⇒ der Satz über den BESTAND, plus der erste Schritt", () => {
    mount();
    expect(leertext()).toContain(i18n.t("lib.liste.leer"));
    expect(leertext(), "„Nichts gefunden.“ wäre hier die falsche Auskunft").not.toContain(
      i18n.t("lib.liste.leerSuche"),
    );
    // Der erste Schritt ist ein Weg, kein Satz daneben (`BibliothekFlaeche.tsx:1463`).
    const knopf = container.querySelector<HTMLAnchorElement>('[data-testid="bib-leer-erfassen"]');
    expect(knopf?.getAttribute("href")).toBe("/erfassen");
  });

  it("L3-EN/NL · derselbe Satz in allen drei Sprachen", async () => {
    for (const sprache of ["en", "nl"]) {
      await i18n.changeLanguage(sprache);
      mount();
      const satz = i18n.t("lib.liste.leer");
      expect(satz, `Schlüssel fehlt in ${sprache}`).not.toBe("lib.liste.leer");
      expect(leertext(), sprache).toContain(satz);
      act(() => root?.unmount());
      container.remove();
      root = null;
    }
  });

  it("L3b · Bestand VORHANDEN, Suche ohne Treffer ⇒ der ANDERE Satz", () => {
    lage.bestand = abfrage([KO]);
    lage.suche = abfrage([]);
    mount("/bibliothek?q=gibtesnicht");
    expect(leertext()).toContain(i18n.t("lib.liste.leerSuche"));
    expect(
      leertext(),
      "„Noch keine Einträge.“ behauptete hier etwas über den Bestand, der nicht leer ist",
    ).not.toContain(i18n.t("lib.liste.leer"));
  });

  it("L3c · BENANNTER RESTFALL: ohne Suchbegriff entscheidet nur `q` — ein Filter ohne Treffer sagt „Bestand leer“", () => {
    // Bestand da, aber das Segment „Offen" (`?zustand=offen`, `BibliothekFlaeche.tsx:107`) passt
    // auf keinen Eintrag — das einzige Objekt ist validiert. Das
    // Suchfeld ist leer. `BibliothekListe.tsx:389` fragt nur `q.trim()` und wählt deshalb den
    // BESTANDS-Satz. Das ist der in der Rückgabe benannte Restfall — er liegt ausserhalb der
    // Zielpfade dieses Auftrags und wird hier festgehalten, nicht behauptet.
    lage.bestand = abfrage([KO]);
    lage.suche = abfrage([KO]);
    mount("/bibliothek?zustand=offen");
    expect(leertext(), "Ist-Zustand, kein Sollzustand").toContain(i18n.t("lib.liste.leer"));
  });
});

describe("JOB 3762 · L5 · die Bibliothek behauptet nichts ohne Grundlage", () => {
  it("L5-Bib-a · gescheiterter Abruf ⇒ kein Leersatz, sondern der Fehler mit dem Weg zurück", () => {
    lage.suche = abfrage(undefined, { isError: true });
    lage.bestand = abfrage(undefined, { isError: true });
    mount();
    expect(leerfeld(), "eine Störung darf nicht wie Leere aussehen").toBeNull();
    const text = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(text).toContain(i18n.t("lib.liste.fehler"));
    expect(text).not.toContain(i18n.t("lib.liste.leer"));
  });

  it("L5-Bib-b · laufender Erstabruf ⇒ kein Leersatz, keine Zeile", () => {
    lage.suche = abfrage(undefined, { isLoading: true, fetchStatus: "fetching" });
    lage.bestand = abfrage(undefined, { isLoading: true, fetchStatus: "fetching" });
    mount();
    expect(leerfeld()).toBeNull();
    const text = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(text).not.toContain(i18n.t("lib.liste.leer"));
    expect(text).not.toContain(i18n.t("lib.liste.leerSuche"));
  });

  it("L5-Bib-c · GEGENPROBE MIT BESTAND: mit Treffern steht gar kein Leersatz da", () => {
    lage.bestand = abfrage([KO]);
    lage.suche = abfrage([KO]);
    mount();
    expect(leerfeld()).toBeNull();
  });

  // ----------------------------------------------------------------------------------------------
  // L5-Bib-d/-e — DIE ÜBERGÄNGE AUS §9, DIE RUNDE 1 NICHT GEMESSEN HAT (Bens Prüflücke 6).
  // ----------------------------------------------------------------------------------------------
  // „Es fehlen die Übergänge von leerem Cache zu laufender, gescheiterter und pausierter
  // Auffrischung." Der laufende Nachlauf ändert an dieser Fläche nichts (`laedt` hängt an
  // `isLoading`, also am ERSTabruf — L5-Bib-b misst ihn); die zwei anderen sind hier.
  it("L5-Bib-d · leer bestätigt, Auffrischung GESCHEITERT ⇒ der Leersatz bleibt, mit „Stand von …“", () => {
    // `fehler` verlangt `isError && data === undefined` (`BibliothekFlaeche.tsx:1394`) — mit einem
    // bestätigten `[]` ist das falsch, der Bestand bleibt also stehen (REGELN §7).
    lage.suche = abfrage([], { isError: true });
    lage.bestand = abfrage([]);
    mount();
    expect(leertext(), "ein gescheiterter Nachlauf leert die Liste nicht").toContain(
      i18n.t("lib.liste.leer"),
    );
    // Und er steht nicht unkommentiert da: „Stand von <Zeit> · Auffrischung fehlgeschlagen".
    expect(
      container.querySelector('[data-testid="auffrischung-fehlgeschlagen"]'),
      "§9: die Datenlagezeile sagt ehrlich, dass die Auffrischung gescheitert ist",
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="bib-hinweis-erneut"]')).not.toBeNull();
  });

  it("L5-Bib-e · leer bestätigt, Abruf ANGEHALTEN (offline) ⇒ der Satz über die VERBINDUNG, nicht über den Bestand", () => {
    // Offline geht gar kein Ruf hinaus (`fetchStatus: "paused"`). Die Fläche sagt dann, was mit IHR
    // ist — nie etwas über den Bestand (`BibliothekListe.tsx:369`, JOB 3531). Der Leersatz weicht
    // dem Verbindungssatz, und beide stehen nie zugleich da.
    lage.suche = abfrage([], { fetchStatus: "paused" });
    lage.bestand = abfrage([], { fetchStatus: "paused" });
    mount();
    expect(container.querySelector('[data-testid="bib-offline"]')).not.toBeNull();
    expect(leerfeld(), "zwei Auskünfte nebeneinander wären eine zu viel").toBeNull();
    const alles = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(alles).toContain(i18n.t("lib.liste.offline"));
    expect(alles, "keine Aussage über den Bestand ohne frische Grundlage").not.toContain(
      i18n.t("lib.liste.leer"),
    );
  });
});
