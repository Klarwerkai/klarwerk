// @vitest-environment jsdom
// ================================================================================================
// R-0474 · „WENN EINE SUCHE NICHTS FINDET, STEHT DORT EIN HILFREICHER SATZ STATT EINER LEEREN FLÄCHE."
// ================================================================================================
//
// Auftrag aufnahme:20260922:gesamt-erstnutzerfuehrung. Die Bibliothek erfüllt die Zusage seit
// JOB 3063/3788 (eigene Prüfstände, s. README). Gemessen werden hier die zwei Suchen, die bis zu
// diesem Auftrag nur „Kein Treffer." bzw. „Keine Hilfe zu diesem Stichwort gefunden." sagten:
//   N1  Direktzugang „Gehe zu …": der Nulltreffer bietet die Eingabe als Frage an; Klick UND Enter
//       führen nach `/fragen?q=<Eingabe>`.
//   N2  Hilfesuche mit Sitzungsrolle: dasselbe Angebot als Link.
//   N3  Hilfesuche ohne Rollenquelle: kein Weg wird behauptet, nur der Rat „anderes Stichwort".
//   N4  Die neuen Texte stehen in allen drei Sprachen und sind voneinander verschieden.
// Echte Bauteile, echte Übersetzungen; gemockt ist allein die Sitzung (kein Netz).
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../apps/web/src/api/auth")>();
  return {
    ...original,
    authApi: {
      ...original.authApi,
      status: vi.fn(async () => ({ needsSetup: false })),
      me: vi.fn(async () => ({ id: "u-lea", name: "Lea", email: "l@x.de", role: "viewer" })),
    },
  };
});

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { Help } from "../../apps/web/src/pages/Help";
import { CommandPalette } from "../../apps/web/src/shell/CommandPalette";
import {
  type Stand,
  abbauen,
  beruhige,
  montiere,
  paletteOeffnen,
  paletteTippen,
  palettenFlaeche,
} from "../navigationsnamen/vorrichtung";

Element.prototype.scrollIntoView = () => {};

const UNSINN = "zzqx Hydraulikdruck";

/** Zeigt, wo der Router gerade steht — so wird der Weg gemessen, nicht der Link-Text. */
function Ort(): JSX.Element {
  const ort = useLocation();
  return createElement("output", { "data-ort": "" }, `${ort.pathname}${ort.search}`);
}

function ort(stand: Stand): string {
  return stand.container.querySelector("[data-ort]")?.textContent ?? "";
}

let stand: Stand | null = null;

afterEach(async () => {
  if (stand) {
    abbauen(stand);
    stand = null;
  }
  await act(async () => {
    await i18n.changeLanguage("de");
  });
});

async function paletteMitNulltreffer(): Promise<Stand> {
  const s = montiere([
    createElement(CommandPalette, { key: "p" }),
    createElement(Ort, { key: "o" }),
  ]);
  stand = s;
  await beruhige();
  await paletteOeffnen();
  await paletteTippen(s, UNSINN);
  return s;
}

const ZIEL = `/fragen?q=${encodeURIComponent(UNSINN)}`;

