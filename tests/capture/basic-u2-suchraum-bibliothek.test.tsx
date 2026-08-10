// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-BASIC-u2 — DIE BIBLIOTHEK SAGT AN DER ECHTEN SEITE, WORIN SIE SUCHT.
// ================================================================================================
// DER BEFUND (Erstnutzerlauf): auf /bibliothek steht ein breites Suchfeld ohne jede Angabe, welchen
// Bestand es durchsucht. Wer dort seinen eben gespeicherten Entwurf sucht, findet nichts — und liest
// im Nullzustand „Keine Treffer für …“, also eine Aussage, die wie „im ganzen System gibt es das
// nicht“ klingt. Sie ist falsch: der Entwurf liegt unter „Entwürfe fortsetzen“ auf /erfassen, einer
// ANDEREN Suchwelt.
//
// GEMESSEN WIRD AN DER GEMOUNTETEN SEITE — ein Test, der nur Zeichenketten in i18n.ts nachschlägt,
// bewiese, dass ein Satz existiert, nicht dass ihn jemand sieht. Die Sprach- und Quelltextfragen
// (AK5/AK7) stehen deshalb getrennt in basic-u2-suchraum.test.ts, das Node-rein bleibt.
//
// ZUR DATEIENDUNG: `.tsx`, obwohl kein JSX darin steht. Der Root-Typecheck (tools/build) ist
// Node-rein und schließt genau `tests/**/*.tsx` aus (tsconfig.json); eine gemountete Seite ist in
// einer `.ts`-Datei dieses Ordners nicht typisierbar. Die Datei läuft dafür durch den eigenen
// Typecheck der tsx-Tests (tsconfig.tests-tsx.json), ebenfalls im Gate.
//
// GEGENSTAND SIND NUR DIE ZWEI SUCHFLÄCHEN des Auftrags: die Bibliothekssuche (hier) und die
// Entwurfssuche (basic-u2-suchraum-entwuerfe.test.tsx). Andere Suchflächen der App (Hilfe,
// Kommandopalette, Klara, /mobile, externe Suche) sind ausdrücklich NICHT Gegenstand.
//
// BENANNTE BLINDHEIT: geprüft wird die AUSKUNFT über den Suchraum. Dass die Zugriffsgrenze selbst
// („für dich freigegeben“) wirklich gilt, entscheidet das Backend — hier weder verändert noch
// geprüft.
import { afterEach, describe, expect, it, vi } from "vitest";

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

const KO_A = ko({ id: "a", title: "Alpha Ventil", category: "Anlage 1", tags: ["ventil"] });
const KO_B = ko({ id: "b", title: "Beta Pumpe", category: "Anlage 2", tags: ["pumpe"] });
const KOS = [KO_A, KO_B];

// Der Server-Suchpfad wird über einen Schalter leer gestellt — so entsteht der ECHTE Nullzustand der
// Seite (QueryState-Leerfall), ohne die Suchlogik anzufassen.
const lage = vi.hoisted(() => ({ trefferlos: false }));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok(KOS),
    useLibrarySearch: () => ok(lage.trefferlos ? [] : KOS),
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

function mount(entry: string): void {
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

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  lage.trefferlos = false;
});

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function de(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

// Der Gegenweg wird über seinen ZUGÄNGLICHEN NAMEN gesucht, nicht über eine CSS-Klasse — damit
// belegt der Fall zugleich, dass der Weg benannt ist.
function gegenweg(): HTMLAnchorElement | undefined {
  const label = de("lib.scope.toDrafts");
  return [...container.querySelectorAll("a")].find((a) =>
    (a.textContent ?? "").replace(/\s+/g, " ").includes(label),
  ) as HTMLAnchorElement | undefined;
}

describe("BASIC-u2 · AK1 — die Bibliothek benennt sichtbar ihren Suchraum", () => {
  it("die Angabe steht auf der gemounteten Seite", () => {
    mount("/bibliothek");
    expect(text()).toContain(de("lib.scope.note"));
  });

  it("sie steht bei der Suche, nicht irgendwo auf der Seite", () => {
    mount("/bibliothek");
    const feld = container.querySelector("#library-search");
    const notiz = [...container.querySelectorAll("*")].find(
      (el) => (el.textContent ?? "").trim() === de("lib.scope.note"),
    );
    expect(feld, "das Suchfeld der Bibliothek fehlt").toBeTruthy();
    expect(notiz, "die Suchraum-Angabe fehlt").toBeTruthy();
    // Gemeinsamer Vorfahr in geringer Höhe: die Angabe gehört zur Suchfläche, nicht zur Seite.
    let hoehe = 0;
    let el: Element | null = notiz ?? null;
    while (el && !el.contains(feld as Node)) {
      el = el.parentElement;
      hoehe += 1;
    }
    expect(el, "Suchfeld und Angabe stehen in getrennten Bäumen").toBeTruthy();
    expect(hoehe).toBeLessThanOrEqual(4);
  });
});

describe("BASIC-u2 · AK3 — der benannte Weg in die andere Suchwelt", () => {
  it("die Bibliothek bietet einen echten Link auf die eigenen Entwürfe", () => {
    mount("/bibliothek");
    const a = gegenweg();
    expect(a, "der Weg zu den eigenen Entwürfen fehlt oder trägt keinen Namen").toBeTruthy();
    expect(a?.getAttribute("href")).toBe("/erfassen");
  });

  it("AK6 — er ist mit der Tastatur erreichbar und nimmt den Fokus", () => {
    mount("/bibliothek");
    const a = gegenweg();
    expect(a?.tagName).toBe("A");
    a?.focus();
    expect(document.activeElement).toBe(a);
  });

  it("AK6 — das bestehende Suchfeld bleibt unverändert bedienbar", () => {
    mount("/bibliothek?q=Ventil");
    const feld = container.querySelector("#library-search") as HTMLInputElement | null;
    expect(feld?.tagName).toBe("INPUT");
    expect(feld?.getAttribute("type")).toBe("search");
    // Der Startwert aus der URL steht weiter im Feld, und es nimmt den Fokus.
    expect(feld?.value).toBe("Ventil");
    feld?.focus();
    expect(document.activeElement).toBe(feld);
  });
});

describe("BASIC-u2 · AK4 — der Nulltreffer nennt den Suchraum", () => {
  it("ohne Treffer zur Suchanfrage steht der Suchraum in der Meldung", () => {
    lage.trefferlos = true;
    mount("/bibliothek?q=Ventilwechsel");
    expect(text()).toContain(de("lib.emptyQuery").replace("{{q}}", "Ventilwechsel"));
  });

  it("auch der Leerfall ohne Suchanfrage nennt den Suchraum", () => {
    lage.trefferlos = true;
    mount("/bibliothek");
    expect(text()).toContain(de("lib.empty"));
  });

  it("der Gegenweg steht auch im Nullzustand — die Sackgasse ist geschlossen", () => {
    lage.trefferlos = true;
    mount("/bibliothek?q=Ventilwechsel");
    expect(gegenweg()?.getAttribute("href")).toBe("/erfassen");
  });
});
