// @vitest-environment jsdom
// Montiertes Produktbauteil + echte PP-02/03/07-Routen, ausschließlich fiktive Speicherbestände.
// fetch ist nur der Draht zu Fastify.inject. Kein Browser-/Office-/Screenreader-Nachweis.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { FolienDatenLage } from "../../apps/web/src/api/praesentationDaten";
import { FolienAenderungen } from "../../apps/web/src/components/bibliothek/FolienAenderungen";
import i18n from "../../apps/web/src/i18n";
import { type Bestand, type Welt, baueWelt, bestandAnlegen, rufe } from "./pp02-hostwelt";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let w: Welt;
let b: Bestand;
let host: HTMLDivElement;
let root: Root;
let originalFetch: typeof fetch;
const anfragen: string[] = [];
let wartend: Promise<void> | undefined;

beforeEach(async () => {
  w = await baueWelt();
  b = await bestandAnlegen(w);
  anfragen.length = 0;
  wartend = undefined;
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    anfragen.push(`${init?.method ?? "GET"} ${String(url)}`);
    if (wartend) {
      await wartend;
    }
    const r = await w.app.inject({
      method: "POST",
      url: String(url),
      headers: { "x-test-nutzer": "anna", "content-type": "application/json" },
      payload: String(init?.body),
    });
    return {
      status: r.statusCode,
      statusText: String(r.statusCode),
      ok: r.statusCode < 400,
      text: async () => r.body,
    };
  }) as typeof fetch;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await i18n.changeLanguage("de");
  const lage = (
    await rufe(w, "anna", "GET", `/api/kos/${b.koId}/office/${b.anhangId}/folien-daten`)
  ).body as FolienDatenLage;
  await act(async () => root.render(createElement(FolienAenderungen, { lage })));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  globalThis.fetch = originalFetch;
  await w.app.close();
});

function knopf(text: string): HTMLButtonElement {
  const k = [...host.querySelectorAll("button")].find((e) => e.textContent === text);
  if (!k) {
    throw new Error(`Knopf fehlt: ${text}`);
  }
  return k;
}
async function klick(text: string) {
  await act(async () => knopf(text).click());
}
async function eingabe(el: HTMLInputElement, wert: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, wert);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function vorbereiten() {
  await klick("Änderungen vorschauen");
  const wahl = host.querySelector("select") as HTMLSelectElement;
  await act(async () => {
    wahl.value = b.ids.kosten;
    wahl.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const felder = [...host.querySelectorAll<HTMLInputElement>("input:not([type='checkbox'])")];
  await eingabe(felder[0] as HTMLInputElement, "1.300 T€");
  await eingabe(felder[1] as HTMLInputElement, "Neue Zahl ausdrücklich prüfen (fiktiv).");
  await act(async () => (host.querySelector("input[type=checkbox]") as HTMLInputElement).click());
}
async function absenden() {
  await act(async () => {
    host
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
async function erwarteText(text: string) {
  for (let i = 0; i < 50 && !host.textContent?.includes(text); i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  expect(host.textContent).toContain(text);
}

describe("PP-07 · Vorschau in der bestehenden Anhangfläche", () => {
  it("echte Wirkung mit neuer Datenfassung, Prüfdetails und unverändertem Speicher", async () => {
    await vorbereiten();
    await absenden();
    await erwarteText("Vorschau: 2 Datenfassungen betroffen. Nichts gespeichert.");
    expect(host.textContent).toContain("300 T€ → 200 T€");
    expect(host.textContent).toContain("Frühere Freigaben gelten dafür nicht");
    expect(host.querySelectorAll("[data-datenkontrolle]")).toHaveLength(2);
    expect(host.textContent).toContain("Diese reine Datenvorschau verändert noch keine Datei");
    expect(host.textContent).toContain("Sprechernotizen");
    expect(anfragen).toEqual([`POST /api/kos/${b.koId}/office/${b.anhangId}/aenderungsvorschau`]);
    expect((await rufe(w, "anna", "GET", `/api/datenpunkte/${b.ids.ergebnis}`)).body).toMatchObject(
      { wert: "300 T€", fassung: 1 },
    );
  });

  it("Escape verwirft und gibt den Fokus zurück; späte Antworten erscheinen nicht erneut", async () => {
    await vorbereiten();
    let freigeben = () => {};
    wartend = new Promise<void>((resolve) => {
      freigeben = resolve;
    });
    await absenden();
    const feld = host.querySelector("input") as HTMLInputElement;
    await act(async () => {
      feld.focus();
      feld.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.activeElement).toBe(knopf("Änderungen vorschauen"));
    expect(host.querySelector("form")).toBeNull();
    await act(async () => {
      freigeben();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    await klick("Änderungen vorschauen");
    expect(host.querySelector("output")?.textContent).toBe("");
    expect(host.querySelectorAll("[data-datenkontrolle]")).toHaveLength(0);
  });

  it("nachträglich geänderter Artikel liefert eine echte 409-Meldung, kein Erfolgszustand", async () => {
    await vorbereiten();
    await w.ko.revise(b.koId, { title: "Neuere Testfassung" }, "anna");
    await absenden();
    await erwarteText("Die Präsentation wurde geändert");
    expect(host.querySelector("[role=alert]")?.textContent).toContain("Bitte neu laden");
    expect(host.querySelector("output")?.textContent).toBe("");
  });

  it("Formularänderung verwirft die alte Vorschau und Englisch hat eigene Bedienungstexte", async () => {
    await vorbereiten();
    await absenden();
    await erwarteText("Vorschau: 2 Datenfassungen betroffen");
    await eingabe(host.querySelector("input") as HTMLInputElement, "1.350 T€");
    expect(host.querySelector("output")?.textContent).toBe("");
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(host.textContent).toContain("Preview changes");
    expect(host.textContent).toContain("Reason for change");
    expect(host.textContent).toContain("Discard preview");
  });
});
