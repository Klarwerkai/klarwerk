// @vitest-environment jsdom
// ================================================================================================
// PMO-FEA-0003 — DIE OBERFLÄCHE DER FREIWILLIGEN WAND (Blatt „Was gerade passiert").
// ================================================================================================
//
// Gemessen am gerenderten DOM des echten Bauteils `LiveWallValidiert`:
//   · Name und Foto erscheinen nur, wenn der Server sie liefert (also nur mit Zustimmung);
//   · aus einem VERALTETEN Stand erscheinen keine Personenangaben (ein Widerruf darf nicht stehen
//     bleiben, nur weil der nächste Abruf scheitert);
//   · der Schalter zeigt die EIGENE Erklärung und erscheint erst mit gelesenem Stand;
//   · Umschalten schickt genau den neuen Wert — Widerruf ist derselbe Weg mit `false`;
//   · ein gewähltes Foto wird hochgeladen, „Foto entfernen" widerruft es.
import { afterEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  nameConsent: false,
  gesetzt: [] as boolean[],
  foto: undefined as string | undefined,
  fotoAufrufe: [] as string[],
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/lib/livewallFoto", () => ({
  FOTO_TYPEN: ["image/png", "image/jpeg", "image/webp"],
  // jsdom hat keine Leinwand — die Verkleinerung selbst ist hier nicht Gegenstand.
  fotoVorbereiten: vi.fn(async () => "data:image/jpeg;base64,VORBEREITET"),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    livewall: {
      get: vi.fn(async () => ({ saved: [], helped: [], helpedToday: 0, validated: [] })),
      consent: vi.fn(async () => ({
        nameConsent: server.nameConsent,
        photoConsent: server.foto !== undefined,
        ...(server.foto ? { photo: server.foto } : {}),
      })),
      setConsent: vi.fn(async (wert: boolean) => {
        server.gesetzt.push(wert);
        server.nameConsent = wert;
        return { nameConsent: wert };
      }),
      setPhoto: vi.fn(async (foto: string) => {
        server.fotoAufrufe.push(`setzen:${foto}`);
        server.foto = foto;
        return { photoConsent: true };
      }),
      deletePhoto: vi.fn(async () => {
        server.fotoAufrufe.push("loeschen");
        server.foto = undefined;
        return { photoConsent: false };
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
import { formatKoTimestamp } from "../../apps/web/src/lib/koDates";
import { LIVEWALL_TAKT_MS, personenAktuell } from "../../apps/web/src/lib/livewallTakt";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const FOTO_EVA = "data:image/png;base64,RVZB";
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
      foto: FOTO_EVA,
    },
    { koId: "v2", title: "Ventil V4 prüfen", at: "2026-07-01T08:00:00.000Z" },
  ],
};

let wurzel: ReturnType<typeof createRoot> | null = null;
let behaelter: HTMLDivElement | null = null;

async function montieren(daten: LiveWall, aktualisiertAm = Date.now()): Promise<HTMLDivElement> {
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
        createElement(
          MemoryRouter,
          null,
          createElement(LiveWallValidiert, { daten, aktualisiertAm }),
        ),
      ),
    );
  });
  await act(flush);
  return behaelter;
}

const alle = (el: HTMLElement, id: string) => [...el.querySelectorAll(`[data-testid="${id}"]`)];

afterEach(() => {
  act(() => wurzel?.unmount());
  behaelter?.remove();
  wurzel = null;
  behaelter = null;
  server.nameConsent = false;
  server.gesetzt = [];
  server.foto = undefined;
  server.fotoAufrufe = [];
});

