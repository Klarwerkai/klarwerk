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
// Gemessen am echten Bauteil `LiveWallBeamer` mit der ECHTEN Abfrage (`useLiveWall`): OHNE
// Neuladen, nur durch Ablauf eines Takts, muss die offene Wand
//   · einen neuen Eintrag zeigen,
//   · einen inzwischen widerrufenen Namen und ein widerrufenes Foto NICHT mehr zeigen,
//   · einen Eintrag, dessen Sichtrecht entzogen wurde, nicht mehr zeigen.
// Und: reißt die Verbindung ab, verschwinden Personenangaben nach drei verpassten Takten.
//
// ECHTE ZEIT, VERKÜRZTER TAKT (Nacharbeit 5). Die erste Fassung lief unter einer simulierten Uhr:
// der Takt löste den Abruf aus (`abrufe` stieg), die Antwort kam aber nie im DOM an — die
// Uhrsimulation griff nicht in jede Zustellungsstufe von Abfrage und React. Jetzt läuft die echte
// Uhr; ersetzt ist allein die TAKTLÄNGE (`LIVEWALL_TAKT_MS` → `TEST_TAKT`). Die Regel
// „drei verpasste Takte" bleibt die des Produkts: `personenAktuell` ist die echte Funktion, nur mit
// der Testtaktlänge aufgerufen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  wand: null as unknown,
  stoerung: false,
  abrufe: 0,
  TEST_TAKT: 100,
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "viewer" }),
}));
vi.mock("../../apps/web/src/lib/livewallTakt", async (importOriginal) => {
  const echt = await importOriginal<typeof import("../../apps/web/src/lib/livewallTakt")>();
  return {
    ...echt,
    LIVEWALL_TAKT_MS: server.TEST_TAKT,
    personenAktuell: (stand: number, jetzt: number) =>
      echt.personenAktuell(stand, jetzt, server.TEST_TAKT),
  };
});
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

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wartet in echter Zeit, bis die Bedingung gilt — höchstens `grenze` ms, dann rot. */
async function bis(bedingung: () => boolean, beschreibung: string, grenze = 3000): Promise<void> {
  const ende = Date.now() + grenze;
  while (Date.now() < ende) {
    let erfuellt = false;
    await act(async () => {
      await pause(10);
      erfuellt = bedingung();
    });
    if (erfuellt) {
      return;
    }
  }
  throw new Error(`nicht eingetreten binnen ${grenze} ms: ${beschreibung}`);
}

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
  const el = behaelter;
  const laedt = i18n.t("start.livewall.beamerLoading");
  await bis(
    () => server.abrufe > 0 && el.textContent?.includes(laedt) === false,
    "erster Abruf zugestellt",
  );
  return el;
}

const alle = (el: HTMLElement, id: string) => [...el.querySelectorAll(`[data-testid="${id}"]`)];

beforeEach(() => {
  server.wand = structuredClone(VORHER);
  server.stoerung = false;
  server.abrufe = 0;
});

afterEach(() => {
  act(() => wurzel?.unmount());
  behaelter?.remove();
  wurzel = null;
  behaelter = null;
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

    // Kein Neuladen, kein Fokuswechsel, keine Bedienung — nur der Takt.
    await bis(() => el.textContent?.includes("Kran K2 Lastprobe") === true, "neuer Eintrag");

    expect(server.abrufe).toBeGreaterThan(vorher);
    expect(el.textContent).not.toContain("Halle 3 Sicherheitsregel");
    expect(alle(el, "livewall-validiert-name")).toHaveLength(0);
    expect(alle(el, "livewall-validiert-foto")).toHaveLength(0);
    expect(el.textContent).not.toContain("Eva Muster");
  });

  it("ohne Verbindung verschwinden Personenangaben nach drei verpassten Takten", async () => {
    const el = await montieren();
    const vorher = server.abrufe;
    server.stoerung = true;

    // Ein verpasster Takt: der Stand ist noch frisch genug, Name und Foto bleiben.
    await bis(() => server.abrufe > vorher, "erster gescheiterter Abruf");
    expect(alle(el, "livewall-validiert-name")).toHaveLength(1);

    // Mehr als drei Takte ohne frischen Stand: Personenangaben verschwinden, der Hinweis erscheint.
    await bis(
      () => el.querySelector('[data-testid="livewall-beamer-veraltet"]') !== null,
      "Hinweis 'keine frische Verbindung'",
    );
    expect(server.abrufe - vorher).toBeGreaterThanOrEqual(3);
    expect(alle(el, "livewall-validiert-name")).toHaveLength(0);
    expect(alle(el, "livewall-validiert-foto")).toHaveLength(0);
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
