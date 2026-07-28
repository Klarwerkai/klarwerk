// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega32 BLOCK G — „IN PLANUNG" EINKLAPPEN.
// ================================================================================================
//
// Gezählt vor dem Bau: die System-Galerie zeigt 15 Kacheln — zwei aktive, drei „bald", ZEHN
// geplante. Zwei Drittel der Fläche tun nichts.
//
// Der Block klappt NUR die geplanten ein. Aktiv, „bald" und „nicht konfiguriert" bleiben sichtbar —
// „nicht konfiguriert" ist gebaut und nur ohne hinterlegten Dienst, das ist etwas anderes als
// geplant. Aufgeklappt verhalten sich die Kacheln GENAU wie heute: kein Import, nur der Hinweis.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ImportSourceGallery } from "../../apps/web/src/components/ImportSourceGallery";
import i18n from "../../apps/web/src/i18n";
import { FILE_SOURCES, SYSTEM_SOURCES } from "../../apps/web/src/lib/importSourceGallery";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const activated: string[] = [];

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(ImportSourceGallery, {
        onActivate: (id: string) => {
          activated.push(id);
        },
      }),
    );
  });
}

const tiles = (): HTMLElement[] => Array.from(container.querySelectorAll("button[data-id]"));
const tileIds = (): string[] => tiles().map((el) => el.getAttribute("data-id") ?? "");
const disclosures = (): HTMLElement[] =>
  Array.from(container.querySelectorAll('[data-testid="planned-disclosure"]'));

beforeEach(async () => {
  activated.length = 0;
  globalThis.localStorage?.clear();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("mega32 G · die geplanten Kacheln liegen hinter EINER Zeile", () => {
  it("Standard zugeklappt: keine geplante Kachel ist gerendert", async () => {
    await mount();
    const geplant = [...SYSTEM_SOURCES, ...FILE_SOURCES].filter((s) => s.state === "planned");
    // Es gibt wirklich welche — sonst prüfte der Test an der Fläche vorbei.
    expect(geplant.length).toBeGreaterThan(0);
    for (const s of geplant) {
      expect(tileIds(), `geplante Kachel ${s.id} steht sichtbar`).not.toContain(s.id);
    }
    // Und keine sichtbare Kachel trägt den Zustand „geplant".
    expect(tiles().map((el) => el.getAttribute("data-state"))).not.toContain("planned");
  });

  it("aktiv, „bald“ und „nicht konfiguriert“ bleiben sichtbar", async () => {
    await mount();
    const sichtbar = [...SYSTEM_SOURCES, ...FILE_SOURCES].filter((s) => s.state !== "planned");
    for (const s of sichtbar) {
      expect(tileIds(), `${s.state}-Kachel ${s.id} fehlt`).toContain(s.id);
    }
    // Der ausdrücklich erkämpfte Unterschied: „nicht konfiguriert" ist NICHT eingeklappt.
    const unconfigured = [...SYSTEM_SOURCES, ...FILE_SOURCES].filter(
      (s) => s.state === "unconfigured",
    );
    expect(unconfigured.length).toBeGreaterThan(0);
    for (const s of unconfigured) {
      expect(tileIds()).toContain(s.id);
    }
  });

  it("die Zeile nennt die ANZAHL — je Gruppe eine eigene", async () => {
    await mount();
    const rows = disclosures();
    // Zwei Gruppen, zwei Zeilen (Systeme und Dateien sind getrennt).
    expect(rows).toHaveLength(2);
    const systemGeplant = SYSTEM_SOURCES.filter((s) => s.state === "planned").length;
    const dateiGeplant = FILE_SOURCES.filter((s) => s.state === "planned").length;
    expect(rows[0]?.textContent).toContain(String(systemGeplant));
    expect(rows[1]?.textContent).toContain(String(dateiGeplant));
    expect(rows[0]?.getAttribute("aria-expanded")).toBe("false");
  });

  it("aufgeklappt sind sie alle da — und verhalten sich GENAU wie heute", async () => {
    await mount();
    const row = disclosures()[0];
    await act(async () => {
      row?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(row?.getAttribute("aria-expanded")).toBe("true");

    const systemGeplant = SYSTEM_SOURCES.filter((s) => s.state === "planned");
    for (const s of systemGeplant) {
      expect(tileIds(), `${s.id} fehlt nach dem Aufklappen`).toContain(s.id);
    }

    // Ein Klick auf eine geplante Kachel löst KEINEN Fluss aus — nur den ehrlichen Hinweis.
    const kachel = tiles().find((el) => el.getAttribute("data-id") === systemGeplant[0]?.id);
    await act(async () => {
      kachel?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(activated).toEqual([]);
    expect(container.querySelector("output")).not.toBeNull();
  });

  it("die aktive Kachel löst weiterhin den echten Fluss aus (kein Kollateralschaden)", async () => {
    await mount();
    const aktiv = SYSTEM_SOURCES.find((s) => s.state === "active");
    const kachel = tiles().find((el) => el.getAttribute("data-id") === aktiv?.id);
    await act(async () => {
      kachel?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(activated).toEqual([aktiv?.id]);
  });

  it("die Wahl überlebt einen Neuaufbau der Seite (je Browser gemerkt)", async () => {
    await mount();
    await act(async () => {
      disclosures()[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      root.unmount();
    });
    container.remove();

    await mount();
    expect(disclosures()[0]?.getAttribute("aria-expanded")).toBe("true");
    // Die ANDERE Gruppe hat davon nichts mitbekommen — zwei Schlüssel, zwei Zustände.
    expect(disclosures()[1]?.getAttribute("aria-expanded")).toBe("false");
  });
});
