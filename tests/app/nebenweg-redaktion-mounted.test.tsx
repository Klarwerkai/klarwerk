// @vitest-environment jsdom
// ================================================================================================
// JOB 1125 · D1 (Mounted) — DAS LEERE FELD MUSS SPRECHEN.
// ================================================================================================
//
// DER GRUND FÜR DIESEN TEST steht in den beiden Seiten selbst: die Belegfelder hängen an
// `e.eigenanteilA ? … : null`, `e.aspects.length > 0 ? … : null` und
// `origin.quoteA && origin.quoteB ? … : null`. Redigiert der Server ein Feld, verschwindet der
// Block STILLSCHWEIGEND. Der Betrachter sieht dann keinen Unterschied zwischen „hier stand nie
// etwas" und „hier wurde etwas zurückgehalten" — und genau diese zwei Zustände auseinanderzuhalten
// ist der Zweck des Markers (Pflicht 2: „UI zeigt neutralen Ersatz").
//
// Ein serverseitiger Test kann das nicht belegen: er sieht `redacted: true` am Draht und ist
// zufrieden. Ob die Oberfläche daraus etwas macht, entscheidet sich erst im Renderer — deshalb
// fährt diese Datei die ECHTEN Seiten (`Duplicates`, `Conflicts`) im jsdom, nicht eine
// nachgebaute Komponente. Muster und Gerüst folgen dem direkten Nachbarn
// tests/conflicts/mega31-risiko-caveat-mounted.test.tsx.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Die beiden Antwortlisten sind der einzige bewegliche Teil — sie tragen den Marker oder nicht.
const daten = vi.hoisted(() => ({
  duplikate: [] as unknown[],
  konflikte: [] as unknown[],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "controller" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: () => T) => vi.fn(async () => v());
  return {
    endpoints: {
      duplicates: {
        list: ok(() => daten.duplikate),
        settings: ok(() => ({ minConfidence: 0.5 })),
      },
      conflicts: { list: ok(() => daten.konflikte) },
      ko: { list: ok(() => KOS) },
      gaps: { list: ok(() => []), summary: ok(() => ({ total: 0, byPriority: {} })) },
      directory: { list: ok(() => []) },
      analytics: { busfactor: ok(() => []), expertise: ok(() => []) },
      aiCheck: {
        coverageSummary: ok(() => ({ total: 2, incomplete: 0, unchecked: 0, noCoverage: 0 })),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Conflicts } from "../../apps/web/src/pages/Conflicts";
import { Duplicates } from "../../apps/web/src/pages/Duplicates";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

// Vollständige Objekte: `KoView` liest `conditions`/`measures`/`sources` ohne Absicherung
// (KoView.tsx:14). Eine verkürzte Attrappe hätte hier keinen Fehler MEINER Arbeit angezeigt,
// sondern nur einen Fehler meiner Attrappe — deshalb die volle Form.
const ko = (id: string, titel: string) => ({
  id,
  title: titel,
  statement: `Aussage ${id}`,
  status: "validiert",
  trust: 80,
  conditions: [],
  measures: [],
  sources: [],
  tags: [],
  createdAt: "2026-08-01T06:00:00.000Z",
  updatedAt: "2026-08-01T06:00:00.000Z",
});

const KOS = [ko("ko-a", "Beitrag A"), ko("ko-b", "Beitrag B")];

// Wie der Server sie nach der Feldredaktion ausliefert: Struktur bleibt, Inhalt geht, Marker sagt es.
const DUPLIKAT_REDIGIERT = {
  id: "d-1",
  koA: "ko-a",
  koB: "ko-b",
  relation: "gleich",
  aspects: [],
  eigenanteilA: "NUR-IN-A-SICHTBAR",
  eigenanteilB: "",
  recommendation: "merge",
  status: "offen",
  origin: "auto",
  detector: { trigger: "background", method: "model", lexicalScore: 0.9, rationale: "" },
  createdAt: "2026-08-01T06:00:00.000Z",
  redacted: true,
};

const DUPLIKAT_VOLL = {
  ...DUPLIKAT_REDIGIERT,
  aspects: [{ beschreibung: "Gemeinsam", zitatA: "ZITAT-A", zitatB: "ZITAT-B" }],
  eigenanteilB: "NUR-IN-B-SICHTBAR",
  detector: { ...DUPLIKAT_REDIGIERT.detector, rationale: "Begründung" },
  redacted: undefined,
};

// `origin: "auto"` ist tragend, nicht Beiwerk: ohne dieses Feld nimmt `conflictOriginInfo`
// (lib/conflictBoard.ts:27) den MANUELLEN Zweig, und der zeigt gar keine Zitate. Ein erster
// Anlauf ohne das Feld war grün — er hatte den Zweig geprüft, den er nicht prüfen wollte.
const KONFLIKT_REDIGIERT = {
  id: "c-1",
  koA: "ko-a",
  koB: "ko-b",
  description: "",
  status: "offen",
  origin: "auto",
  createdAt: "2026-08-01T06:00:00.000Z",
  detector: {
    trigger: "background",
    method: "model",
    confidence: 0.9,
    rationale: "",
    quotes: { a: "", b: "" },
  },
  redacted: true,
};

const KONFLIKT_VOLL = {
  ...KONFLIKT_REDIGIERT,
  description: "Widerspruch",
  detector: {
    ...KONFLIKT_REDIGIERT.detector,
    rationale: "Begründung",
    quotes: { a: "ZITAT-A", b: "ZITAT-B" },
  },
  redacted: undefined,
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(seite: () => JSX.Element, pfad: string): Promise<void> {
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
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(MemoryRouter, { initialEntries: [pfad] }, createElement(seite)),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
  // Beide Boards führen ihre Belege in einem <details>; ohne Aufklappen ist der Inhalt zwar im
  // DOM, aber die Fälle unten sollen den Zustand prüfen, den der Mensch wirklich sieht.
  for (const d of [...container.querySelectorAll("details")]) {
    (d as HTMLDetailsElement).open = true;
  }
  await act(flush);
}

const text = (): string => container.textContent ?? "";

beforeEach(async () => {
  daten.duplikate = [];
  daten.konflikte = [];
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

// ------------------------------------------------------------------------------------------------

describe("JOB 1125 · U-DUP — die Duplikate-Seite macht aus dem leeren Feld eine Aussage", () => {
  it("U-1: bei `redacted` steht der neutrale Ersatz auf der Seite", async () => {
    daten.duplikate = [DUPLIKAT_REDIGIERT];
    await mount(Duplicates, "/duplikate");
    expect(text()).toContain("Inhalt zurückgehalten");
  });

  it("U-2: ohne Marker steht er NICHT da — kein Dauerrauschen", async () => {
    // Die Kalibrierung. Ohne sie wäre U-1 auch dann grün, wenn der Hinweis immer erschiene — und
    // ein Hinweis, der immer dasteht, sagt nichts mehr.
    daten.duplikate = [DUPLIKAT_VOLL];
    await mount(Duplicates, "/duplikate");
    expect(text()).not.toContain("Inhalt zurückgehalten");
  });

  it("U-3: die freigegebene Seite bleibt sichtbar (Pflicht 3, zweiter Halbsatz)", async () => {
    // Der Hinweis ERSETZT die Felder nicht, er ergänzt sie. Sonst hätte die Redaktion einer Seite
    // die andere mitgenommen — mehr Schutz als beauftragt ist auch ein Fehler.
    daten.duplikate = [DUPLIKAT_REDIGIERT];
    await mount(Duplicates, "/duplikate");
    expect(text()).toContain("NUR-IN-A-SICHTBAR");
    expect(text()).toContain("Inhalt zurückgehalten");
  });

  it("U-4: der Hinweis ist übersetzt, nicht deutsch mit Fallback", async () => {
    // Die Texte liegen (mangels Schreibrecht an `i18n.ts`) lokal in der Seite. Genau deshalb muss
    // dieser Fall existieren: eine lokale Textkarte ist die Bauform, bei der Übersetzungen am
    // leichtesten vergessen werden.
    daten.duplikate = [DUPLIKAT_REDIGIERT];
    await i18n.changeLanguage("en");
    await mount(Duplicates, "/duplikate");
    expect(text()).toContain("Content withheld");
    expect(text()).not.toContain("Inhalt zurückgehalten");
  });
});

describe("JOB 1125 · U-CON — dieselbe Zusage auf der Konfliktseite", () => {
  it("U-5: bei `redacted` steht der neutrale Ersatz an der Stelle der Belege", async () => {
    daten.konflikte = [KONFLIKT_REDIGIERT];
    await mount(Conflicts, "/konflikte");
    expect(text()).toContain("Belege zurückgehalten");
  });

  it("U-6: ohne Marker bleibt die Karte unverändert", async () => {
    daten.konflikte = [KONFLIKT_VOLL];
    await mount(Conflicts, "/konflikte");
    expect(text()).not.toContain("Belege zurückgehalten");
    expect(text()).toContain("ZITAT-A");
  });

  it("U-7: auch auf Niederländisch", async () => {
    daten.konflikte = [KONFLIKT_REDIGIERT];
    await i18n.changeLanguage("nl");
    await mount(Conflicts, "/konflikte");
    expect(text()).toContain("Bewijs achtergehouden");
  });

  it("U-8: auch der MANUELL angelegte Konflikt bekommt den Hinweis", async () => {
    // Zwei Zweige, zwei Fälle: `conflictOriginInfo` verzweigt an `origin === "auto"`, und der
    // manuelle Zweig rendert eine ganz andere Karte. Ein Hinweis nur im Automatikzweig hätte
    // genau die Hälfte der Konflikte ohne Erklärung gelassen — und dieser Test hätte es nicht
    // gemerkt, solange die Fixture zufällig im anderen Zweig lag (siehe Kommentar an
    // KONFLIKT_REDIGIERT).
    daten.konflikte = [{ ...KONFLIKT_REDIGIERT, origin: "manual", detector: undefined }];
    await mount(Conflicts, "/konflikte");
    expect(text()).toContain("Belege zurückgehalten");
  });
});
