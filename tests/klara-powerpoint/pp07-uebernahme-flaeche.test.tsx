import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @vitest-environment jsdom
// Ganze vorhandene Anhangfläche mit tatsächlichem Produktserver. Fetch ist allein der Transport.
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { FolienDaten } from "../../apps/web/src/components/bibliothek/FolienDaten";
import i18n from "../../apps/web/src/i18n";
import { dateiwelt } from "./pp07-dateiwelt";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let w: Awaited<ReturnType<typeof dateiwelt>>;
let host: HTMLDivElement;
let root: Root;
let qc: QueryClient;
let originalFetch: typeof fetch;
let pause: Promise<void> | undefined;
const anfragen: string[] = [];
const laufendeAntworten = new Set<Promise<unknown>>();
beforeEach(async () => {
  w = await dateiwelt();
  pause = undefined;
  anfragen.length = 0;
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const pfad = String(url);
    anfragen.push(`${init?.method ?? "GET"} ${pfad}`);
    if (pause && pfad.endsWith("/datenaktualisierung/vorschau")) await pause;
    const antwort = w.app
      .inject({
        method: (init?.method ?? "GET") as "GET" | "POST",
        url: pfad,
        headers: { ...w.admin, "content-type": "application/json" },
        ...(init?.body ? { payload: String(init.body) } : {}),
      })
      .then((r) => r);
    laufendeAntworten.add(antwort);
    const r = await antwort.finally(() => laufendeAntworten.delete(antwort));
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
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await i18n.changeLanguage("de");
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          {},
          createElement(FolienDaten, { koId: w.ziel.id, anhangId: w.anhangId }),
        ),
      ),
    ),
  );
  await erwarte(() => !!host.querySelector("[data-folien-liste]"));
});
afterEach(async () => {
  await act(async () => root.unmount());
  qc.clear();
  host.remove();
  globalThis.fetch = originalFetch;
  await w.app.close();
});
function pflicht<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error("Erwartetes Produkttestelement fehlt.");
  return v;
}
async function erwarte(test: () => boolean) {
  for (let i = 0; i < 150 && !test(); i++)
    await act(async () => {
      await Promise.all(laufendeAntworten);
      await new Promise((r) => setTimeout(r, 10));
    });
  expect(test(), host.textContent ?? "").toBe(true);
}
function knopf(text: string) {
  const b = [...host.querySelectorAll("button")].find((b) => b.textContent === text);
  if (!b) throw new Error(`Knopf fehlt: ${text}`);
  return b;
}
async function klick(text: string) {
  await act(async () => knopf(text).click());
}
async function eingabe(e: HTMLInputElement, wert: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(e, wert);
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function aenderungsformular() {
  const oeffner = knopf("Änderungen vorschauen");
  const abschnitt = document.getElementById(pflicht(oeffner.getAttribute("aria-controls")));
  return pflicht(abschnitt?.querySelector("form"));
}
async function datenVorschau() {
  await klick("Änderungen vorschauen");
  const form = aenderungsformular();
  const s = pflicht(form.querySelector("select"));
  await act(async () => {
    s.value = w.b.id;
    s.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const inputs = form.querySelectorAll<HTMLInputElement>("input:not([type=checkbox])");
  await eingabe(pflicht(inputs[0]), "700 T€");
  await eingabe(pflicht(inputs[1]), "Fiktive bewusste Änderung aus der Oberfläche.");
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await erwarte(() => host.textContent?.includes("Vorschau: 2 Datenfassungen betroffen") ?? false);
}
describe("PP07 · tatsächlicher Produktbedienweg in der bestehenden Folienfläche", () => {
  it("vorschauen → bewusst Datei/Daten speichern → Herkunft neu laden → beide Dateien → bewusst zurücknehmen", async () => {
    const vorher = await w.datei();
    await datenVorschau();
    expect((await w.datei()).satz.fassung).toBe(vorher.satz.fassung);
    expect(host.textContent).not.toContain("Diese Vorschau übernehmen");
    await klick("Übernahme vorbereiten");
    await erwarte(() => host.textContent?.includes("Dateivorschau:") ?? false);
    expect((await w.datei()).satz.fassung).toBe(vorher.satz.fassung);
    expect(knopf("Diese Vorschau übernehmen").disabled).toBe(false);
    await klick("Diese Vorschau übernehmen");
    await erwarte(
      () => host.textContent?.includes("Datei und gebundene Daten als Fassung") ?? false,
    );
    await erwarte(
      () =>
        !![...host.querySelectorAll<HTMLButtonElement>("button[data-datenpunkt]")].find(
          (b) => b.dataset.datenpunkt === w.b.id && b.textContent?.includes("700 T€"),
        ),
    );
    expect(document.activeElement).toBe(host.querySelector("[data-folien-daten]"));
    const zahl = [...host.querySelectorAll<HTMLButtonElement>("button[data-datenpunkt]")].find(
      (b) => b.dataset.datenpunkt === w.b.id,
    );
    if (!zahl) throw new Error("Gebundene Zahl fehlt.");
    await act(async () => zahl.click());
    await erwarte(
      () =>
        host.querySelector("[data-herkunft]")?.textContent?.includes("Fiktive bewusste Änderung") ??
        false,
    );
    await klick("Fassungen und Rücknahme");
    await erwarte(
      () => host.textContent?.includes("Die letzte Übernahme bewusst zurücknehmen") ?? false,
    );
    expect(host.textContent).toContain("700 T€ → 600 T€");
    expect(knopf("Kurze und ausführliche Dateien speichern").disabled).toBe(false);
    await klick("Kurze und ausführliche Dateien speichern");
    await erwarte(() => host.querySelectorAll("a[download]").length === 2);
    for (const a of host.querySelectorAll<HTMLAnchorElement>("a[download]")) {
      const get = await w.app.inject({
        method: "GET",
        url: pflicht(a.getAttribute("href")),
        headers: w.admin,
      });
      expect(get.statusCode, get.body).toBe(200);
    }
    await klick("Datei und gebundene Daten zurücknehmen");
    await erwarte(() => host.textContent?.includes("Rücknahme als Fassung") ?? false);
    expect((await w.services.datenpunkte.lesen(w.b.id))?.wert).toBe("600 T€");
    expect((await w.datei()).ko.version).toBe(vorher.ko.version + 2);
    expect(anfragen.filter((a) => a.includes("/datenaktualisierung/uebernehmen"))).toHaveLength(1);
    expect(anfragen.filter((a) => a.includes("/datenaktualisierung/ruecknahme"))).toHaveLength(1);
  });
  it("Escape verwirft die wartende Dateiübernahme; ihre späte Antwort setzt keine alte Vorschau zurück", async () => {
    await datenVorschau();
    let freigeben = () => {};
    pause = new Promise<void>((r) => {
      freigeben = r;
    });
    await klick("Übernahme vorbereiten");
    const input = pflicht(aenderungsformular().querySelector("input"));
    await act(async () => {
      input.focus();
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.activeElement).toBe(knopf("Änderungen vorschauen"));
    await act(async () => {
      freigeben();
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(host.textContent).not.toContain("Dateivorschau:");
    expect(host.textContent).not.toContain("Diese Vorschau übernehmen");
    expect((await w.services.datenpunkte.lesen(w.b.id))?.fassung).toBe(1);
  });
});