describe("R-0474 · N1 — der Direktzugang endet beim Nulltreffer nicht in einer leeren Fläche", () => {
  it("N1a: der Nulltreffer sagt „Kein Treffer.“ UND bietet die Eingabe als Frage an", async () => {
    const s = await paletteMitNulltreffer();
    const leer = palettenFlaeche(s).querySelector('[data-cmd="nulltreffer"]');
    expect(leer, "kein Nulltreffer-Zustand gerendert").not.toBeNull();
    expect(leer?.textContent).toContain(i18n.t("cmd.empty"));
    const knopf = leer?.querySelector('[data-cmd="als-frage"]');
    expect(knopf?.textContent).toBe(i18n.t("erstnutzer.palette.alsFrage", { q: UNSINN }));
    expect(knopf?.textContent).toContain(UNSINN);
  });

  it("N1b: ein Klick auf das Angebot führt mit der Eingabe nach /fragen", async () => {
    const s = await paletteMitNulltreffer();
    const knopf = palettenFlaeche(s).querySelector<HTMLButtonElement>('[data-cmd="als-frage"]');
    await act(async () => {
      knopf?.click();
    });
    await beruhige(5);
    expect(ort(s)).toBe(ZIEL);
  });

  it("N1c: Enter im Feld tut dasselbe — die Tastatur fällt nicht ins Leere", async () => {
    const s = await paletteMitNulltreffer();
    const feld = palettenFlaeche(s).querySelector("input");
    await act(async () => {
      feld?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await beruhige(5);
    expect(ort(s)).toBe(ZIEL);
  });

  it("N1d: Gegenprobe — mit Treffern steht kein Frage-Angebot da, Enter geht zum Ziel", async () => {
    const s = montiere([
      createElement(CommandPalette, { key: "p" }),
      createElement(Ort, { key: "o" }),
    ]);
    stand = s;
    await beruhige();
    await paletteOeffnen();
    await paletteTippen(s, i18n.t("nav.library"));
    expect(palettenFlaeche(s).querySelector('[data-cmd="als-frage"]')).toBeNull();
    const feld = palettenFlaeche(s).querySelector("input");
    await act(async () => {
      feld?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await beruhige(5);
    expect(ort(s)).toBe("/bibliothek");
  });
});

/** Tippt ins Suchfeld der Hilfeseite — über den nativen Setter, sonst sieht React es nicht. */
async function hilfeSuchen(wurzel: HTMLElement, text: string): Promise<void> {
  const feld = wurzel.querySelector<HTMLInputElement>('[data-testid="hilfe-suche"]');
  if (!feld) {
    throw new Error("Die Hilfeseite hat kein Suchfeld.");
  }
  const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("R-0474 · N2/N3 — die Hilfesuche nennt beim Nulltreffer den nächsten Schritt", () => {
  it("N2: mit Sitzungsrolle führt ein Link mit dem Stichwort nach /fragen", async () => {
    const s = montiere(
      [createElement(Help, { key: "h" }), createElement(Ort, { key: "o" })],
      "/hilfe",
    );
    stand = s;
    await beruhige();
    await hilfeSuchen(s.container, UNSINN);
    const karte = s.container.querySelector('[data-testid="hilfe-nulltreffer"]');
    expect(karte?.textContent).toContain(i18n.t("help.noResults"));
    const link = karte?.querySelector<HTMLAnchorElement>('[data-testid="hilfe-als-frage"]');
    expect(link?.textContent).toBe(i18n.t("erstnutzer.hilfe.alsFrage", { q: UNSINN }));
    await act(async () => {
      link?.click();
    });
    await beruhige(5);
    expect(ort(s)).toBe(ZIEL);
  });

  it("N3: ohne Rollenquelle wird kein Weg behauptet — nur der Rat, ein anderes Wort zu versuchen", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(MemoryRouter, { initialEntries: ["/hilfe"] }, createElement(Help)));
    });
    await hilfeSuchen(container, UNSINN);
    const karte = container.querySelector('[data-testid="hilfe-nulltreffer"]');
    expect(karte?.textContent).toContain(i18n.t("help.noResults"));
    expect(karte?.textContent).toContain(i18n.t("erstnutzer.hilfe.anderesWort"));
    expect(karte?.querySelector('[data-testid="hilfe-als-frage"]')).toBeNull();
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

describe("R-0474 · N4 — die neuen Sätze in DE, EN und NL", () => {
  const SCHLUESSEL = [
    "erstnutzer.palette.anderesWort",
    "erstnutzer.palette.alsFrage",
    "erstnutzer.hilfe.anderesWort",
    "erstnutzer.hilfe.alsFrage",
  ] as const;

  it("jeder Schlüssel hat in jeder Sprache einen eigenen, echten Text", () => {
    for (const schluessel of SCHLUESSEL) {
      const werte = (["de", "en", "nl"] as const).map((lng) =>
        i18n.getFixedT(lng)(schluessel, { q: "X" }),
      );
      for (const wert of werte) {
        expect(wert, `${schluessel} fehlt`).not.toBe(schluessel);
        expect(wert.length).toBeGreaterThan(5);
      }
      expect(new Set(werte).size, `${schluessel}: Sprachen nicht übersetzt`).toBe(3);
      if (schluessel.endsWith("alsFrage")) {
        for (const wert of werte) {
          expect(wert).toContain("X");
        }
      }
    }
  });
});
