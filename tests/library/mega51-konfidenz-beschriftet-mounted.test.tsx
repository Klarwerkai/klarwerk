// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega51 BLOCK D — DER BALKEN SAGT, WAS ER ZEIGT, UND DIE BEDINGUNG LIEST DENSELBEN WERT.
// ================================================================================================
// ZWEI FEHLER AN EINER STELLE, beide an der ECHTEN, gemounteten Bibliothek belegt:
//
//  D1  `ConfidenceBar` rendert Balken und nackte Zahl OHNE `title`, `aria-label` oder
//      `role="progressbar"` — an jeder Trefferzeile. Eine Erstnutzerin liest eine Zahl zwischen 0
//      und 100 und weiß nicht, wovon sie handelt; eine Vorlesehilfe liest gar nichts.
//
//  D2  Der Sonderfall, der die auffällige „0" erklären soll, las `k.trust` — angezeigt wird aber
//      `k.confidence`. DER FALL, DER DAS SICHTBAR MACHT: `trust > 0` UND `confidence = 0`. Der
//      alte Code sprang nicht an (trust ist nicht 0) und stellte die unerklärte Null hin.
//      Genau dieser Fall steht unten als eigener Treffer im Bestand.
//
// Die Gegenprobe (`trust = 0`, `confidence > 0`) ist genauso wichtig: sie zeigt, dass die
// Korrektur den Hinweis nicht einfach überall anschaltet — die Leiste erscheint dort mit ihrem
// echten Wert.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

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
    confidence: 0,
    trust: 0,
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

// DER FALL AUS D2: Nutzungs-Bewertungen liegen vor, die Sicherheit ist trotzdem 0.
const KO_TRUST_OHNE_KONFIDENZ = ko({
  id: "d2",
  title: "Trust vorhanden, Sicherheit null",
  trust: 7,
  confidence: 0,
});
// Die Gegenprobe: keine Nutzungs-Bewertungen, aber eine echte Sicherheit.
const KO_KONFIDENZ_OHNE_TRUST = ko({
  id: "gegen",
  title: "Sicherheit vorhanden, Trust null",
  trust: 0,
  confidence: 72,
});
const KOS = [KO_TRUST_OHNE_KONFIDENZ, KO_KONFIDENZ_OHNE_TRUST];

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok(KOS),
    useLibrarySearch: () => ok(KOS),
    useDirectory: () => ok([]),
    useConflicts: () => ok([]),
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

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: ["/bibliothek"] }, createElement(Library)),
      ),
    );
  });
}

// Die Zeile eines Treffers — über seinen Titel gefunden, nicht über eine Position in der Liste.
function zeileVon(titel: string): HTMLElement {
  const treffer = [...container.querySelectorAll("li, div")].find(
    (e) => (e.textContent ?? "").includes(titel) && e.querySelectorAll("a").length <= 3,
  );
  if (!treffer) {
    throw new Error(`Trefferzeile „${titel}" nicht gefunden`);
  }
  return treffer as HTMLElement;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("mega51 D · die Sicherheitsanzeige der Trefferzeile", () => {
  it("D1: der Balken trägt Rolle, Wert und eine Beschriftung, die sagt, WAS der Wert ist", () => {
    mount();
    const balken = container.querySelector('[role="progressbar"]');
    expect(balken).not.toBeNull();
    expect(balken?.getAttribute("aria-valuemin")).toBe("0");
    expect(balken?.getAttribute("aria-valuemax")).toBe("100");
    // Der Wert steht nicht mehr nackt da: die Beschriftung nennt ihn beim Namen.
    expect(balken?.getAttribute("aria-label")).toBe(
      i18n.t("evidence.confidenceLabel", { pct: 72 }),
    );
    expect(balken?.getAttribute("aria-valuenow")).toBe("72");
  });

  it("D2: trust > 0 UND confidence = 0 → der Hinweis erscheint, keine unerklärte Null", () => {
    mount();
    const zeile = zeileVon("Trust vorhanden, Sicherheit null");
    // Der Sonderfall greift — VOR mega51 tat er das hier NICHT (er las trust, und trust ist 7).
    expect(zeile.textContent).toContain(i18n.t("lib.confidenceNone"));
    // Und die Leiste, die sonst die 0 zeigte, steht in dieser Zeile nicht.
    expect(zeile.querySelector('[role="progressbar"]')).toBeNull();
  });

  it("D2 Gegenprobe: trust = 0 UND confidence > 0 → die Leiste zeigt ihren echten Wert", () => {
    mount();
    const zeile = zeileVon("Sicherheit vorhanden, Trust null");
    expect(zeile.textContent).not.toContain(i18n.t("lib.confidenceNone"));
    expect(zeile.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("72");
  });

  it("Bedingung und Anzeige lesen denselben Wert — genau ein Treffer trägt den Hinweis", () => {
    mount();
    const mitHinweis = [...container.querySelectorAll("span")].filter(
      (e) => e.textContent === i18n.t("lib.confidenceNone"),
    );
    expect(mitHinweis).toHaveLength(1);
  });
});