describe("PMO-FEA-0003 · Blatt „Was gerade passiert“", () => {
  it("zeigt Name und Foto nur dort, wo der Server sie liefert", async () => {
    const el = await montieren(WAND);
    const liste = el.querySelector('[data-testid="livewall-validiert"]');
    expect(liste?.textContent).toContain("Presse P2 entlüften");
    expect(liste?.textContent).toContain("Ventil V4 prüfen");
    expect(alle(el, "livewall-validiert-name").map((n) => n.textContent)).toEqual(["Eva Muster"]);
    const fotos = alle(el, "livewall-validiert-foto") as HTMLImageElement[];
    expect(fotos.map((f) => f.getAttribute("src"))).toEqual([FOTO_EVA]);
    expect(fotos[0]?.getAttribute("alt")).toBe("Eva Muster");
  });

  it("aus einem veralteten Stand keine Personenangaben — die Einträge bleiben", async () => {
    const el = await montieren(WAND, Date.now() - 4 * LIVEWALL_TAKT_MS);
    expect(el.textContent).toContain("Presse P2 entlüften");
    expect(alle(el, "livewall-validiert-name")).toHaveLength(0);
    expect(alle(el, "livewall-validiert-foto")).toHaveLength(0);
  });

  it("personenAktuell: frisch bis drei Takte, danach nicht; ohne Abruf nie", () => {
    const jetzt = 1_000_000_000;
    expect(personenAktuell(jetzt - 3 * LIVEWALL_TAKT_MS, jetzt)).toBe(true);
    expect(personenAktuell(jetzt - 3 * LIVEWALL_TAKT_MS - 1, jetzt)).toBe(false);
    expect(personenAktuell(0, jetzt)).toBe(false);
  });

  it("R-1010 · die Zeitangabe folgt der gemeinsamen Zeitregel — in jeder Oberflächensprache", async () => {
    // Vorher: eigenes Format ohne Jahr, und jede nichtenglische Sprache bekam fest „de-DE".
    const el = await montieren(WAND);
    const liste = () => el.querySelector('[data-testid="livewall-validiert"]')?.textContent ?? "";
    const iso = "2026-07-02T08:00:00.000Z";
    expect(liste()).toContain(String(formatKoTimestamp(iso, "de")));

    await act(async () => {
      await i18n.changeLanguage("nl");
      await flush();
    });
    const nl = formatKoTimestamp(iso, "nl");
    expect(nl, "Kalibrierung: NL ≠ DE").not.toBe(formatKoTimestamp(iso, "de"));
    expect(liste()).toContain(String(nl));
    expect(liste()).not.toContain(String(formatKoTimestamp(iso, "de")));
    await act(async () => {
      await i18n.changeLanguage("de");
    });
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

  it("Foto wählen lädt das vorbereitete Bild hoch; „Foto entfernen“ widerruft es", async () => {
    const el = await montieren(WAND);
    expect(alle(el, "livewall-foto-widerruf")).toHaveLength(0);
    expect(alle(el, "livewall-eigenes-foto")).toHaveLength(0);

    const wahl = el.querySelector<HTMLInputElement>('[data-testid="livewall-foto-wahl"]');
    const datei = new File(["x"], "ich.png", { type: "image/png" });
    await act(async () => {
      if (wahl) {
        Object.defineProperty(wahl, "files", { value: [datei], configurable: true });
        wahl.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await act(flush);
    expect(server.fotoAufrufe).toEqual(["setzen:data:image/jpeg;base64,VORBEREITET"]);
    const eigenes = alle(el, "livewall-eigenes-foto") as HTMLImageElement[];
    expect(eigenes[0]?.getAttribute("src")).toBe("data:image/jpeg;base64,VORBEREITET");

    await act(async () => {
      el.querySelector<HTMLButtonElement>('[data-testid="livewall-foto-widerruf"]')?.click();
    });
    await act(flush);
    expect(server.fotoAufrufe).toEqual(["setzen:data:image/jpeg;base64,VORBEREITET", "loeschen"]);
    expect(alle(el, "livewall-eigenes-foto")).toHaveLength(0);
    expect(alle(el, "livewall-foto-widerruf")).toHaveLength(0);
  });
});
