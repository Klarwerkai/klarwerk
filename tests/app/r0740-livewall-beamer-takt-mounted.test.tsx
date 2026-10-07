// @vitest-environment jsdom
// ================================================================================================
// R-0740 / PMO-FEA-0003 — BEAMER-ANSICHT UND LAUFENDE AKTUALISIERUNG.
// ================================================================================================
//
// Bens Befunde (Nacharbeit 2):
//   1. „Die Wand aktualisiert sich bei dauerhaft geöffneter Ansicht nicht laufend. Neue Inhalte und
//      andernorts erklärte Widerrufe erscheinen erst beim nächsten Abruf."
//   3. „Die Beamer-Ansicht ist nicht umgesetzt."
//
// Gemessen am echten Bauteil `LiveWallBeamer` mit der ECHTEN Abfrage (`useLiveWall`) und einer
// simulierten Uhr: OHNE Neuladen, nur durch Ablauf eines Takts, muss die offene Wand
//   · einen neuen Eintrag zeigen,
//   · einen inzwischen widerrufenen Namen und ein widerrufenes Foto NICHT mehr zeigen,
//   · einen Eintrag, dessen Sichtrecht entzogen wurde, nicht mehr zeigen.
// Und: reißt die Verbindung ab, verschwinden Personenangaben nach drei verpassten Takten.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  wand: null as unknown,
  stoerung: false,
  abrufe: 0,
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "viewer" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    livewall: {
      get: vi.fn(async () => {
        server.abrufe += 1;
        if (server.stoerung) {
          throw new Error("Netz weg");
        }
        return structuredClone(server.wand);
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
import i18n from "../../apps/web/src/i18n";
import { LIVEWALL_TAKT_MS } from "../../apps/web/src/lib/livewallTakt";
import { LiveWallBeamer } from "../../apps/web/src/pages/LiveWallBeamer";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FOTO_EVA = "data:image/png;base64,RVZB";
const VORHER: LiveWall = {
  saved: [
    {
      koId: "k-alt",
      title: "Halle 3 Sicherheitsregel",
      at: "2026-07-01T08:00:00.000Z",
      status: "offen",
    },
  ],
  helped: [],
  helpedToday: 2,
  validated: [
    {
      koId: "v1",
      title: "Presse P2 entlüften",
      at: "2026-07-02T08:00:00.000Z",
      name: "Eva Muster",
      foto: FOTO_EVA,
    },
  ],
};
// Nach einem Takt: Eva hat Name und Foto widerrufen, ein neuer Eintrag ist da, und `k-alt` ist für
// diesen Betrachter nicht mehr sichtbar (der Server filtert — hier: er liefert ihn nicht mehr).
const NACHHER: LiveWall = {
  saved: [
    {
      koId: "k-neu",
      title: "Kran K2 Lastprobe",
      at: "2026-07-03T08:00:00.000Z",
      status: "offen",
    },
  ],
  helped: [],
  helpedToday: 2,
  validated: [{ koId: "v1", title: "Presse P2 entlüften", at: "2026-07-02T08:00:00.000Z" }],
};

let wurzel: ReturnType<typeof createRoot> | null = null;
let behaelter: HTMLDivElement | null = null;

const schritt = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

async function montieren(): Promise<HTMLDivElement> {
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
        createElement(MemoryRouter, null, createElement(LiveWallBeamer)),
      ),
    );
  });
  for (let i = 0; i < 5; i++) {
    await schritt(0);
  }
  return behaelter;
}

const alle = (el: HTMLElement, id: string) => [...el.querySelectorAll(`[data-testid="${id}"]`)];

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
  });
  server.wand = structuredClone(VORHER);
  server.stoerung = false;
  server.abrufe = 0;
});

afterEach(() => {
  act(() => wurzel?.unmount());
  behaelter?.remove();
  wurzel = null;
  behaelter = null;
  vi.useRealTimers();
});

describe("R-0740 · Beamer-Ansicht `/livewall`", () => {
  it("zeigt validiert mit Name/Foto, zuletzt erfasst, heute geholfen und Vollbild", async () => {
    const el = await montieren();
    expect(el.querySelector('[data-testid="livewall-beamer"]')).not.toBeNull();
    expect(el.textContent).toContain("Presse P2 entlüften");
    expect(el.textContent).toContain("Halle 3 Sicherheitsregel");
    expect(el.textContent).toContain(i18n.t("start.livewall.helpedToday", { n: 2 }));
    expect(alle(el, "livewall-validiert-name").map((n) => n.textContent)).toEqual(["Eva Muster"]);
    expect(
      (alle(el, "livewall-validiert-foto") as HTMLImageElement[]).map((f) => f.getAttribute("src")),
    ).toEqual([FOTO_EVA]);
    expect(el.querySelector('[data-testid="livewall-beamer-vollbild"]')).not.toBeNull();
  });

  it("ohne Neuladen übernimmt ein Takt neue Inhalte, Sichtrechtsänderung und Widerruf", async () => {
    const el = await montieren();
    const vorher = server.abrufe;
    server.wand = structuredClone(NACHHER);

    await schritt(LIVEWALL_TAKT_MS);
    for (let i = 0; i < 5; i++) {
      await schritt(0);
    }

    expect(server.abrufe).toBeGreaterThan(vorher);
    expect(el.textContent).toContain("Kran K2 Lastprobe");
    expect(el.textContent).not.toContain("Halle 3 Sicherheitsregel");
    expect(alle(el, "livewall-validiert-name")).toHaveLength(0);
    expect(alle(el, "livewall-validiert-foto")).toHaveLength(0);
    expect(el.textContent).not.toContain("Eva Muster");
  });

  it("ohne Verbindung verschwinden Personenangaben nach drei verpassten Takten", async () => {
    const el = await montieren();
    server.stoerung = true;

    await schritt(LIVEWALL_TAKT_MS);
    await schritt(0);
    // Ein verpasster Takt: der Stand ist noch frisch genug.
    expect(alle(el, "livewall-validiert-name")).toHaveLength(1);

    for (let i = 0; i < 3; i++) {
      await schritt(LIVEWALL_TAKT_MS);
      await schritt(0);
    }
    expect(alle(el, "livewall-validiert-name")).toHaveLength(0);
    expect(alle(el, "livewall-validiert-foto")).toHaveLength(0);
    expect(el.querySelector('[data-testid="livewall-beamer-veraltet"]')).not.toBeNull();
    // Die Einträge selbst bleiben stehen — sie sind keine Personenangabe.
    expect(el.textContent).toContain("Presse P2 entlüften");
  });

  it("ohne ersten Stand steht „lädt“ bzw. die Störung — nie eine leere Wand", async () => {
    server.stoerung = true;
    const el = await montieren();
    const lage = el.querySelector('[data-testid="livewall-beamer-lage"]');
    expect(lage?.textContent).toBe(i18n.t("start.livewall.beamerError"));
    expect(el.textContent).not.toContain(i18n.t("start.livewall.savedEmpty"));
  });
});
