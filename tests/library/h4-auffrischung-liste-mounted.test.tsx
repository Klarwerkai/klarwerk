// @vitest-environment jsdom
// ================================================================================================
// JOB 3063 · H4 RUNDE 6 — DIE LISTE SAGT, DASS IHR BESTAND NICHT MEHR FRISCH IST.
// ================================================================================================
//
// DER BEFUND, DER DIESEN FALL ERZWINGT (Tor auf main nach dem Einbau der Runde 5,
// `jobs/3063/runde-5/tor-main.exit` = 1): `BibliothekFlaeche` reichte der Liste einen fertig
// gebauten `hinweis` — und `BibliothekListe` kannte diese Eigenschaft überhaupt nicht. Das war
// zweierlei zugleich: ein Übersetzungsfehler (`TS2322`, der das Tor rot machte) UND eine
// gebrochene Zusage. REGELN §7 und Auftrag §9 verlangen bei gescheiterter Auffrischung genau drei
// Dinge, und keines davon geschah:
//   · die zuletzt erfolgreich geholten Zeilen BLEIBEN stehen,
//   · der Zähler zeigt „–" statt einer Zahl, die Aktualität behaupten würde,
//   · und EIN Satz sagt, woran man ist: „Stand von <Zeit> · Auffrischung fehlgeschlagen".
// Der dritte fehlte auf der Fläche vollständig — er wurde gebaut und weggeworfen.
//
// KALIBRIERUNG IM SELBEN AUFBAU (Fall 4): bei gesunder Abfrage steht der Satz NICHT da und der
// Zähler trägt seine Zahl. Ohne diese Gegenrichtung könnte Fall 1-3 auch von einem Satz erfüllt
// werden, der immer dasteht — und ein Dauerhinweis wäre die nächste Unwahrheit.
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

const KOS = [
  ko({ id: "k-frisch-1", title: "Ventil X bei Überdruck schließen" }),
  ko({ id: "k-frisch-2", title: "Rührwerk Y vor der Reinigung entlüften" }),
];

/** Der Zeitpunkt des zuletzt ERFOLGREICHEN Abrufs — die Zahl im Satz stammt aus ihm. */
const ZULETZT_ERFOLGREICH = Date.parse("2026-09-04T09:30:00.000Z");

const stand = vi.hoisted(() => ({ auffrischungScheitert: false }));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok(KOS),
    // Die EINE Abfrage, die Liste und Zähler speist (BibliothekFlaeche.tsx:256). Im Fehlerfall
    // trägt sie ihren Bestand WEITER (das ist der Cache) und meldet zugleich den gescheiterten
    // Nachschlag — genau die Lage aus REGELN §7.
    useLibrarySearch: () =>
      stand.auffrischungScheitert
        ? {
            data: KOS,
            isLoading: false,
            isError: true,
            isRefetchError: true,
            fetchStatus: "idle",
            dataUpdatedAt: ZULETZT_ERFOLGREICH,
            error: new Error("Netz weg"),
          }
        : { ...ok(KOS), isRefetchError: false, fetchStatus: "idle", dataUpdatedAt: Date.now() },
    useDirectory: () => ok([{ id: "u9", name: "Eva" }]),
    useConflicts: () => ok([]),
    // Auf `/wissen/:id` und bei Vorauswahl scheitert im Netzfall AUCH der Detailabruf. Genau so
    // entsteht die Lage, in der zwei Flächen denselben Satz sagen könnten — Fall 5 misst, dass
    // sie es nicht tun.
    useKo: (id: string) =>
      stand.auffrischungScheitert
        ? {
            data: KOS.find((k) => k.id === id),
            isLoading: false,
            isError: true,
            isRefetchError: true,
            fetchStatus: "idle",
            dataUpdatedAt: ZULETZT_ERFOLGREICH,
            error: new Error("Netz weg"),
          }
        : ok(KOS.find((k) => k.id === id)),
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
import { AUFFRISCHUNG_HINWEIS_MARKE } from "../../apps/web/src/lib/confidentiality";
import { formatKoTimestamp } from "../../apps/web/src/lib/koDates";
import { Library } from "../../apps/web/src/pages/Library";
import { listenZaehler } from "./support/bib-flaeche";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function flaeche(auffrischungScheitert: boolean): void {
  stand.auffrischungScheitert = auffrischungScheitert;
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

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  stand.auffrischungScheitert = false;
});

/** Die Liste links — der Hinweis muss DORT stehen, nicht irgendwo auf der Seite. */
function liste(): HTMLElement {
  const el = container.querySelector('[data-testid="bib-liste"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Liste fehlt; DOM: ${container.textContent}`);
  }
  return el;
}

function hinweisInDerListe(): HTMLElement | null {
  const el = liste().querySelector(`[data-testid="${AUFFRISCHUNG_HINWEIS_MARKE}"]`);
  return el instanceof HTMLElement ? el : null;
}

function zeilen(): number {
  return liste().querySelectorAll('[data-testid="bib-zeile"]').length;
}

describe("JOB 3063 · H4 R6 · gescheiterte Auffrischung an der Liste", () => {
  it("1 · die zuletzt geholten Zeilen bleiben stehen — der Bestand wird nicht geleert", () => {
    flaeche(true);
    expect(zeilen()).toBe(KOS.length);
  });

  it(`2 · der Zähler zeigt „–" statt einer Zahl — ein alter Cache behauptet keine Aktualität`, () => {
    flaeche(true);
    expect(listenZaehler(container)).toBeNull();
  });

  it("3 · EIN Satz sagt den Stand und dass die Auffrischung fehlschlug — mit der echten Zeit", () => {
    flaeche(true);
    const el = hinweisInDerListe();
    expect(el).not.toBeNull();
    const zeit = formatKoTimestamp(new Date(ZULETZT_ERFOLGREICH).toISOString(), "de");
    expect(el?.textContent?.trim()).toBe(i18n.t("state.staleRefetchFailed", { zeit: zeit ?? "—" }));
    // Der Satz meldet sich auch ohne Blickkontakt — er ist eine Lageänderung, kein Schmuck.
    expect(el?.getAttribute("aria-live")).toBe("polite");
  });

  it("5 · EINE Fläche, EIN Satz: obwohl Liste UND Lesefläche veraltet sind, steht er genau einmal", () => {
    flaeche(true);
    // Beide Abfragen sind nachweislich gescheitert (der Mock oben liefert beiden die Fehlerlage) —
    // ohne die Unterdrückung in `BibliothekLesen` stünden hier zwei gleichlautende Sätze.
    expect(
      container.querySelectorAll(`[data-testid="${AUFFRISCHUNG_HINWEIS_MARKE}"]`),
    ).toHaveLength(1);
    // Und der eine steht an der Liste, nicht irgendwo.
    expect(hinweisInDerListe()).not.toBeNull();
    // Die Lesefläche ist wirklich da — sonst wäre die Eins oben trivial.
    expect(container.querySelector('[data-testid="bib-lesen"]')).not.toBeNull();
  });

  it("4 · KALIBRIERUNG: bei gesunder Abfrage steht kein Satz da, und der Zähler trägt seine Zahl", () => {
    flaeche(false);
    expect(hinweisInDerListe()).toBeNull();
    expect(listenZaehler(container)).toBe(KOS.length);
    expect(zeilen()).toBe(KOS.length);
  });
});
