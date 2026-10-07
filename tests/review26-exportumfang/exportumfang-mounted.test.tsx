// @vitest-environment jsdom
// ================================================================================================
// REVIEW26-DESIGN · POSTEN „EXPORTUMFANG" — DER EXPORT SAGT VOR DEM DOWNLOAD, WAS ER ENTHÄLT.
// ================================================================================================
//
// Befund (Nutzerprüfung 08.09., Quelle REVIEW26-DESIGN): im gefilterten Bibliotheksmenü blieb
// unklar, was der Export enthält — der Download brachte Einträge, die nicht in den Treffern standen.
// Ursache: `GET /api/library/export` nimmt nur `format` und liefert alle validierten Einträge
// (vertrauliche nur mit `ko.validate`). Lieferung: der Umfang steht im Untermenü „Export" VOR den
// Formaten, je nach Rolle mit oder ohne vertrauliche Einträge, und jeder Formatlink verweist darauf.
//
// Gemessen an der gemounteten `BibliothekFlaeche` (dieselbe Bauform wie
// `tests/bibliothek-suchraum/risiko-speicherumfang-auswahl-mounted.test.tsx`). Die Teile E5/E6 lesen
// die Serverseite als Text: ändert sich dort der Umfang (Filter, Status), wird der Satz falsch, und
// genau dann soll dieser Prüfstand rot werden.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";

const session = vi.hoisted(() => ({ role: "experte" as string }));

function ko(id: string, title: string, status: "offen" | "validiert"): KnowledgeObject {
  return {
    id,
    title,
    statement: "Wartung",
    type: "best_practice",
    category: "Anlage A",
    tags: ["Wartung"],
    status,
    author: "u2",
    originalAuthor: "u2",
    assignments: [],
    neededValidations: 2,
    asset: null,
    trust: 50,
    confidence: 0,
    version: 1,
    conditions: [],
    measures: [],
    createdAt: "2026-08-20T00:00:00.000Z",
    history: [{ version: 1, author: "u2", at: "2026-08-20T00:00:00.000Z", note: "erstellt" }],
  } as unknown as KnowledgeObject;
}

const KOS: KnowledgeObject[] = [
  ko("v1", "A Ventil validiert", "validiert"),
  ko("o1", "B Ventil offen", "offen"),
];

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({
    data,
    isLoading: false,
    isError: false,
    isRefetchError: false,
    isFetching: false,
    isStale: false,
    fetchStatus: "idle",
    dataUpdatedAt: 100,
    refetch: async () => ({}),
  });
  return {
    useKos: () => ok(KOS),
    useLibrarySearch: () => ok(KOS),
    useConflicts: () => ok([]),
    useDirectory: () => ok([]),
    useKo: () => ({ ...ok(undefined), isLoading: true }),
    useEigeneBefunde: () => ok([]),
    useAudit: () => ok([]),
    koQueryKey: (id: string) => ["ko", id],
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: session.role } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: session.role }),
}));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { BibliothekFlaeche } from "../../apps/web/src/components/bibliothek/BibliothekFlaeche";
import i18n from "../../apps/web/src/i18n";
import { EXPORT_FORMATS } from "../../apps/web/src/lib/libraryExport";
import { menueOeffnen } from "../library/support/bib-flaeche";
import { repoPfad } from "../support/repoPfad";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

function mount(entry: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [entry] }, createElement(BibliothekFlaeche)),
      ),
    );
  });
}

function umfang(): HTMLElement {
  const menue = menueOeffnen(container, "bib-liste-menue");
  const el = menue.querySelector<HTMLElement>('[data-testid="bib-export-umfang"]');
  if (!el) throw new Error("Exportumfang fehlt im Untermenü „Export“");
  return el;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  session.role = "experte";
  window.localStorage.clear();
});
afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
});

describe("REVIEW26 · Exportumfang im Bibliotheksmenü", () => {
  it("E1 · gefilterte Liste: der Umfang steht im Untermenü „Export“ vor jedem Format", () => {
    // Gefiltert auf „offen" — genau der Befundfall: sichtbar ist ein anderer Umfang als der Export.
    mount("/bibliothek?zustand=offen");
    const el = umfang();
    const details = el.closest("details");
    expect(details?.querySelector("summary")?.textContent).toContain(String(i18n.t("lib.export")));
    expect(el.closest('[hidden], [aria-hidden="true"]')).toBeNull();
    const text = el.textContent ?? "";
    expect(text).toContain("alle validierten Einträge");
    expect(text).toContain("Suche und Filter gelten für den Export nicht");
    for (const fmt of EXPORT_FORMATS) {
      const link = details?.querySelector<HTMLAnchorElement>(`[data-testid="bib-export-${fmt}"]`);
      expect(link, fmt).not.toBeNull();
      // Reihenfolge im Dokument: Satz vor Link — gelesen wird er vor dem Download.
      expect(
        el.compareDocumentPosition(link as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
        `der Umfang steht nicht vor ${fmt}`,
      ).toBeTruthy();
      expect(link?.getAttribute("aria-describedby"), fmt).toBe(el.id);
    }
  });

  it("E2 · ohne ko.validate (experte, viewer): ohne vertrauliche Einträge", () => {
    for (const rolle of ["experte", "viewer"]) {
      session.role = rolle;
      mount("/bibliothek");
      expect(umfang().textContent, rolle).toBe(String(i18n.t("exportumfang.ohneVertrauliche")));
      act(() => root?.unmount());
      container.remove();
      root = null;
    }
  });

  it("E3 · mit ko.validate (controller, admin): auch vertrauliche Einträge", () => {
    for (const rolle of ["controller", "admin"]) {
      session.role = rolle;
      mount("/bibliothek");
      expect(umfang().textContent, rolle).toBe(String(i18n.t("exportumfang.mitVertraulichen")));
      act(() => root?.unmount());
      container.remove();
      root = null;
    }
    // KALIBRIERUNG: die beiden Sätze sind wirklich verschieden.
    const mit = i18n.t("exportumfang.mitVertraulichen");
    expect(mit).not.toBe(i18n.t("exportumfang.ohneVertrauliche"));
  });

  it("E4 · EN und NL tragen eigene Sätze, ohne deutschen Rest", async () => {
    for (const sprache of ["en", "nl"] as const) {
      await i18n.changeLanguage(sprache);
      mount("/bibliothek");
      const text = umfang().textContent ?? "";
      expect(text.length, sprache).toBeGreaterThan(20);
      expect(text, sprache).not.toMatch(/Einträge|Suche|Filter gelten/);
      act(() => root?.unmount());
      container.remove();
      root = null;
    }
  });

  it("E5 · Wahrheitsbindung Route: der Export nimmt nur `format` — keine Filter", () => {
    const route = readFileSync(repoPfad("services/app/src/routes/library-routes.ts"), "utf8");
    const zeile = route.split("\n").find((z) => z.includes('"/api/library/export"'));
    expect(zeile, "Exportroute nicht gefunden").toBeDefined();
    expect(zeile).toContain("Querystring: { format?: string }");
    expect(route).toContain('const includeConfidential = can(user.role, "ko.validate");');
  });

  it("E6 · Wahrheitsbindung Dienst: exportiert werden die validierten Einträge", () => {
    const dienst = readFileSync(repoPfad("services/library-analytics/src/service.ts"), "utf8");
    const start = dienst.indexOf("async exportJson(");
    expect(start).toBeGreaterThan(0);
    const rumpf = dienst.slice(start, start + 600);
    expect(rumpf).toContain('this.koService.list({ status: "validiert" })');
    expect(rumpf).toContain("isConfidential(ko.confidentiality)");
  });
});
