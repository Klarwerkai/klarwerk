import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom
// JOB 3179 · UX-24: echte Komponente, echte Provider und Sprachwechsel; nur HTTP ist ersetzt.
// jsdom zeichnet keine Pixel und aktiviert Knöpfe nicht nativ per Taste. Die unten ausdrücklich
// simulierte Browser-Standardaktion prüft den React-Klickweg, keine echte Chromium-Tastatur.
import { act } from "../../apps/web/node_modules/react";
import type { KoAttachment } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import * as bodyFileLink from "../../apps/web/src/lib/bodyFileLink";
import {
  type Prüfstand,
  ankerAnhang,
  knowledgeObject,
  montieren,
} from "../quellen-anker-im-formular/flaeche";

let stand: Prüfstand | undefined;
const name = "Pruefkarte-800x500.png";

// Weiße Prüfkarten mit vier verschiedenfarbigen Randmarken und Mittelmarkierung.
function pruefkarte(breite: number, hoehe: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${breite}" height="${hoehe}"><rect width="100%" height="100%" fill="white"/><path d="M0 0H${breite}" stroke="red" stroke-width="20"/><path d="M0 ${hoehe}H${breite}" stroke="blue" stroke-width="20"/><path d="M0 0V${hoehe}" stroke="green" stroke-width="20"/><path d="M${breite} 0V${hoehe}" stroke="orange" stroke-width="20"/><circle cx="${breite / 2}" cy="${hoehe / 2}" r="20"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function anhang(
  overrides: { [K in keyof KoAttachment]?: KoAttachment[K] | undefined } = {},
): KoAttachment {
  const result = { ...ankerAnhang("att-1", name, "obj-1"), thumbnail: pruefkarte(800, 500) };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) Reflect.deleteProperty(result, key);
    else Reflect.set(result, key, value);
  }
  return result;
}

async function aufbauen(anhaenge: KoAttachment[]): Promise<HTMLElement> {
  stand = await montieren(knowledgeObject(anhaenge), "search_on_click");
  const section = stand.container.querySelector<HTMLDetailsElement>(
    '[data-bib-abschnitt="anhaenge"]',
  );
  if (!section) throw new Error("Anhangabschnitt fehlt");
  await act(async () => {
    section.open = true;
    section.dispatchEvent(new Event("toggle"));
  });
  return section;
}

// Nur echte Textknoten, weder title noch alt; keine Übersetzung im Prüfhelfer nachgebaut.
function getByText(container: Element, text: string): HTMLElement {
  const found = [...container.querySelectorAll<HTMLElement>("*")].find((el) =>
    [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent === text),
  );
  expect(found, `Sichtbarer Text fehlt: ${text}`).toBeDefined();
  return found as HTMLElement;
}

function oeffnen(section: Element): HTMLButtonElement {
  const button = section.querySelector<HTMLButtonElement>(".grid.grid-cols-3 button");
  if (!button) throw new Error("Anhangknopf fehlt");
  return button;
}

async function standardaktion(button: HTMLButtonElement, key: "Enter" | " "): Promise<void> {
  button.focus();
  await act(async () => {
    const down = button.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
    if (key === "Enter" && down) button.click();
    const up = button.dispatchEvent(
      new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }),
    );
    if (key === " " && down && up) button.click();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  vi.spyOn(window, "open").mockReturnValue(null);
});
afterEach(() => {
  stand?.abbauen();
  stand = undefined;
  vi.restoreAllMocks();
});

