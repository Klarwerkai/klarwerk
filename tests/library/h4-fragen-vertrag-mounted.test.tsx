// @vitest-environment jsdom
// ================================================================================================
// JOB 3063 · H4 — DER FRAGEN-VERTRAG DER LESEFLÄCHE, ÜBER ALLE DREI ANZEIGEZUSTÄNDE.
// ================================================================================================
//
// CODEX AN RUNDE 4 (Korrekturpflicht 1): „Für jeden ausgewählten Eintrag muss die sichtbare Aktion
// ‚Fragen‘ heißen und einen `/fragen`-Link mit `ko=<ausgewählte ID>` sowie dem aktuellen Suchtext
// als Vorbelegung erzeugen. F13 muss validierte, offene und in Prüfung befindliche Einträge
// abdecken." Bis dahin zog die Lesefläche ihre Aktion aus `lib/libraryMaturity.ts::libraryUseCta`:
// nur ein VALIDIERTER Eintrag bekam „Fragen", alles andere die Beschriftung „Prüfen" und das Ziel
// `/validierung`.
//
// WARUM DIESER FALL GEMOUNTET UND NICHT IN CHROMIUM LÄUFT — gemessen, nicht angenommen:
// „In Prüfung" leitet `deriveStatus` ausschliesslich aus `KnowledgeObject.assignments` ab. Dieses
// Feld wird bei der Anlage einmalig auf `[]` gesetzt (`services/knowledge-object/src/service.ts:1644`)
// und von KEINEM Schreibweg des Produkts je geändert — festgehalten in
// `services/app/src/routes/ko-routes.ts:581-584`; die echten Zuweisungen liegen im `AssignmentRepo`
// des Validierungsmoduls und reisen nicht am Objekt mit. Über die echte Schnittstelle ist der
// Zustand auf dieser Fläche also NICHT herstellbar; der Chromium-Fall F13
// (`tests/design/h4-funktionsinventar.test.ts`) misst deshalb die zwei erreichbaren Zustände am
// echten Bestand, dieser Fall alle drei an der gemounteten Fläche.
//
// GEMESSEN WIRD AN DER ECHTEN FLÄCHE MIT ECHTEM KLICKPFAD: Suchtext in der Adresse, Zeile anklicken,
// Knopf auslesen. Ein Test auf die reine Funktion `fragenHref` bewiese nur, dass eine Zeichenkette
// gebaut werden KANN — nicht, dass sie am gewählten Eintrag steht.
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
    confidentiality: "oeffentlich",
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

// Die drei Zustände, die `deriveStatus` auf dieser Fläche kennt — je ein Eintrag.
const KO_VALIDIERT = ko({ id: "k-validiert", title: "Alpha validiert", status: "validiert" });
const KO_OFFEN = ko({ id: "k-offen", title: "Beta offen", status: "offen" });
const KO_PRUEFUNG = ko({
  id: "k-pruefung",
  title: "Gamma in Prüfung",
  status: "offen",
  assignments: ["u2"],
});
const KOS = [KO_VALIDIERT, KO_OFFEN, KO_PRUEFUNG];

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok(KOS),
    useLibrarySearch: () => ok(KOS),
    useDirectory: () => ok([{ id: "u9", name: "Eva" }]),
    useConflicts: () => ok([]),
    useKo: (id: string) => ok(KOS.find((k) => k.id === id)),
    useAudit: () => ok([]),
    // Die Lesefläche hängt den Bildbeschreiber ein (`ImageDescribeProvider`), der den Modellstand
    // abfragt. Ohne Modell — genau wie im Tor.
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
// Der Import richtet die i18n-Instanz ein — ohne ihn stünde in jedem Knopf der SCHLÜSSEL.
import i18n from "../../apps/web/src/i18n";
import { deriveStatus } from "../../apps/web/src/lib/displayStatus";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Der Suchtext steht in der Adresse — die Fläche liest ihn dort (BibliothekFlaeche.tsx:160). */
const SUCHTEXT = "Spritzzone reinigen";

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
        createElement(
          MemoryRouter,
          { initialEntries: [`/bibliothek?q=${encodeURIComponent(SUCHTEXT)}`] },
          createElement(Library),
        ),
      ),
    );
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

/** Die Zeile mit dieser Kennung anklicken — der echte Weg, einen Eintrag zu wählen. */
function waehle(id: string): void {
  const zeile = container.querySelector(`[data-testid="bib-zeile"][data-bib-id="${id}"]`);
  if (!(zeile instanceof HTMLElement)) {
    throw new Error(`Zeile „${id}" fehlt; vorhanden: ${container.textContent}`);
  }
  act(() => {
    zeile.click();
  });
}

interface Befund {
  text: string;
  pfad: string;
  ko: string | null;
  q: string | null;
}

function fragenKnopf(): Befund {
  const a = container.querySelector('[data-testid="bib-fragen"]');
  if (!(a instanceof HTMLAnchorElement)) {
    throw new Error(`Knopf „Fragen" ist kein Link; DOM: ${container.textContent}`);
  }
  const url = new URL(a.getAttribute("href") ?? "", "http://klarwerk.test");
  return {
    text: (a.textContent ?? "").trim(),
    pfad: url.pathname,
    ko: url.searchParams.get("ko"),
    q: url.searchParams.get("q"),
  };
}

describe("JOB 3063 · H4 · der Fragen-Vertrag gilt für jeden Zustand", () => {
  for (const eintrag of KOS) {
    const zustand = deriveStatus(eintrag);
    it(`„${eintrag.title}" (${zustand}): Knopf „Fragen“ → /fragen?ko=${eintrag.id} mit dem Suchtext`, () => {
      mount();
      waehle(eintrag.id);
      const b = fragenKnopf();
      expect(b.text).toBe("Fragen");
      expect(b.pfad).toBe("/fragen");
      expect(b.ko).toBe(eintrag.id);
      expect(b.q).toBe(SUCHTEXT);
    });
  }

  it("die drei Einträge sind wirklich drei verschiedene Zustände — sonst misst der Fall nichts", () => {
    expect(KOS.map((k) => deriveStatus(k))).toEqual(["validiert", "offen", "pruefung"]);
  });

  it("das geprüfte Wort ist die Beschriftung aus `lib.ask` — DE, EN und NL sind gefüllt", () => {
    expect(String(i18n.getResource("de", "translation", "lib.ask"))).toBe("Fragen");
    for (const sprache of ["de", "en", "nl"]) {
      expect(String(i18n.getResource(sprache, "translation", "lib.ask")).length).toBeGreaterThan(0);
    }
  });

  it("ohne Suchtext bleibt der Titel des gewählten Eintrags die Vorbelegung — kein toter Knopf", () => {
    mount();
    waehle(KO_OFFEN.id);
    const feld = container.querySelector('[data-testid="bib-suche"]');
    if (!(feld instanceof HTMLInputElement)) {
      throw new Error("Suchfeld fehlt");
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
      v: string,
    ) => void;
    act(() => {
      setter.call(feld, "");
      feld.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const b = fragenKnopf();
    expect(b.ko).toBe(KO_OFFEN.id);
    expect(b.q).toBe(KO_OFFEN.title);
  });
});
