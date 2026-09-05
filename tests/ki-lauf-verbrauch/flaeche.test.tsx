// @vitest-environment jsdom
// ================================================================================================
// JOB 3074 · V5 — DER VERBRAUCH STEHT IN DER KI-ÜBERSICHT, UND EIN FEHLEN BLEIBT LEER.
// ================================================================================================
//
// Gefahren wird die ECHTE Kette: `Capital` (die exportierte Seite) → `ReasonerRunsCard` →
// `useModelRuns(50)` → `endpoints.modelRuns.recent` → `api.get("/model-runs")` → `fetch`.
// Die Attrappe sitzt ganz unten am `fetch` und liefert AUSSCHLIESSLICH JSON; sie entscheidet nichts
// über Sichtbarkeit (Lehre JOB 3039 R1, Punkt 3). Ohne diesen Nachweis wäre der Auftrag ein rein
// serverinternes Feld — die dritte Halbheit, gegen die Abschnitt 8.4 des Auftrags steht.
//
// WAS HIER NICHT GEMESSEN WIRD: jsdom rechnet kein Layout. Ob die Angabe im echten Browser lesbar
// PLATZIERT ist, sagt diese Datei nicht — gemessen ist, WAS im Dokument steht und was ausdrücklich
// NICHT darin steht.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }),
}));

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { ModelRunRecord } from "../../apps/web/src/api/types";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { formatiereTokenzahl } from "../../apps/web/src/lib/modelRuns";
import { Capital } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => onlineManager.setOnline(true));

const START = "2026-09-05T10:00:00.000Z";

function lauf(over: Partial<ModelRunRecord> = {}): ModelRunRecord {
  return {
    id: "r1",
    task: "assist",
    provider: "anthropic:claude-sonnet-4-6",
    demo: false,
    fallback: false,
    locale: "de",
    startedAt: START,
    finishedAt: "2026-09-05T10:00:00.100Z",
    status: "success",
    ...over,
  };
}

type Antwort = { laeufe: readonly ModelRunRecord[] } | { fehler: true };

function stelleFetch(antwort: () => Antwort): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const pfad = String(url);
      if (!pfad.includes("/api/model-runs")) {
        return { ok: false, status: 500, statusText: "no", text: async () => "{}" } as Response;
      }
      const a = antwort();
      if ("fehler" in a) {
        return { ok: false, status: 500, statusText: "no", text: async () => "{}" } as Response;
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(a.laeufe),
      } as Response;
    }),
  );
}

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const gemountet: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

afterEach(() => {
  for (const { root, container } of gemountet.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  vi.unstubAllGlobals();
});

async function mounten(): Promise<{ container: HTMLDivElement }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  gemountet.push({ root, container });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(MemoryRouter, { initialEntries: ["/kapital"] }, createElement(Capital)),
        ),
      ),
    );
    await durchlaufen();
  });
  await act(durchlaufen);
  return { container };
}

function zeile(container: HTMLElement, id: string): HTMLElement {
  const treffer = Array.from(
    container.querySelectorAll<HTMLElement>('[data-testid="mrun-row"]'),
  ).find((el) => el.getAttribute("data-run-id") === id);
  expect(treffer, `keine Laufzeile für ${id} gerendert`).toBeTruthy();
  return treffer as HTMLElement;
}

const MIT = lauf({
  id: "mit",
  verbrauch: { eingabeToken: 1234, ausgabeToken: 56, gemeldeteAufrufe: 1 },
});
const OHNE = lauf({ id: "ohne", task: "select", provider: "deterministic", demo: true });

