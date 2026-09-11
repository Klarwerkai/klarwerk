// @vitest-environment jsdom
// ================================================================================================
// JOB 3469 · REVIEW26 (Mounted) — DIE BENENNUNG STEHT IN DER SICHTBAREN KOPFZEILE, NICHT IM „MEHR".
// ================================================================================================
//
// WARUM GEMOUNTET UND NICHT GEGREPPT: Die genaue Benennung gab es schon vorher — sie stand im
// aufklappbaren „Mehr" (`Duplicates.tsx`, `DUPLICATE_BOARD_TEXT.overlap`/`.confidence`). Der
// gemeldete Mensch hat sie nie gesehen, weil er das „Mehr" nicht öffnet. Ein Quellbefund würde
// diesen Auftrag also für erfüllt halten, ohne dass sich etwas geändert hätte. Deshalb fahren die
// zwei Fälle hier die ECHTEN Seiten im jsdom und lesen die Pille bzw. den Satz am ausgegebenen
// Element ab — bei GESCHLOSSENEN Menüs, so wie die Fläche einen Menschen empfängt.
//
// GERÜST UND MUSTER folgen `tests/app/job2241-vergleichslink-sprache-mounted.test.tsx`, der
// dieselbe Seite mountet und bereits im Tor läuft.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const daten = vi.hoisted(() => ({ duplikate: [] as unknown[] }));

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
      conflicts: { list: ok(() => []) },
      validation: { board: ok(() => []), overview: ok(() => []) },
      lifecycle: { pending: ok(() => []) },
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
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { DuplicateCompare } from "../../apps/web/src/pages/DuplicateCompare";
import { Duplicates } from "../../apps/web/src/pages/Duplicates";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const ko = (id: string, titel: string, aussage: string) => ({
  id,
  title: titel,
  statement: aussage,
  bodyHtml: null,
  status: "validiert",
  type: "technik",
  category: "Betrieb",
  trust: 80,
  conditions: [],
  measures: [],
  sources: [],
  attachments: [],
  comments: [],
  tags: [],
  neededValidations: 3,
  createdAt: "2026-09-01T06:00:00.000Z",
  updatedAt: "2026-09-01T06:00:00.000Z",
});

const KOS = [
  ko("ko-a", "Reifenwechsel A", "Reifen bei unter 1,6 mm Profiltiefe tauschen."),
  ko("ko-b", "Reifenwechsel B", "Abgefahrene Pneus sind vor der Fahrt zu ersetzen."),
];

// Der gemeldete Fall: Modell-Sicherheit 0,95 auf einer Textdeckung von 0,26.
const REIFEN_PAAR = {
  id: "review26-1",
  koA: "ko-a",
  koB: "ko-b",
  relation: "identisch",
  aspects: [],
  eigenanteilA: "",
  eigenanteilB: "",
  recommendation: "zusammenfuehren_pruefen",
  status: "offen",
  pairKey: "dup|ko-a|ko-b",
  origin: "auto",
  detector: {
    trigger: "validation",
    method: "model",
    lexicalScore: 0.26,
    confidence: 0.95,
    rationale: "Gleiche Reifenaussage, anders formuliert.",
    modelLabel: "anthropic:test",
  },
  createdAt: "2026-09-08T09:00:00.000Z",
};