describe("UX-24 · Anhangkachel", () => {
  it("F1 · 800×500 und 500×800: vollständiger proportionaler Inhalt im begrenzten Rahmen", async () => {
    const section = await aufbauen([
      anhang(),
      anhang({ id: "att-2", name: "Pruefkarte-500x800.png", thumbnail: pruefkarte(500, 800) }),
    ]);
    const bilder = [...section.querySelectorAll("img")];
    expect(bilder).toHaveLength(2);
    for (const bild of bilder) {
      expect(bild.classList.contains("object-cover"), "F1: Vorschau darf nicht beschneiden").toBe(
        false,
      );
      expect(bild.classList.contains("object-contain")).toBe(true);
      expect(bild.classList.contains("h-auto"), "Höhe folgt dem Bildverhältnis").toBe(true);
      expect(bild.classList.contains("w-full")).toBe(true);
      const rahmen = bild.parentElement as HTMLElement;
      expect(rahmen.classList.contains("border")).toBe(true);
      expect(rahmen.classList.contains("bg-page")).toBe(true);
      expect(rahmen.classList.contains("p-2")).toBe(true);
    }
  });

  it("F2 · drei Kacheln: Dateinamen dauerhaft als Text, lange Namen kürzbar mit vollständigem title", async () => {
    const namen = [
      name,
      "Sehr-langer-Dateiname-mit-vielen-Einzelheiten-zur-Pruefung-500x800.png",
      "Dritte.png",
    ];
    const section = await aufbauen(namen.map((n, i) => anhang({ id: `att-${i}`, name: n })));
    for (const n of namen) {
      const label = getByText(section, n);
      expect(label.getAttribute("title")).toBe(n);
      expect(label.classList.contains("truncate")).toBe(true);
      expect(label.closest("[hidden], [aria-hidden=true]")).toBeNull();
      expect(label.closest("button")?.querySelector("img")?.alt).toBe("");
    }
    expect(section.querySelector(".grid-cols-3")?.children).toHaveLength(3);
  });

  it.each([
    ["de", "Original in neuem Tab öffnen"],
    ["en", "Open original in new tab"],
    ["nl", "Origineel openen in nieuw tabblad"],
  ])(
    "F3 · %s: neuer Tab sichtbar und genau einmal im zugänglichen Namen",
    async (sprache, hinweis) => {
      const section = await aufbauen([anhang()]);
      await act(async () => {
        await i18n.changeLanguage(sprache);
      });
      const button = oeffnen(section);
      expect(button.getAttribute("aria-label"), "F3: Tab muss vor Auslösung angekündigt sein").toBe(
        `${name} — ${hinweis}`,
      );
      expect(getByText(button, hinweis).closest("[hidden], [aria-hidden=true]")).toBeNull();
      expect(button.getAttribute("aria-labelledby")).toBeNull();
    },
  );

  it("F4 · ohne Vorschaudaten: benannter Platzhalter statt leerem img-src", async () => {
    const section = await aufbauen([anhang({ thumbnail: undefined, dataUrl: undefined })]);
    expect(section.querySelector('img[src=""]'), "F4: kein kaputtes Leerbild").toBeNull();
    expect(section.querySelector("img")).toBeNull();
    for (const [sprache, hinweis] of [
      ["de", "Keine Vorschau verfügbar"],
      ["en", "No preview available"],
      ["nl", "Geen voorbeeld beschikbaar"],
    ] as const) {
      await act(async () => {
        await i18n.changeLanguage(sprache);
      });
      getByText(section, hinweis);
    }
    expect(oeffnen(section).getAttribute("aria-disabled")).not.toBe("true");
  });

  it("F5 · ohne gültige Originalreferenz: fokussierbar gesperrt, Klick/Enter/Space wirkungslos", async () => {
    for (const objectId of [undefined, "", "../fremd", "https://fremd", " "]) {
      const section = await aufbauen([anhang({ objectId })]);
      const button = oeffnen(section);
      const raw = vi.spyOn(bodyFileLink, "objectRawHref");
      raw.mockClear();
      await act(async () => {
        button.click();
      });
      await standardaktion(button, "Enter");
      await standardaktion(button, " ");
      expect(window.open).toHaveBeenCalledTimes(0);
      expect(raw, "Der gesperrte Klick erreicht openAttachment gar nicht").not.toHaveBeenCalled();
      raw.mockRestore();
      expect(
        button.getAttribute("aria-disabled"),
        "F5: fehlendes Original muss als gesperrt erkennbar sein",
      ).toBe("true");
      expect(button.disabled).toBe(false);
      expect(document.activeElement).toBe(button);
      getByText(section, "Original nicht verfügbar");
      expect(button.getAttribute("aria-label")).toBe(`${name} — Original nicht verfügbar`);
      stand?.abbauen();
      stand = undefined;
    }
  });

  it("F6 · gültige objectId: Enter-Standardaktion öffnet genau einmal den sicheren Rohpfad", async () => {
    const section = await aufbauen([
      anhang({ objectId: " obj-1 ", dataUrl: pruefkarte(800, 500) }),
    ]);
    const button = oeffnen(section);
    await standardaktion(button, "Enter");
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith("/api/objects/obj-1/raw", "_blank", "noopener");
    expect(document.activeElement).toBe(button);
  });

  it("F7 · Bildladefehler: Platzhalter und Name bleiben, eine neue Vorschau darf wieder laden", async () => {
    const section = await aufbauen([anhang()]);
    const bild = section.querySelector("img") as HTMLImageElement;
    await act(async () => {
      bild.dispatchEvent(new Event("error"));
    });
    expect(section.querySelector("img")).toBeNull();
    getByText(section, "Keine Vorschau verfügbar");
    getByText(section, name);
    await stand?.mitObjekt(knowledgeObject([anhang({ thumbnail: pruefkarte(500, 800) })]));
    expect(section.querySelector("img")?.src).toBe(pruefkarte(500, 800));
    await standardaktion(oeffnen(section), " ");
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith("/api/objects/obj-1/raw", "_blank", "noopener");
  });

  it("F8 · Inline-Original bleibt bei ungültiger objectId nutzbar und unverändert nach Neumontage", async () => {
    const original = pruefkarte(500, 800);
    const daten = anhang({ objectId: "../ungueltig", thumbnail: undefined, dataUrl: original });
    const vorher = JSON.stringify(daten);
    for (let i = 0; i < 2; i++) {
      const section = await aufbauen([daten]);
      expect(section.querySelector("img")?.src).toBe(original);
      await standardaktion(oeffnen(section), " ");
      expect(window.open).toHaveBeenLastCalledWith(original, "_blank", "noopener");
      expect(JSON.stringify(daten)).toBe(vorher);
      stand?.abbauen();
      stand = undefined;
    }
    expect(window.open).toHaveBeenCalledTimes(2);
  });

  it("F9 · DOM-Fokusfolge: Kachel → Entfernen → nächste Kachel; Entfernen bleibt wirksam", async () => {
    const section = await aufbauen([anhang(), anhang({ id: "att-2", name: "Zweite.png" })]);
    const grid = section.querySelector(".grid-cols-3") as HTMLElement;
    const buttons = [...grid.querySelectorAll<HTMLButtonElement>("button")];
    expect(buttons).toHaveLength(4);
    expect([...grid.querySelectorAll<HTMLElement>("button, a[href], input, [tabindex]")]).toEqual(
      buttons,
    );
    for (const button of buttons) {
      expect(button.tabIndex).toBe(0);
      expect(button.disabled).toBe(false);
      button.focus();
      expect(document.activeElement).toBe(button);
    }
    const entfernen = buttons[1];
    const zweitesEntfernen = buttons[3];
    if (!entfernen || !zweitesEntfernen) throw new Error("Entfernen-Knöpfe fehlen");
    expect(entfernen.getAttribute("aria-label")).toBe("Anhang entfernen");
    expect(zweitesEntfernen.getAttribute("aria-label")).toBe("Anhang entfernen");
    expect(entfernen.classList.contains("absolute"), "Entfernen verdeckt keine Bildränder").toBe(
      false,
    );
    expect(
      entfernen.classList.contains("opacity-0"),
      "Entfernen bleibt auch ohne Maus sichtbar",
    ).toBe(false);
    await standardaktion(entfernen, "Enter");
    expect(stand?.anfragen.filter((r) => r.method === "PUT").map((r) => r.rumpf)).toEqual([
      { action: "detach", attachmentId: "att-1" },
    ]);
  });
});
