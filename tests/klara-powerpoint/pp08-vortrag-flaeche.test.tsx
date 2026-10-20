// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { FolienDatenLage } from "../../apps/web/src/api/praesentationDaten";
import { VortragVorbereitung } from "../../apps/web/src/components/bibliothek/VortragVorbereitung";
import i18n from "../../apps/web/src/i18n";
import { vortragsWelt } from "./pp08-welt";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let w: Awaited<ReturnType<typeof vortragsWelt>>;
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let vorher: typeof fetch;
let verliertAntwort = false;
async function warten() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 35));
  });
}
async function zeichne(lage: FolienDatenLage = w.lage) {
  await act(async () => {
    root.render(createElement(VortragVorbereitung, { lage, oeffne: () => {} }));
  });
}
function label(name: string) {
  const l = [...host.querySelectorAll("label")].find((l) => l.textContent?.trim().startsWith(name));
  const f =
    l?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input,textarea,select",
    ) ?? host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${l?.htmlFor}`);
  expect(f, name).toBeTruthy();
  if (!f) throw new Error(`Feld fehlt: ${name}`);
  return f;
}
async function eingabe(name: string, wert: string) {
  const e = label(name);
  const proto =
    e.tagName === "TEXTAREA"
      ? HTMLTextAreaElement.prototype
      : e.tagName === "SELECT"
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  await act(async () => {
    const setze = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (!setze) throw new Error("Nativer Eingabe-Setter fehlt");
    setze.call(e, wert);
    e.dispatchEvent(new Event(e.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}
async function knopf(name: string) {
  const b = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === name);
  expect(b, name).toBeTruthy();
  await act(async () => {
    if (!b) throw new Error(`Knopf fehlt: ${name}`);
    b.click();
  });
  await warten();
}
beforeEach(async () => {
  await i18n.changeLanguage("de");
  w = await vortragsWelt();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vorher = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const r = await w.app.inject({
      method: (init?.method ?? "GET") as "GET",
      url: String(url),
      headers: { cookie: w.cookie, "content-type": "application/json" },
      ...(init?.body ? { payload: String(init.body) } : {}),
    });
    if (verliertAntwort && String(url).endsWith("/notizen") && init?.method === "POST") {
      verliertAntwort = false;
      throw new Error("Antwort nach gespeichertem Schreiben verloren");
    }
    return { ok: r.statusCode < 300, status: r.statusCode, text: async () => r.body };
  }) as typeof fetch;
  await zeichne();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  globalThis.fetch = vorher;
  verliertAntwort = false;
  await w?.app.close();
});

it("PP08 · Zuordnen, tatsächliches Notiz-/Aufgabenspeichern und idempotenter Wiederanlauf nach Antwortverlust", async () => {
  await eingabe("Aussage auswählen", w.dp.id);
  await eingabe("Bereitgestellte Rückfrage oder Notiz", "Regionale Ursache erklären.");
  await eingabe("Herkunft, etwa eigene Notiz mit Datum", "Eigene Notiz 20.10.2026, Punkt 3");
  await eingabe("Benötigte Arbeit", "erklaerung");
  await knopf("Notiz der Aussage zuordnen");
  await knopf("Nachbereitung prüfen und Aufgaben vorschlagen");
  expect((await w.ruf("GET", "/api/me/klara/aufgaben")).body.aufgaben).toHaveLength(0);
  verliertAntwort = true;
  await knopf("Als eigene Notiz und persönliche Aufgabe speichern");
  expect(host.textContent).toContain("Antwort nach gespeichertem Schreiben verloren");
  expect((await w.ruf("GET", "/api/me/klara/notizen")).body.notizen).toHaveLength(1);
  await knopf("Als eigene Notiz und persönliche Aufgabe speichern");
  expect(host.textContent).toContain("Persönliche Aufgabe gespeichert");
  const aufgaben = (await w.ruf("GET", "/api/me/klara/aufgaben")).body.aufgaben;
  expect(aufgaben).toHaveLength(1);
  expect(aufgaben[0].inhalt).toContain(`Folie 256; Aussage ${w.dp.id}, Fassung 1`);
  expect(aufgaben[0].inhalt).toContain("Regionale Ursache erklären.");
  expect(aufgaben[0].inhalt).not.toContain("1.500 T€");
  expect((await w.ruf("GET", "/api/me/klara/notizen")).body.notizen).toHaveLength(1);
  expect((await w.ruf("GET", `/api/me/klara/aufgaben/${aufgaben[0].id}`)).body.aufgabe.inhalt).toBe(
    aufgaben[0].inhalt,
  );
});
it("PP08 · keine automatische Probe; Fassungskonflikt erhält eigene Notizen und Nachbereitung", async () => {
  await eingabe("Sprechernotiz", "Eigene Erklärung erhalten.");
  await eingabe("Übergang zur nächsten Folie", "Danach folgt Ausblick.");
  await eingabe("Geplante Dauer in Sekunden", "60");
  const check = host.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!check) throw new Error("Aussageauswahl fehlt");
  await act(async () => check.click());
  await eingabe("Aussage auswählen", w.dp.id);
  await eingabe("Bereitgestellte Rückfrage oder Notiz", "Zusätzliche Erklärung nachreichen.");
  await eingabe("Herkunft, etwa eigene Notiz mit Datum", "Eigene Notiz, Punkt 7");
  await knopf("Notiz der Aussage zuordnen");
  await knopf("Plan prüfen und Rückfragen vorbereiten");
  expect(host.querySelector('[aria-label="Vortragsergebnis"]')).toBeTruthy();
  expect(host.textContent).not.toContain("keine gemessene Redezeit");
  const neu = structuredClone(w.lage) as FolienDatenLage;
  neu.dateiFassung = "neue-fassung";
  if (!neu.datenpunkte[0]) throw new Error("Datenpunkt fehlt");
  neu.datenpunkte[0].fassung = 2;
  await zeichne(neu);
  expect(host.textContent).toContain("Fassung oder Aussagenbindung geändert");
  expect(label("Sprechernotiz").value).toBe("Eigene Erklärung erhalten.");
  expect(host.textContent).toContain("Zusätzliche Erklärung nachreichen.");
  expect(host.querySelector('[aria-label="Vortragsergebnis"]')).toBeNull();
  await knopf("Aktuelle Fassung verwenden und Zuordnungen zurücknehmen");
  expect(label("Sprechernotiz").value).toBe("Eigene Erklärung erhalten.");
  expect(host.textContent).toContain("Zusätzliche Erklärung nachreichen.");
});
