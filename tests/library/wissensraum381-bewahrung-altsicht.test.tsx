// @vitest-environment jsdom
// ==================================================================================================
// AUFTRAG PRO 381 · BÜNDEL 3 (Bewahrung) · `R-15` — EINE ALTSICHT VERLIERT NICHTS.
// ==================================================================================================
//
// PLAN PRO 378 §8.4 `R-15`: „Eine VOR der Welle gespeicherte Sicht stellt exakt ihre alte
// Treffermenge wieder her — fehlender `raum` bedeutet ‚gesamtes Unternehmen', nie ‚leerer Raum'."
//
// WARUM DAS DER GEFÄHRLICHSTE BEWAHRUNGSFEHLER WÄRE, den diese Welle machen könnte: Gespeicherte
// Sichten liegen im Browser des Nutzers und werden Monate alt. Läse die spätere Ortsschicht einen
// FEHLENDEN `raum` als „Raum: keiner“ statt als „kein Raumfilter“, dann fiele über Nacht jede
// gemerkte Suche jedes Nutzers auf null Treffer — und zwar leise, ohne Fehlermeldung, weil ein
// leeres Ergebnis wie ein gültiges Ergebnis aussieht.
//
// DIE PRÄZEDENZ IST IM HAUS BEREITS ENTSCHIEDEN: `facetRangeFromSaved` (`lib/facetRail.ts:317`)
// löst dieselbe Frage für den Bereichsfilter und begründet sie im Quelltext wörtlich — „ein neu
// hinzugekommener Filter darf sie niemals nachträglich verkleinern". Der Ort erbt diese Regel.
//
// DIESE DATEI IST EIN BEWAHRUNGSANKER — HEUTE GRÜN und muss es bleiben.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { ORT_URL_PARAM } from "./support/wissensraum-ort-vertrag";

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
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

const KO_A = ko({ id: "a", title: "Alpha Ventil", category: "Anlage 1", tags: ["ventil"] });
const KO_B = ko({ id: "b", title: "Beta Pumpe", category: "Anlage 2", tags: ["pumpe"] });
const KO_C = ko({ id: "c", title: "Gamma Reifen", category: "Fuhrpark", tags: ["reifen"] });
const KOS = [KO_A, KO_B, KO_C];

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
import { menueOeffnen } from "./support/bib-flaeche";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VIEWS_KEY = "klarwerk.library.views.u1";

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

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function sichtbareTitel(): string[] {
  return KOS.map((k) => k.title).filter((titel) => text().includes(titel));
}

function buttonMitText(gesucht: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(gesucht),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Schaltfläche „${gesucht}“ fehlt; DOM: ${text()}`);
  }
  return btn;
}

/**
 * JOB 3063 (H4): gemerkte Sichten stehen im Menü „…" der Liste, Untermenü „Sichten"
 * (AUFTRAG 3063 §5a). Die ZUSAGE dieser Datei — eine Altsicht stellt exakt ihre alte Menge her —
 * ist davon unberührt; nur der Weg zur Schaltfläche führt jetzt über das Menü.
 */
function sichtenMenue(): void {
  menueOeffnen(container, "bib-liste-menue");
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

describe("PRO 381 · R-15 — eine vor der Welle gespeicherte Sicht bleibt heil", () => {
  it("R-15 (a) BEWAHRUNGSANKER: eine Altsicht ohne `raum` stellt exakt ihre alte Menge her", () => {
    // Eine Sicht im Format VOR dieser Welle: genau die vier Felder aus `currentViewState()`
    // (`Library.tsx:393-398`), kein Ortsfeld — so, wie sie heute im Browser eines Nutzers liegt.
    window.localStorage.setItem(
      VIEWS_KEY,
      JSON.stringify([
        {
          name: "Alt-Anlage-1",
          state: {
            q: "",
            facetSel: { category: ["Anlage 1"] },
            range: { from: "", to: "" },
            groupBy: "none",
          },
        },
      ]),
    );
    mount();
    expect(sichtbareTitel().sort()).toEqual(["Alpha Ventil", "Beta Pumpe", "Gamma Reifen"]);

    sichtenMenue();
    act(() => {
      buttonMitText("Alt-Anlage-1").click();
    });

    // EXAKT die alte Menge — nicht mehr und vor allem nicht weniger.
    expect(sichtbareTitel()).toEqual(["Alpha Ventil"]);
  });

  it("R-15 (b) BEWAHRUNGSANKER: ein fehlender `raum` heisst „gesamtes Unternehmen“, nie „leerer Raum“", () => {
    // Die Sicht filtert auf gar nichts — ihre alte Menge war der ganze Bestand. Ein Ortsstandard,
    // der „kein Raum“ als „Raum: keiner“ läse, machte daraus null Treffer.
    window.localStorage.setItem(
      VIEWS_KEY,
      JSON.stringify([
        { name: "Alt-Alles", state: { q: "", facetSel: {}, range: { from: "", to: "" } } },
      ]),
    );
    mount();
    sichtenMenue();
    act(() => {
      buttonMitText("Alt-Alles").click();
    });
    expect(sichtbareTitel().sort()).toEqual(["Alpha Ventil", "Beta Pumpe", "Gamma Reifen"]);
  });

  it("R-15 (c) BEWAHRUNGSANKER: eine Altsicht kennt das Ortsfeld gar nicht — und das bleibt folgenlos", () => {
    // Die Bauform-Aussage hinter (a) und (b): das Fehlen des Feldes ist der NORMALFALL, nicht der
    // Sonderfall. Genau so behandelt `facetRangeFromSaved` den fehlenden Bereich seit mega10.
    const roh = JSON.parse(
      JSON.stringify({
        q: "",
        facetSel: { category: ["Anlage 1"] },
        range: { from: "", to: "" },
        groupBy: "none",
      }),
    ) as Record<string, unknown>;
    expect(Object.keys(roh)).not.toContain(ORT_URL_PARAM);
    expect(Object.keys(roh)).not.toContain("home");

    window.localStorage.setItem(
      VIEWS_KEY,
      JSON.stringify([{ name: "Alt-Ohne-Ortsfeld", state: roh }]),
    );
    mount();
    sichtenMenue();
    act(() => {
      buttonMitText("Alt-Ohne-Ortsfeld").click();
    });
    expect(sichtbareTitel()).toEqual(["Alpha Ventil"]);
  });
});
