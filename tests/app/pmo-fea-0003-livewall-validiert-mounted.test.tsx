// @vitest-environment jsdom
// ================================================================================================
// PMO-FEA-0003 — DIE OBERFLÄCHE DER FREIWILLIGEN WAND (Blatt „Was gerade passiert").
// ================================================================================================
//
// Gemessen am gerenderten DOM des echten Bauteils `LiveWallValidiert`:
//   · ein Name erscheint nur, wenn der Server ihn liefert (also nur mit Zustimmung);
//   · der Schalter zeigt die EIGENE Erklärung und erscheint erst mit gelesenem Stand;
//   · Umschalten schickt genau den neuen Wert — Widerruf ist derselbe Weg mit `false`.
import { afterEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({ nameConsent: false, gesetzt: [] as boolean[] }));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    livewall: {
      get: vi.fn(async () => ({ saved: [], helped: [], helpedToday: 0, validated: [] })),
      consent: vi.fn(async () => ({ nameConsent: server.nameConsent })),
      setConsent: vi.fn(async (wert: boolean) => {
        server.gesetzt.push(wert);
        server.nameConsent = wert;
        return { nameConsent: wert };
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
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { LiveWall } from "../../apps/web/src/api/types";
import { LiveWallValidiert } from "../../apps/web/src/components/start/LiveWallValidiert";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const WAND: LiveWall = {
  saved: [],
  helped: [],
  helpedToday: 0,
  validated: [
    {
      koId: "v1",
      title: "Presse P2 entlüften",
      at: "2026-07-02T08:00:00.000Z",
      name: "Eva Muster",
    },
    { koId: "v2", title: "Ventil V4 prüfen", at: "2026-07-01T08:00:00.000Z" },
  ],
};

let wurzel: ReturnType<typeof createRoot> | null = null;
let behaelter: HTMLDivElement | null = null;

async function montieren(daten: LiveWall): Promise<HTMLDivElement> {
  await i18n.changeLanguage("de");
  behaelter = document.createElement("div");
  document.body.appendChild(behaelter);
  wurzel = createRoot(behaelter);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    wurzel?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, null, createElement(LiveWallValidiert, { daten })),
      ),
    );
  });
  await act(flush);
  return behaelter;
}

afterEach(() => {
  act(() => wurzel?.unmount());
  behaelter?.remove();
  wurzel = null;
  behaelter = null;
  server.nameConsent = false;
  server.gesetzt = [];
});

describe("PMO-FEA-0003 · Blatt „Was gerade passiert“", () => {
  it("zeigt validiertes Wissen und einen Namen nur dort, wo der Server ihn liefert", async () => {
    const el = await montieren(WAND);
    const liste = el.querySelector('[data-testid="livewall-validiert"]');
    expect(liste?.textContent).toContain("Presse P2 entlüften");
    expect(liste?.textContent).toContain("Ventil V4 prüfen");
    const namen = [...el.querySelectorAll('[data-testid="livewall-validiert-name"]')].map(
      (n) => n.textContent,
    );
    expect(namen).toEqual(["Eva Muster"]);
  });

  it("leerer Zweig sagt das ehrlich", async () => {
    const el = await montieren({ ...WAND, validated: [] });
    expect(el.textContent).toContain(i18n.t("start.livewall.validatedEmpty"));
  });

  it("Schalter voreingestellt aus; Zustimmen und Widerrufen schicken den neuen Wert", async () => {
    const el = await montieren(WAND);
    const schalter = el.querySelector<HTMLInputElement>(
      '[data-testid="livewall-namenszustimmung"]',
    );
    expect(schalter).not.toBeNull();
    expect(schalter?.checked).toBe(false);

    await act(async () => {
      schalter?.click();
    });
    await act(flush);
    expect(server.gesetzt).toEqual([true]);
    expect(
      el.querySelector<HTMLInputElement>('[data-testid="livewall-namenszustimmung"]')?.checked,
    ).toBe(true);

    await act(async () => {
      el.querySelector<HTMLInputElement>('[data-testid="livewall-namenszustimmung"]')?.click();
    });
    await act(flush);
    expect(server.gesetzt).toEqual([true, false]);
    expect(
      el.querySelector<HTMLInputElement>('[data-testid="livewall-namenszustimmung"]')?.checked,
    ).toBe(false);
  });
});
