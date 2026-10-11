// @vitest-environment jsdom
// RECHERCHE:pmo-fea-0004 — DER BEDIENWEG DES WISSENSUPDATES, gemountet.
//
// Gemessen wird der Baustein `WochenupdateTeamgespraech` mit attrappiertem Endpunkt: vor dem Klick
// steht kein Dokument da und nichts wurde abgerufen; die Fläche sagt, was aufgenommen wird und dass
// nichts verschickt wird; der Klick ruft genau einmal ab (mit gewähltem Enddatum), danach stehen
// Zusammenfassung, Markdown und Kopieren/Download da. Ein leerer Zeitraum sagt das. Was der Server
// aufnimmt, messen wochenupdate.test.ts und wochenupdate-route.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  aufrufe: [] as (string | undefined)[],
  leer: false,
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    output: {
      wochenupdate: vi.fn(async (bis?: string) => {
        box.aufrufe.push(bis);
        const eintraege = box.leer
          ? []
          : [
              {
                koId: "K1",
                title: "Ventil schließen",
                art: "neu",
                am: "2026-10-07",
                version: 1,
                uncertain: false,
              },
              {
                koId: "K2",
                title: "Schmierplan",
                art: "ueberarbeitet",
                am: "2026-10-08",
                version: 3,
                uncertain: false,
              },
            ];
        return {
          title: "Wissensupdate für das Teamgespräch",
          von: "2026-10-03",
          bis: bis ?? "2026-10-09",
          generatedAt: "2026-10-09T15:30:00.000Z",
          eintraege,
          markdown: box.leer
            ? "# Wissensupdate für das Teamgespräch\n\nIn diesem Zeitraum ist nichts hinzugekommen."
            : "# Wissensupdate für das Teamgespräch\n\n## Neu validiert\n\n### 1. Ventil schließen",
          provenance: [],
        };
      }),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { WochenupdateTeamgespraech } from "../../apps/web/src/components/WochenupdateTeamgespraech";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<HTMLDivElement> {
  const c = document.createElement("div");
  document.body.appendChild(c);
  container = c;
  const r = createRoot(c);
  root = r;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    r.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ToastProvider, null, createElement(WochenupdateTeamgespraech)),
      ),
    );
    await flush();
  });
  return c;
}

function knopf(c: HTMLElement, schluessel: string): HTMLButtonElement {
  const b = [...c.querySelectorAll("button")].find((x) =>
    (x.textContent ?? "").includes(i18n.t(schluessel)),
  );
  if (!b) {
    throw new Error(`Knopf ${schluessel} fehlt`);
  }
  return b;
}

async function klick(b: HTMLElement): Promise<void> {
  await act(async () => {
    b.click();
    await flush();
  });
}

async function datum(c: HTMLElement, wert: string): Promise<void> {
  const feld = c.querySelector('input[type="date"]') as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.aufrufe = [];
  box.leer = false;
});

afterEach(() => {
  if (root && container) {
    const r = root;
    act(() => r.unmount());
    container.remove();
  }
  root = null;
  container = null;
  vi.clearAllMocks();
});

describe("Bedienweg „Wissensupdate fürs Teamgespräch“", () => {
  it("erklärt Aufnahme und Kein-Versand und ruft vor dem Klick nichts ab", async () => {
    const c = await mount();
    expect(c.textContent).toContain(i18n.t("wochenupdate.titel"));
    expect(c.textContent).toContain(i18n.t("wochenupdate.aufnahme"));
    expect(c.textContent).toContain(i18n.t("wochenupdate.keinVersand"));
    expect(box.aufrufe).toEqual([]);
    expect(c.querySelector("pre")).toBeNull();
  });

  it("ein Klick erzeugt das Update für das gewählte Enddatum und zeigt es zum Teilen an", async () => {
    const c = await mount();
    await datum(c, "2026-10-09");
    await klick(knopf(c, "wochenupdate.erzeugen"));
    expect(box.aufrufe).toEqual(["2026-10-09"]);
    expect(c.textContent).toContain(
      i18n.t("wochenupdate.zusammenfassung", {
        von: "2026-10-03",
        bis: "2026-10-09",
        neu: 1,
        ueberarbeitet: 1,
      }),
    );
    expect(c.querySelector("pre")?.textContent).toContain("## Neu validiert");
    expect(knopf(c, "out.copy")).toBeTruthy();
    expect(knopf(c, "out.download")).toBeTruthy();
  });

  it("ohne Datum entscheidet der Server (heute); ein leerer Zeitraum sagt das", async () => {
    box.leer = true;
    const c = await mount();
    await klick(knopf(c, "wochenupdate.erzeugen"));
    expect(box.aufrufe).toEqual([undefined]);
    expect(c.textContent).toContain(i18n.t("wochenupdate.leer"));
  });

  it("die Texte stehen in allen drei Sprachen — kein stiller Rückfall auf Deutsch", () => {
    const de = i18n.getFixedT("de");
    for (const schluessel of [
      "wochenupdate.titel",
      "wochenupdate.aufnahme",
      "wochenupdate.keinVersand",
      "wochenupdate.erzeugen",
    ]) {
      expect(de(schluessel), `de: ${schluessel}`).not.toBe(schluessel);
      for (const sprache of ["en", "nl"] as const) {
        const t = i18n.getFixedT(sprache);
        expect(t(schluessel), `${sprache}: ${schluessel}`).not.toBe(schluessel);
        expect(t(schluessel), `${sprache}: ${schluessel}`).not.toBe(de(schluessel));
      }
    }
  });
});
