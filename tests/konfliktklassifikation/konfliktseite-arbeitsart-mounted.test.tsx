// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · GESAMT-KONFLIKTKLASSIFIKATION · R-0252 — AN DER ECHTEN KONFLIKTSEITE.
// ================================================================================================
//
// „Das System sagt vorab, welche Art von Arbeit vor einem liegt … Die angebotenen Knöpfe
// unterscheiden sich je Typ." Gemessen wird beides an der gemounteten Seite `Conflicts`:
//   · der Satz `konflikt-arbeitsart` steht VOR dem Kartenpaar und sagt, ob gewählt oder abgeleitet,
//   · das Aktionsband trägt je Arbeitsart genau die zugesagten Knöpfe — in der gezeichneten Folge.
//
// Gerüst und Mock-Bauform wörtlich wie `tests/conflict-description/beschreibung-sichtbar.test.tsx`
// (dieselbe echte Seite, kein Playwright-Import — sonst zöge die Datei in die Browsergruppe).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const daten = vi.hoisted(() => ({ konflikte: [] as unknown[] }));

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
      conflicts: { list: ok(() => daten.konflikte) },
      duplicates: { list: ok(() => []), settings: ok(() => ({ minConfidence: 0.5 })) },
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
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Conflicts } from "../../apps/web/src/pages/Conflicts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const ko = (id: string, titel: string) => ({
  id,
  title: titel,
  statement: `Aussage ${id}`,
  status: "validiert",
  category: "Technik",
  trust: 80,
  conditions: [],
  measures: [],
  sources: [],
  tags: [],
  createdAt: "2026-08-01T06:00:00.000Z",
  updatedAt: "2026-08-01T06:00:00.000Z",
});

const KOS = [ko("ko-a", "Beitrag A"), ko("ko-b", "Beitrag B")];

/** Von Hand angelegt: kein `origin` — also auch kein „Kein Widerspruch" (`canDismiss`). */
const manuell = (type: string, extra: Record<string, unknown> = {}) => ({
  id: `c-${type}`,
  koA: "ko-a",
  koB: "ko-b",
  type,
  description: "Von Hand erfasst.",
  status: "offen",
  secondOpinion: null,
  decidedBy: null,
  decision: null,
  createdAt: "2026-08-01T06:00:00.000Z",
  ...extra,
});

/** Automatisch erkannt — dann gehört „Kein Widerspruch" ins Band. */
const automatisch = (type: string) =>
  manuell(type, {
    origin: "auto",
    detector: { trigger: "background", method: "model", confidence: 0.9, rationale: "Grund." },
  });

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
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
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                MemoryRouter,
                { initialEntries: ["/konflikte"] },
                createElement(Conflicts),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

const t = (key: string, vars?: Record<string, unknown>): string =>
  vars ? String(i18n.t(key, vars)) : String(i18n.t(key));

const marke = (kennung: string): HTMLElement | null =>
  container.querySelector<HTMLElement>(`[data-testid="${kennung}"]`);

/** Die Beschriftungen des Aktionsbands in der gezeichneten Folge (wie KF1b im Nachbartest). */
const band = (): string[] =>
  [...(marke("pruefen-aktionsband")?.querySelectorAll("button") ?? [])].map((b) =>
    (b.textContent ?? "").trim(),
  );

const satz = (): string => (marke("konflikt-arbeitsart")?.textContent ?? "").trim();

beforeEach(async () => {
  daten.konflikte = [];
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("R-0252 · die Konfliktseite sagt vorab, welche Arbeit vorliegt", () => {
  it("der Satz steht VOR dem Kartenpaar", async () => {
    daten.konflikte = [automatisch("truth")];
    await mount();
    const p = marke("konflikt-arbeitsart");
    const paar = marke("pruefen-paar");
    expect(p).not.toBeNull();
    expect(paar).not.toBeNull();
    // DOCUMENT_POSITION_FOLLOWING: das Paar folgt dem Satz.
    expect((p as Node).compareDocumentPosition(paar as Node) & 4).toBe(4);
  });

  it("Sachkonflikt (Wahrheit, abgeleitet): Satz und das bisherige Band, unverändert", async () => {
    daten.konflikte = [automatisch("truth")];
    await mount();
    expect(satz()).toBe(
      `${t("konfliktarbeit.satz.sache")} ${t("konfliktarbeit.abgeleitet", { art: t("con.type.truth") })}`,
    );
    expect(band()).toEqual([
      t("con.side.left"),
      t("con.side.right"),
      t("con.side.both"),
      t("con.side.none"),
      t("con.secondOpinionAdd"),
    ]);
  });

  it("Regelkonflikt (Kontext, abgeleitet): keine Zweitmeinung im Band", async () => {
    daten.konflikte = [automatisch("context")];
    await mount();
    expect(satz()).toBe(
      `${t("konfliktarbeit.satz.regel")} ${t("konfliktarbeit.abgeleitet", { art: t("con.type.context") })}`,
    );
    expect(band()).toEqual([
      t("con.side.left"),
      t("con.side.right"),
      t("con.side.both"),
      t("con.side.none"),
    ]);
  });

  it("Versionskonflikt (Zeit, abgeleitet): welcher Stand gilt — ohne „beide gelten“ und Zweitmeinung", async () => {
    daten.konflikte = [automatisch("temporal")];
    await mount();
    expect(satz()).toBe(
      `${t("konfliktarbeit.satz.version")} ${t("konfliktarbeit.abgeleitet", { art: t("con.type.temporal") })}`,
    );
    expect(band()).toEqual([
      t("konfliktarbeit.knopf.standLinks"),
      t("konfliktarbeit.knopf.standRechts"),
      t("con.side.none"),
    ]);
    expect(marke("pruefen-knopf-beide-gelten")).toBeNull();
    expect(marke("pruefen-knopf-zweitmeinung")).toBeNull();
  });

  it("bei der Anlage gewählt: die Wahl gilt und der Satz sagt „gewählt“ statt „abgeleitet“", async () => {
    daten.konflikte = [manuell("truth", { arbeitsart: "regel" })];
    await mount();
    expect(satz()).toBe(`${t("konfliktarbeit.satz.regel")} ${t("konfliktarbeit.gewaehlt")}`);
    // Manuell → kein „Kein Widerspruch"; Regel → keine Zweitmeinung.
    expect(band()).toEqual([t("con.side.left"), t("con.side.right"), t("con.side.both")]);
    // Die Art bleibt sichtbar „Wahrheit" — die Arbeitsart ersetzt die Konfliktart nicht.
    expect(marke("pruefen-pille-art")?.textContent).toBe(t("con.type.truth"));
  });

  it("EN: derselbe Satz in der Oberflächensprache", async () => {
    daten.konflikte = [automatisch("temporal")];
    await i18n.changeLanguage("en");
    await mount();
    expect(satz()).toBe(
      "Version conflict: the same thing in two states — the question is which state applies. Classified from the type “Time”.",
    );
  });
});
