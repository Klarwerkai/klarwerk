// @vitest-environment jsdom
// ================================================================================================
// JOB 3063 · H4 RUNDE 6 — DER KNOPF „FRAGEN" IST FÜR DIE VIEWERIN EIN WEG, KEINE LAGE.
// ================================================================================================
//
// BENS PRÜFLÜCKE ZU RUNDE 5 (Punkt 6, zweiter Teil): „Zusätzlich fehlt ein eigener Viewer-Rollentest
// für den Link, obwohl `/fragen` laut `navigation.ts:128-133` ab Viewer freigegeben ist."
//
// WARUM DAS EIN EIGENER FALL SEIN MUSS UND NICHT NEBENBEI MITLÄUFT: der Knopf hängt am RoleLink-Tor
// (`components/RoleLink.tsx`). Das Tor hat ZWEI Fassungen — den begehbaren Link und die gesperrte
// Lage („Kein Zugriff", kein href, kein Klick). Welche erscheint, entscheidet `routePathAllows` an
// einer Adresse MIT Abfrageteil (`/fragen?q=…&ask=1&ko=…`). Bis Runde 5 hat KEIN Fall diese
// Rollenfrage an dieser Fläche gestellt; die niedrigste Rolle ist genau die, an der ein
// versehentlich zu hoch gesetztes Tor zuerst auffällt.
//
// NICHT VAKUÖS — die Fläche weiß wirklich, wer da ist: derselbe Aufbau zeigt der Viewerin KEIN
// „Bearbeiten" im Menü „…" (`canEdit = role !== "viewer"`, BibliothekLesen.tsx:138), der Expertin
// schon. Wäre die Rolle nicht angekommen, fiele genau dieser Vergleich.
import { afterEach, describe, expect, it, vi } from "vitest";

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
    ...overrides,
  } as unknown as KnowledgeObject;
}

const KO_EINS = ko({ id: "k-rolle-1", title: "Ventil X bei Überdruck schließen" });
const KOS = [KO_EINS];

// Die Rolle des Laufs. `vi.hoisted`, weil die Mock-Fabrik vor dem Modulrumpf ausgeführt wird
// (Repo-Muster, s. tests/capture/mega22-vorgang-mounted).
const stand = vi.hoisted(() => ({ rolle: "viewer" as "viewer" | "experte" }));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok(KOS),
    useLibrarySearch: () => ok(KOS),
    useDirectory: () => ok([{ id: "u9", name: "Eva" }]),
    useConflicts: () => ok([]),
    // JOB 3068 (N5): die Lesefläche fragt das eigene Signal jetzt selbst — leer heißt „kein Befund".
    useEigeneBefunde: () => ok([]),
    useKo: (id: string) => ok(KOS.find((k) => k.id === id)),
    useAudit: () => ok([]),
    useReasonerStatus: () => ok({ active: false, mode: "off" }),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: stand.rolle } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: stand.rolle }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { routePathAllows } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { Library } from "../../apps/web/src/pages/Library";
import { menueOeffnen } from "./support/bib-flaeche";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SUCHTEXT = "Spritzzone reinigen";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

/** Fläche mit dieser Rolle öffnen und den einen Eintrag wählen — der echte Klickweg. */
function flaecheMit(rolle: "viewer" | "experte"): void {
  stand.rolle = rolle;
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
          { initialEntries: [`/bibliothek?q=${encodeURIComponent(SUCHTEXT)}`] },
          createElement(Library),
        ),
      ),
    );
  });
  const zeile = container.querySelector(`[data-testid="bib-zeile"][data-bib-id="${KO_EINS.id}"]`);
  if (!(zeile instanceof HTMLElement)) {
    throw new Error(`Zeile fehlt; vorhanden: ${container.textContent}`);
  }
  act(() => {
    zeile.click();
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  stand.rolle = "viewer";
});

function fragenKnopf(): HTMLElement {
  const el = container.querySelector('[data-testid="bib-fragen"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Knopf „Fragen" fehlt; DOM: ${container.textContent}`);
  }
  return el;
}

/** Steht „Bearbeiten" im Menü „…"? Das Menü wird dafür wirklich geöffnet. */
function bearbeitenImMenue(): boolean {
  menueOeffnen(container, "bib-eintrag-menue");
  return container.querySelector('[data-testid="bib-menue-bearbeiten"]') !== null;
}

describe(`JOB 3063 · H4 R6 · Rollenlage am Knopf „Fragen"`, () => {
  it(`Viewerin: „Fragen" ist ein echter Link mit Ziel, Suchtext und Herkunftsmarker`, () => {
    flaecheMit("viewer");
    const knopf = fragenKnopf();
    // Die begehbare Fassung des Tores ist ein <a> MIT href; die gesperrte wäre ein <div>.
    expect(knopf).toBeInstanceOf(HTMLAnchorElement);
    expect(knopf.getAttribute("data-role-no-reach")).toBeNull();
    expect(knopf.getAttribute("aria-disabled")).toBeNull();
    const url = new URL(knopf.getAttribute("href") ?? "", "http://klarwerk.test");
    expect(url.pathname).toBe("/fragen");
    expect(url.searchParams.get("q")).toBe(SUCHTEXT);
    expect(url.searchParams.get("ko")).toBe(KO_EINS.id);
    // Und die Beschriftung ist das eine Wort — nicht „Kein Zugriff".
    expect(knopf.textContent?.trim()).toBe(
      String(i18n.getResource("de", "translation", "lib.ask")),
    );
    expect(knopf.textContent ?? "").not.toContain(
      String(i18n.getResource("de", "translation", "roleLink.noReach")),
    );
  });

  it(`KALIBRIERUNG: derselben Viewerin fehlt „Bearbeiten" im Menü — die Rolle ist wirklich angekommen`, () => {
    flaecheMit("viewer");
    expect(bearbeitenImMenue()).toBe(false);
  });

  it(`KALIBRIERUNG: der Expertin steht „Bearbeiten" im Menü — der Vergleich oben misst etwas`, () => {
    flaecheMit("experte");
    expect(bearbeitenImMenue()).toBe(true);
    // Der Fragen-Knopf bleibt für beide Rollen derselbe Weg.
    expect(fragenKnopf()).toBeInstanceOf(HTMLAnchorElement);
  });

  it("das Tor beantwortet die Rollenfrage AN DER ADRESSE MIT ABFRAGETEIL — und sagt auch Nein", () => {
    flaecheMit("viewer");
    const href = fragenKnopf().getAttribute("href") ?? "";
    expect(href).toContain("?");
    expect(routePathAllows(href, "viewer")).toBe(true);
    // Gegenprobe am gleichen Weg: eine wirklich gesperrte Route mit demselben Abfrageteil wird
    // verneint. Ohne diese Zeile könnte das „true" oben auch aus einem verfehlten Muster stammen.
    expect(routePathAllows(`/validierung${href.slice(href.indexOf("?"))}`, "viewer")).toBe(false);
  });
});
