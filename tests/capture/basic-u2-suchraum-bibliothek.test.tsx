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
//
// ==================================================================================================
// JOB 3063 (H4) — WAS HIER ABGELÖST IST UND WAS BLEIBT.
// ==================================================================================================
//
// Der Eigentümer hat am 04.09.2026 entschieden: die Bibliothek wird Liste plus Lesefläche nach dem
// Maßstab von Apple Pages, Erklärtext verschwindet aus dem Sichtfeld (AUFTRAG 3063 §5, §8.5 —
// „Codex prüft gegen DIESE Vorgabe, nicht gegen alte Pins"). Die DAUERZEILE unter dem Suchfeld
// (`lib.scope.note`) und der Dauer-Gegenweg (`lib.scope.toDrafts`) sind damit entfallen; die
// zugehörige Sprachprüfung ist in `basic-u2-suchraum.test.ts` als Ablösungsfall festgehalten.
//
// WAS DIESER TEST WEITER MISST — und was die Substanz des Befundes war:
//   · AK6: das Suchfeld ist da, ist ein echtes Suchfeld, nimmt den Startwert aus der Adresse (`?q=`)
//     und den Fokus. Neue Marke: `#bib-suche` (`components/bibliothek/BibliothekListe.tsx:122`).
//   · AK4: der Nulltreffer ist KEINE Sackgasse — er sagt in EINEM Satz, was los ist, unterscheidet
//     „nichts gefunden" von „noch keine Einträge", und daneben steht der Weg nach `/erfassen`.
//     Das ist der Kern des Erstnutzerbefundes: nicht der Satz, sondern der fehlende Ausgang.
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
    // JOB 3068 (N5): die Lesefläche fragt das eigene Signal jetzt selbst — leer heißt „kein Befund".
    useEigeneBefunde: () => ok([]),
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
  const label = de("lib.liste.erfassen");
  return [...container.querySelectorAll("a")].find(
    (a) => (a.textContent ?? "").replace(/\s+/g, " ").trim() === label,
  ) as HTMLAnchorElement | undefined;
}

describe("BASIC-u2 · AK6 — das Suchfeld der Bibliothek ist da und bedienbar", () => {
  it("es ist ein echtes Suchfeld und trägt einen zugänglichen Namen", () => {
    mount("/bibliothek");
    const feld = container.querySelector("#bib-suche") as HTMLInputElement | null;
    expect(feld, "das Suchfeld der Bibliothek fehlt").toBeTruthy();
    expect(feld?.tagName).toBe("INPUT");
    expect(feld?.getAttribute("type")).toBe("search");
    // Der Name kommt aus dem Beschriftungselement, nicht aus einer erratenen Klasse.
    const label = container.querySelector('label[for="bib-suche"]');
    expect((label?.textContent ?? "").trim()).toBe(de("lib.searchLabel"));
  });

  it("es nimmt den Startwert aus der Adresse und den Fokus", () => {
    mount("/bibliothek?q=Ventil");
    const feld = container.querySelector("#bib-suche") as HTMLInputElement | null;
    expect(feld?.value).toBe("Ventil");
    feld?.focus();
    expect(document.activeElement).toBe(feld);
  });
});

describe("BASIC-u2 · AK4 — der Nulltreffer ist keine Sackgasse", () => {
  it("mit Suchtext steht der Satz „nichts gefunden“ da — nicht „im System gibt es das nicht“", () => {
    lage.trefferlos = true;
    mount("/bibliothek?q=Ventilwechsel");
    expect(text()).toContain(de("lib.liste.leerSuche"));
    expect(text()).not.toContain(de("lib.liste.leer"));
  });

  it("ohne Suchtext steht der ANDERE Satz da — die zwei Lagen bleiben unterschieden", () => {
    lage.trefferlos = true;
    mount("/bibliothek");
    expect(text()).toContain(de("lib.liste.leer"));
    expect(text()).not.toContain(de("lib.liste.leerSuche"));
  });

  it("der Gegenweg steht im Nullzustand — mit Namen, echtem Ziel und Tastaturfokus", () => {
    lage.trefferlos = true;
    mount("/bibliothek?q=Ventilwechsel");
    const a = gegenweg();
    expect(a, "der Weg aus dem Nullzustand fehlt oder trägt keinen Namen").toBeTruthy();
    expect(a?.getAttribute("href")).toBe("/erfassen");
    expect(a?.tagName).toBe("A");
    a?.focus();
    expect(document.activeElement).toBe(a);
  });

  it("KALIBRIERUNG — mit Treffern steht weder ein Leersatz noch der Gegenweg da", () => {
    // Ohne diesen Fall wären die drei Fälle oben auch dann grün, wenn Satz und Knopf IMMER dastünden.
    mount("/bibliothek");
    expect(text()).not.toContain(de("lib.liste.leer"));
    expect(text()).not.toContain(de("lib.liste.leerSuche"));
    expect(gegenweg()).toBeUndefined();
  });
});
