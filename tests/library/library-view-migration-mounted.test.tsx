// @vitest-environment jsdom
// AUFTRAG-uxpol2 (bens Blocker 1.2 + 4.2): ECHTER, gemounteter Library-Seam — kein künstliches
// Harness. Die reale Library-Seite wird gerendert (nur die Netz-Hooks/Contexts sind Stubs), sodass
// die ECHTE applyView-Migration und das ECHTE Facetten-Filterverhalten laufen. Gepinnt:
//  (a) Eine alte gespeicherte Sicht `status:"offen"` hält NACH der Migration BEIDE offenen KOs —
//      das unzugewiesene (Anzeigestatus „offen") UND das zugewiesene (Anzeigestatus „pruefung").
//      Eine naive 1:1-Übernahme (status:["offen"]) würde das zugewiesene KO verlieren.
//  (b) Mehrfachauswahl innerhalb der Status-Gruppe wirkt als ODER (ein Status abwählen blendet nur
//      dessen KOs aus; beide gewählt → Vereinigung).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Ventil entlasten",
    statement: "",
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
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

const KO_OPEN = ko({ id: "k-open", title: "Offen Unzugewiesen", status: "offen", assignments: [] });
const KO_ASSIGNED = ko({
  id: "k-assigned",
  title: "Offen Zugewiesen",
  status: "offen",
  assignments: ["u2"],
});
const KOS = [KO_OPEN, KO_ASSIGNED];

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok(KOS),
    useLibrarySearch: () => ok(KOS),
    useDirectory: () => ok([]),
    useConflicts: () => ok([]),
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
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/app/ToastContext", () => ({
  useToast: () => ({ push: () => {} }),
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { Library } from "../../apps/web/src/pages/Library";
import { waehleImMenue, zeilenTitel } from "./support/bib-flaeche";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

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
        createElement(MemoryRouter, { initialEntries: [entry] }, createElement(Library)),
      ),
    );
  });
}

function res(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

// JOB 3063 (H4): die gespeicherten Sichten und die Reife-Facette liegen in Menüs. Der GEPRÜFTE PFAD
// ist unverändert derselbe (`applyView` → `migrateSavedFacetSelection` → `foldStatusIntoMaturity`
// bzw. `toggleFacetValue`); nur der Griff ist ein anderer.
function sichtAnwenden(name: string): void {
  waehleImMenue(container, "bib-liste-menue", name);
}

function reifeWaehlen(label: string): void {
  waehleImMenue(container, "bib-menue-filter", label);
}

function titel(): string[] {
  return zeilenTitel(container);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  window.localStorage.clear();
});

describe("uxpol2: gemountete Library — Sicht-Migration + ODER-Filter (echter Seam)", () => {
  it('(a) alte Sicht status:"offen" hält BEIDE offenen KOs (unzugewiesen + zugewiesen)', () => {
    // Legacy-Sicht (vor uxpol2) mit rohem Backendstatus — genau der Fall aus bens Blocker 1.2.
    window.localStorage.setItem(
      "klarwerk.library.views.u1",
      JSON.stringify([{ name: "Alt-Offen", state: { status: "offen" } }]),
    );
    mount();
    // Vor dem Anwenden sind beide KOs sichtbar (kein Filter aktiv).
    expect(titel()).toContain("Offen Unzugewiesen");
    expect(titel()).toContain("Offen Zugewiesen");

    // Die gespeicherte Sicht anwenden — sie steht im Menü „…" der Liste unter „Sichten".
    sichtAnwenden("Alt-Offen");

    // Filter ist aktiv (am Menü als Zahl abzulesen), aber BEIDE offenen KOs bleiben sichtbar —
    // semantiktreu.
    expect(container.querySelector('[data-testid="bib-menue-filter"]')?.textContent).toContain(
      "· 1",
    );
    expect(titel()).toContain("Offen Unzugewiesen");
    expect(titel()).toContain("Offen Zugewiesen"); // würde bei naiver Migration fehlen
  });

  it("(b) ODER innerhalb der Reife-Gruppe: eine Reife abwählen blendet nur deren KOs aus", () => {
    // AUFTRAG-uxpol5 · Punkt 1: die redundante Status-Facette ist entfernt; dasselbe ODER-Verhalten
    // wird über die Reife-Facette gepinnt (der Kontext-Zähler „ · 1" macht die Einträge eindeutig).
    mount();
    // Nur „Zu prüfen" (Reife · 1) wählen → das zugewiesene (In Prüfung) KO fällt raus.
    reifeWaehlen(`${res("use.open.label")} · 1`);
    expect(titel()).toContain("Offen Unzugewiesen");
    expect(titel()).not.toContain("Offen Zugewiesen");
    // Reife „In Prüfung" (Kontext-Zähler · 1) ergänzen → ODER-Vereinigung, beide wieder sichtbar.
    reifeWaehlen(`${res("use.review.label")} · 1`);
    expect(titel()).toContain("Offen Unzugewiesen");
    expect(titel()).toContain("Offen Zugewiesen");
  });
});

// AUFTRAG-uxpol4 (bens ROT 3.1): Die URL-/Parser-Grenze am ECHTEN Seam. Ein Deep-Link mit dem früheren
// Sentinel-String darf den internen No-Match-Zustand NICHT einschleusen.
//
// AUFTRAG-mega11 Block C (bens SB-3) hat diese Grenze VERSCHÄRFT, und die Erwartung zieht mit: bis
// mega10 landete der Sentinel als ganz normaler, entfernbarer Kategoriewert in der Aktive-Filter-
// Leiste — er war ja „nur ein Wert". Genau das war der neue Weg desselben Blockers: ein Wert aus der
// Adresszeile, den es im Bestand nicht gibt, wurde zu einem ECHTEN Facettenwert und konnte über
// „Diese Suche merken" in eine gespeicherte Sicht wandern. Er wird jetzt am Eingang verworfen.
//
// Die uxpol4-Zusicherung selbst ist unverändert und wird hier weiter gepinnt: aus dem Sentinel wird
// unter KEINEN Umständen der strukturelle No-Match-Zustand. Er wird auch nicht dazu — er wird zu
// gar nichts.
describe("uxpol4: URL kann den No-Match-Zustand nicht einschleusen (echter Seam)", () => {
  it("?category=<früherer Sentinel> erzeugt weder No-Match noch einen echten Facettenwert", () => {
    const former = "__klarwerk_facet_no_match__";
    mount(`/bibliothek?category=${encodeURIComponent(former)}`);
    // Die uxpol4-Grenze: KEIN struktureller No-Match-Hinweis (der stammt allein aus migrierten Sichten).
    expect(container.textContent).not.toContain(res("facet.noMatch"));
    // mega11 Block C: und auch kein echter Wert — kein Filter, keine Pille, kein Eintrag im Zustand.
    expect(container.textContent).not.toContain(res("facet.active"));
    expect(container.textContent).not.toContain(former);
    // Ohne Filter bleibt der volle Bestand sichtbar (statt der bisherigen 0 Treffer).
    expect(container.textContent).toContain("Offen Unzugewiesen");
    expect(container.textContent).toContain("Offen Zugewiesen");
  });
});
