// @vitest-environment jsdom
// SCHEIBE D-019b (Design-Lead, LIEFERUNG-20260813-KATALOGREST Z. 70-76) — SEITE UND ZÄHLER BENUTZEN
// DIESELBEN FILTERREGELN AUS EINER QUELLE.
//
// Gemessener Befund vor dieser Datei: JOB 690 hat die Prädikate benannt in `lib/taskFilters.ts`
// abgelegt (`isUnresolvedConflict`, `isOpenGap`) — und dort ausdrücklich hingeschrieben, dass das
// Zusammenführen der Aufgabenseite eine eigene Scheibe ist. `MyTasks.tsx` trug die beiden Regeln
// deshalb weiter als eigene Inline-Ausdrücke: `c.status !== "geloest"` und `g.status === "offen"`.
// Zwei Kopien derselben Regel sind genau die Bauart, die den 54-gegen-57-Fehler erzeugt hat.
//
// Diese Datei misst BEIDES getrennt:
//   (1) RED-FIRST — die Seite benutzt die Helfer und hält keine zweite Kopie der Regel mehr.
//       Dieser Teil fällt ohne die Änderung.
//   (2) GLEICHWERTIGKEIT — die „Alle"-Zahl bleibt dieselbe. Dieser Teil ist VOR und NACH der
//       Änderung grün; das ist seine Aufgabe. Er ist kein Red-first-Beleg, sondern der Beweis,
//       dass ein reiner Austausch auch wirklich rein war (ABNAHME der Scheibe).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte", stufe2: false, setStufe2: () => {} }),
}));
// `useSession` liegt in AuthContext (nicht in einem eigenen SessionContext) — ohne diesen Mock
// wirft die Fläche „useSession muss innerhalb von <AuthProvider> verwendet werden."
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u-1", name: "Testperson", role: "experte" } }),
}));

// Ein bewusst gemischter Bestand: je ein Fall, der zählt, und einer, der NICHT zählen darf.
// Genau an diesen beiden hängt die Frage, ob beide Regeln gleich ausgelegt werden.
const CONFLICTS = [
  { id: "c-1", description: "Konflikt offen", status: "offen", koA: "k-1", koB: "k-2" },
  { id: "c-2", description: "Konflikt eskaliert", status: "eskaliert", koA: "k-1", koB: "k-3" },
  {
    id: "c-3",
    description: "Konflikt zweitmeinung",
    status: "zweitmeinung",
    koA: "k-2",
    koB: "k-3",
  },
  {
    id: "c-4",
    description: "Konflikt GELÖST — zählt nicht",
    status: "geloest",
    koA: "k-1",
    koB: "k-4",
  },
];
const GAPS = [
  { id: "g-1", question: "Offene Frage A", status: "offen", redacted: false, locale: "de" },
  { id: "g-2", question: "Offene Frage B", status: "offen", redacted: false, locale: "de" },
  {
    id: "g-3",
    question: "GESCHLOSSEN — zählt nicht",
    status: "geschlossen",
    redacted: false,
    locale: "de",
  },
];
const BOARD = [
  { id: "k-1", title: "Zu validieren 1", status: "pruefung", trust: 50, author: "u-2", tags: [] },
  { id: "k-2", title: "Zu validieren 2", status: "pruefung", trust: 50, author: "u-2", tags: [] },
];
const LIFECYCLE = ["k-3"];
// 3 offene Konflikte + 2 offene Lücken + 2 Prüfaufgaben + 1 Revalidierung = 8.
// Die Rückgabe-Aufgaben bleiben leer (kein passender Audit-Eintrag) — bewusst, damit die Zahl
// ausschliesslich an den beiden umgestellten Regeln und den unberührten Listen hängt.
const ERWARTET_ALLE = 8;

vi.mock("../../apps/web/src/api/endpoints", () => {
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    conflicts: { list: vi.fn(async () => CONFLICTS) },
    gaps: { list: vi.fn(async () => GAPS) },
    validation: { board: vi.fn(async () => BOARD) },
    lifecycle: { pending: vi.fn(async () => LIFECYCLE) },
    ko: {
      list: vi.fn(async () => [
        ...BOARD,
        {
          id: "k-3",
          title: "Revalidierung",
          status: "validiert",
          trust: 80,
          author: "u-2",
          tags: [],
        },
      ]),
    },
  };
  const endpoints = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return new Proxy({}, { get: () => arrFn() });
    },
  });
  return { endpoints };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { MyTasks } from "../../apps/web/src/pages/MyTasks";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const QUELLE = readFileSync(resolve(process.cwd(), "apps/web/src/pages/MyTasks.tsx"), "utf8");

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(MemoryRouter, { initialEntries: ["/aufgaben"] }, createElement(MyTasks)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

/** Die Zahl am „Alle"-Chip — gelesen aus dem gerenderten Knopf, nicht aus einer Rechnung im Test. */
function alleZahl(): number {
  const label = i18n.t("task.filter.all");
  const knopf = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").startsWith(label),
  );
  if (!knopf) {
    throw new Error(`„Alle"-Chip nicht gefunden (Beschriftung „${label}")`);
  }
  const treffer = (knopf.textContent ?? "").match(/(\d+)\s*$/);
  if (!treffer?.[1]) {
    throw new Error(`keine Zahl am Chip: ${knopf.textContent}`);
  }
  return Number(treffer[1]);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  // Der quellenbasierte Fall mountet nichts — dann gibt es auch nichts abzuräumen.
  if (root) {
    act(() => root.unmount());
    container.remove();
  }
  root = undefined as unknown as ReturnType<typeof createRoot>;
  vi.clearAllMocks();
});

describe("Scheibe D-019b: eine Quelle für beide Leser", () => {
  it("RED-FIRST: die Seite benutzt die Helfer statt einer zweiten Kopie der Regel", () => {
    // Der Import muss da sein …
    expect(QUELLE).toMatch(/isUnresolvedConflict/);
    expect(QUELLE).toMatch(/isOpenGap/);
    // … und die abgeschriebenen Ausdrücke müssen weg sein. Das ist der eigentliche Punkt der
    // Scheibe: nicht „ein Helfer wird auch benutzt", sondern „die zweite Wahrheit ist fort".
    const kopien = [
      ...QUELLE.matchAll(/\.filter\(\([a-z]\) => [a-z]\.status (?:!==|===) "(?:geloest|offen)"\)/g),
    ].map((m) => m[0]);
    expect(kopien, "inline nachgebaute Filterregeln in MyTasks.tsx").toEqual([]);
  });

  it("GLEICHWERTIG: die „Alle“-Zahl ist dieselbe wie vor dem Austausch", async () => {
    await mount();
    // Kalibrierung: die Fläche ist wirklich gerendert und der Bestand angekommen.
    expect(container.textContent).toContain(i18n.t("task.filter.all"));
    expect(alleZahl()).toBe(ERWARTET_ALLE);
  });

  it("GLEICHWERTIG: der gelöste Konflikt und die geschlossene Lücke bleiben draußen", async () => {
    await mount();
    // Die zwei Fälle, an denen sich eine falsch übersetzte Regel sofort zeigen würde.
    expect(container.textContent).not.toContain("Konflikt GELÖST");
    expect(container.textContent).not.toContain("GESCHLOSSEN");
    // Und die drei Zustände, die Arbeit SIND, stehen wirklich da (eskaliert/zweitmeinung
    // fielen aus einer Positivliste `=== "offen"` still heraus).
    expect(container.textContent).toContain("Konflikt eskaliert");
    expect(container.textContent).toContain("Konflikt zweitmeinung");
  });
});
