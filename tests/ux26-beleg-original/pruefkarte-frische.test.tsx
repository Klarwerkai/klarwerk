// @vitest-environment jsdom
// ================================================================================================
// UX-26 · „BELEG FEHLT" AUF DER PRÜFKARTE „BELEGAKTUALITÄT" — die echte Seite, DE/EN/NL.
// ================================================================================================
//
// Gefahren wird die ECHTE Kette: `Capital` (die exportierte Seite, `/kapital`) →
// `EvidenceFreshnessCard` → `useKos()`/`useEvidenceIndex(500)` → `fetch`. Die Attrappe sitzt ganz
// unten am `fetch` und liefert AUSSCHLIESSLICH JSON (Bauform `tests/ki-lauf-verbrauch/flaeche.test.tsx`).
//
// WAS DIE PRÜFKARTE ZEIGT (`Stufe2.tsx` ist nicht Teil des Auftrags und bleibt unverändert): sie
// listet die AUFFÄLLIGEN Einträge (veraltet/fehlend) mit ihrem Zustand aus
// `evidenceFreshnessLabelKey`; „kein Beleganlass" erscheint dort nur als Zähler. Seit Runde 2 nennt
// dieser Zähler den Zustand mit demselben Wort (`ux26.ts`, `$t(ko.evFresh.neutral)`) — geprüft
// wird die Bedeutung (`zaehlerVerstoesse`), nicht bloss die Anwesenheit.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }),
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { EvidenceRecord, KnowledgeObject } from "../../apps/web/src/api/types";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { evidenceFreshnessLabelKey } from "../../apps/web/src/lib/evidenceFreshnessView";
import { Capital } from "../../apps/web/src/pages/Stufe2";
import { SCHLUESSEL, SPRACHEN, verstoesse, zaehlerVerstoesse } from "./bedeutung";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const quelle = {
  id: "s-1",
  label: "Werknorm",
  url: null,
  excerpt: null,
  kind: "external" as const,
  peerValidated: false,
  author: "u1",
  at: "2026-09-01T00:00:00.000Z",
};

function ko(id: string, title: string, over: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id,
    title,
    statement: "S",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Produktion",
    tags: [],
    confidence: 50,
    trust: 50,
    status: "validiert",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    history: [],
    sources: [],
    attachments: [],
    ...over,
  } as KnowledgeObject;
}

const FEHLT = "Dichtung Presse 4 — Quelle ohne Beleg";
const OHNE = "Pausenregel Halle 2 — ohne Quelle";
const AKTUELL = "Reinigung Linie 3 — belegt";

const KOS: KnowledgeObject[] = [
  ko("ko-fehlt", FEHLT, { sources: [quelle] }),
  ko("ko-ohne", OHNE),
  ko("ko-aktuell", AKTUELL, { sources: [quelle] }),
];
const BELEGE: EvidenceRecord[] = [
  {
    id: "ev-1",
    koId: "ko-aktuell",
    koVersion: 1,
    kind: "source",
    label: "Werknorm",
    createdBy: "u1",
    createdAt: "2026-09-01T00:00:00.000Z",
  },
];

function stelleFetch(): void {
  const json = (daten: unknown): Response =>
    ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify(daten),
    }) as Response;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const pfad = new URL(String(url), "http://x").pathname;
      if (pfad === "/api/kos") {
        return json(KOS);
      }
      if (pfad === "/api/evidence") {
        return json(BELEGE);
      }
      return { ok: false, status: 500, statusText: "no", text: async () => "{}" } as Response;
    }),
  );
}

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const gemountet: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

afterEach(async () => {
  for (const { root, container } of gemountet.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  vi.unstubAllGlobals();
  await i18n.changeLanguage("de");
});

async function mounten(): Promise<HTMLDivElement> {
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
  return container;
}

/**
 * Die Prüfkarte selbst — über ihre sichtbare Überschrift, nicht über ein eigens gesetztes Attribut.
 * Dieselbe Seite führt weitere Karten mit Verweisen auf `/wissen/:id` (Hinweise, Herkunftsindex);
 * gemessen wird nur, was IN dieser Karte steht.
 */
function pruefkarte(container: HTMLElement, titel: string): HTMLElement {
  const kopf = Array.from(container.querySelectorAll<HTMLElement>("*")).find(
    (e) => e.children.length === 0 && (e.textContent ?? "").trim() === titel,
  );
  expect(kopf, `die Prüfkarte „${titel}“ fehlt`).toBeTruthy();
  return (kopf as HTMLElement).parentElement as HTMLElement;
}

/** Die Zeile eines Eintrags in der Prüfkarte — über ihren Verweis auf `/wissen/:id`. */
function zeile(karte: HTMLElement, koId: string): HTMLElement | null {
  const link = karte.querySelector<HTMLAnchorElement>(`li a[href="/wissen/${koId}"]`);
  return (link?.closest("li") as HTMLElement | null) ?? null;
}

for (const sprache of SPRACHEN) {
  describe(`UX-26 · Prüfkarte Belegaktualität — ${sprache.toUpperCase()}`, () => {
    it(`K3 · ${sprache}: der Eintrag ohne Belegzeile trägt „Beleg fehlt“ in der Sprache der Fläche`, async () => {
      await i18n.changeLanguage(sprache);
      const t = i18n.getFixedT(sprache);
      stelleFetch();
      const container = await mounten();
      const karte = pruefkarte(container, t("evFresh.title"));

      const fehlt = zeile(karte, "ko-fehlt");
      expect(fehlt, "der Eintrag ohne Beleg fehlt in der Prüfkarte").not.toBeNull();
      const marken = Array.from((fehlt as HTMLElement).querySelectorAll("span")).map((s) =>
        (s.textContent ?? "").trim(),
      );
      const label = t(SCHLUESSEL.belegFehlt);
      expect(marken, "der Zustand steht nicht an der Zeile").toContain(label);
      expect(verstoesse(sprache, "belegFehlt", label)).toEqual([]);

      // Dieselbe Berechnung wie vorher: „kein Beleganlass" und „aktuell" stehen nicht als Zeile da,
      // sondern nur in den Zählern.
      expect(zeile(karte, "ko-ohne")).toBeNull();
      expect(zeile(karte, "ko-aktuell")).toBeNull();
      const zaehler = Array.from(karte.querySelectorAll("span")).map((s) =>
        (s.textContent ?? "").trim(),
      );
      expect(zaehler).toContain(t("evFresh.summary.missing", { n: 1 }));
      expect(zaehler).toContain(t("evFresh.summary.current", { n: 1 }));

      // RUNDE 2 (Ben, K3): der Neutral-Zähler spricht den ZUSTAND aus — mit genau dem Wort, das
      // `evidenceFreshnessLabelKey("neutral")` liefert, und nicht mehr „neutral"/„neutraal".
      const neutral = zaehler.find((z) =>
        z.startsWith(`${t(evidenceFreshnessLabelKey("neutral"))}:`),
      );
      expect(neutral, `der Neutral-Zähler nennt „${t(SCHLUESSEL.keinAnlass)}“ nicht`).toBe(
        `${t(evidenceFreshnessLabelKey("neutral"))}: 1`,
      );
      expect(zaehlerVerstoesse(sprache, neutral as string)).toEqual([]);
      expect(zaehler, "der alte Zähler steht noch da").not.toContain(
        sprache === "nl" ? "neutraal: 1" : "neutral: 1",
      );
    });
  });
}