const VERGLEICHSPFAD = "/duplikate/review26-1/vergleich";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mounte(pfad: string, inhalt: unknown): Promise<void> {
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
              createElement(MemoryRouter, { initialEntries: [pfad] }, inhalt as never),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

const mounteBrett = (): Promise<void> => mounte("/duplikate", createElement(Duplicates) as unknown);

const mounteVergleich = (): Promise<void> =>
  mounte(
    VERGLEICHSPFAD,
    createElement(
      Routes,
      null,
      createElement(Route, {
        path: "/duplikate/:id/vergleich",
        element: createElement(DuplicateCompare, { kind: "duplicate" }),
      }),
    ) as unknown,
  );

/** Der sichtbare Text eines Elements, auf eine Zeile normiert. */
function textVon(selektor: string): string {
  const el = container.querySelector(selektor);
  if (!el) {
    throw new Error(
      `Kein Element für ${selektor}. Vorhandene Kennungen: ${[
        ...container.querySelectorAll("[data-testid]"),
      ]
        .map((x) => x.getAttribute("data-testid"))
        .join(", ")}`,
    );
  }
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

beforeEach(async () => {
  daten.duplikate = [REIFEN_PAAR];
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  await i18n.changeLanguage("de");
});

describe("JOB 3469 · REVIEW26 · D — das Brett nennt seine Metrik in der sichtbaren Kopfzeile", () => {
  it("die Pille trägt die 95 UND den Namen der Metrik", async () => {
    await mounteBrett();
    const pille = textVon('[data-testid="pruefen-pille-gleich"]');
    expect(pille).toContain("95");
    expect(pille).toContain("KI-Sicherheit");
  });

  it("die alte Sammelbeschriftung „gleich“ steht nirgends mehr auf der Fläche", async () => {
    await mounteBrett();
    expect(container.textContent ?? "").not.toContain("% gleich");
  });

  // Lieferung 3: der Einordnungssatz wird ERGÄNZT, nicht ersetzt.
  it("der Vorbehalt „Wahrscheinlichkeit, kein Beweis“ bleibt im „Mehr“ erhalten", async () => {
    await mounteBrett();
    for (const d of [...container.querySelectorAll("details")]) {
      (d as HTMLDetailsElement).open = true;
    }
    await act(flush);
    expect(container.textContent ?? "").toContain("kein bewiesenes Duplikat");
    // Und die Vertiefung im „Mehr" bleibt ebenfalls stehen (beide Zahlen mit eigenem Schlüssel).
    expect(container.textContent ?? "").toContain("26 % Textdeckung");
    expect(container.textContent ?? "").toContain("Sicherheit 95 %");
  });

  it("englisch: dieselbe Zahl, englischer Metrikname, kein deutsches Wort", async () => {
    await i18n.changeLanguage("en");
    await mounteBrett();
    const pille = textVon('[data-testid="pruefen-pille-gleich"]');
    expect(pille).toContain("95");
    expect(pille).toContain("AI confidence");
    expect(pille).not.toContain("Sicherheit");
  });
});

describe("JOB 3469 · REVIEW26 · E — die Vergleichsseite nennt ihre Metrik und erklärt den Sprung", () => {
  it("die Pille trägt die 26 UND den Namen ihrer Metrik", async () => {
    await mounteVergleich();
    const pille = textVon('[data-testid="pruefen-pille-fuehrend"]');
    expect(pille).toContain("26");
    expect(pille).toContain("Textdeckung");
    expect(pille).not.toContain("gleich");
  });

  it("der Brückensatz steht sichtbar und benennt beide Zahlen", async () => {
    await mounteVergleich();
    const satz = textVon('[data-testid="dcmp-metrikbruecke"]');
    expect(satz).toContain("95 % KI-Sicherheit");
    expect(satz).toContain("26 % Textdeckung");
  });

  // Ohne Modell-Sicherheit führen beide Flächen dieselbe Zahl — dann behauptet die Seite auch
  // keinen Sprung (Lieferung 4: der Satz erscheint NUR, wenn beide Werte vorliegen).
  it("ohne Modell-Sicherheit erscheint kein Brückensatz", async () => {
    daten.duplikate = [
      {
        ...REIFEN_PAAR,
        detector: { trigger: "validation", method: "model", lexicalScore: 0.26 },
      },
    ];
    await mounteVergleich();
    expect(container.querySelector('[data-testid="dcmp-metrikbruecke"]')).toBeNull();
    expect(textVon('[data-testid="pruefen-pille-fuehrend"]')).toContain("Textdeckung");
  });

  it("niederländisch: Zahl gleich, Benennung und Brückensatz niederländisch", async () => {
    await i18n.changeLanguage("nl");
    await mounteVergleich();
    expect(textVon('[data-testid="pruefen-pille-fuehrend"]')).toContain("tekstdekking");
    const satz = textVon('[data-testid="dcmp-metrikbruecke"]');
    expect(satz).toContain("AI-zekerheid");
    expect(satz).not.toContain("KI-Sicherheit");
  });
});