describe("JOB 3074 V5: der Verbrauch steht je Lauf — oder ausdrücklich nichts", () => {
  it("V5a · ein Lauf MIT gemeldetem Verbrauch nennt Eingabe- und Ausgabetoken", async () => {
    stelleFetch(() => ({ laeufe: [MIT] }));
    const { container } = await mounten();
    const text = zeile(container, "mit").querySelector('[data-testid="mrun-token"]')?.textContent;
    expect(text, "die Verbrauchsangabe fehlt in der Zeile").toBeTruthy();
    expect(text).toContain("1234");
    expect(text).toContain("56");
    expect(text).toBe(
      i18n.t("mrun.tokens", {
        ein: formatiereTokenzahl(1234),
        aus: formatiereTokenzahl(56),
      }),
    );
  });

  it("V5b · ein Lauf OHNE Verbrauch trägt KEINEN Platzhalter — keine Null, kein Strich", async () => {
    stelleFetch(() => ({ laeufe: [OHNE] }));
    const { container } = await mounten();
    const z = zeile(container, "ohne");
    expect(z.querySelector('[data-testid="mrun-token"]')).toBeNull();
    expect(z.textContent ?? "", "kein Ersatzwort für den fehlenden Verbrauch").not.toMatch(
      /token/i,
    );
    // Und die Summenzeile entsteht gar nicht erst: es gibt keine Grundmenge, über die zu summieren
    // wäre — „0 von 1" wäre die Null, die dieser Auftrag ausdrücklich verbietet.
    expect(
      container.querySelector('[data-testid="mrun-token-summe"]'),
      "ohne einen einzigen Verbrauch darf keine Summe erscheinen",
    ).toBeNull();
  });

  it("V5c · die Summenzeile nennt Summe UND Grundmenge (aus 2 von 3)", async () => {
    stelleFetch(() => ({
      laeufe: [
        MIT,
        lauf({
          id: "mit2",
          verbrauch: { eingabeToken: 766, ausgabeToken: 44, gemeldeteAufrufe: 3 },
        }),
        OHNE,
      ],
    }));
    const { container } = await mounten();
    const summe = container.querySelector<HTMLElement>('[data-testid="mrun-token-summe"]');
    expect(summe, "die Verbrauchs-Summenzeile fehlt").toBeTruthy();
    const text = summe?.textContent ?? "";
    // 1234+766 = 2000 · 56+44 = 100 · zwei von drei geladenen Läufen tragen einen Verbrauch.
    expect(text).toContain("2000");
    expect(text).toContain("100");
    // Die Grundmenge steht als eigene Aussage da — unabhängig vom Satzbau geprüft, damit ein
    // Weglassen von {{n}}/{{total}} im Übersetzungstext nicht unbemerkt bleibt.
    expect(text, "die Zahl der beitragenden Läufe fehlt").toMatch(/\b2\b/);
    expect(text, "die Grundmenge (Gesamtzahl geladener Läufe) fehlt").toMatch(/\b3\b/);
    expect(text).toBe(
      i18n.t("mrun.tokensTotal", {
        ein: formatiereTokenzahl(2000),
        aus: formatiereTokenzahl(100),
        n: 2,
        total: 3,
      }),
    );
  });

  it("V5d · kein Preis, keine Währung, nirgends auf der Karte", async () => {
    stelleFetch(() => ({ laeufe: [MIT, OHNE] }));
    const { container } = await mounten();
    const karte = container.querySelector<HTMLElement>('[data-testid="mrun-card"]');
    expect(karte?.textContent ?? "").not.toMatch(/€|\$|EUR|USD|Preis|Kosten|price|cost/i);
  });

  it("V5e · in de/en/nl steht ein vollständiger Satz, kein roher Schlüssel", async () => {
    for (const sprache of ["de", "en", "nl"]) {
      await i18n.changeLanguage(sprache);
      stelleFetch(() => ({ laeufe: [MIT] }));
      const { container } = await mounten();
      const zellentext = zeile(container, "mit").querySelector(
        '[data-testid="mrun-token"]',
      )?.textContent;
      const summentext = container.querySelector('[data-testid="mrun-token-summe"]')?.textContent;
      for (const text of [zellentext, summentext]) {
        expect(text, `Sprache ${sprache}: Angabe fehlt`).toBeTruthy();
        expect(
          text ?? "",
          `Sprache ${sprache}: roher i18n-Schlüssel auf dem Bildschirm`,
        ).not.toMatch(/mrun\./);
        expect(text ?? "", `Sprache ${sprache}: leerer Platzhalter`).not.toMatch(/\{\{|\}\}/);
      }
      expect(zellentext).toContain("1234");
      expect(summentext).toContain("1234");
    }
    await i18n.changeLanguage("de");
  });
});
