// @vitest-environment jsdom
// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0941 — KLARA ERKLÄRT EIN ELEMENT MIT EINEM KONKRETEN BEISPIEL.
// ================================================================================================
//
// DER ORIGINALWORTLAUT: „Man tippt auf ein Element, und Klara erklärt es — auf Wunsch per
// Sprachausgabe vorgelesen und mit einem konkreten Beispiel."
//
// BENS BEFUND (Nacharbeit 3): „Die Elementerklärung gibt den Hilfetext aus, das beauftragte
// konkrete Beispiel fehlt." Geliefert ist es in `lib/klaraBeispiele.ts` und angezeigt in
// `components/KlaraAssistant.tsx`. Geprüft wird hier:
//   E1 · jede der 49 Elementerklärungen (Erfassen `cap:*`, Prüfbereich `rev:*`) hat ein Beispiel
//        in DE, EN und NL — übersetzt und nicht bloß der Hilfetext noch einmal;
//   E2 · das AKTIVE Element (Fokus in einem `data-help`-Anker) zeigt sein Beispiel im Panel, in der
//        Sprache der Oberfläche;
//   E3 · der ZEIGE-MODUS („Element erklären", dann auf das Element tippen) zeigt es ebenso;
//   E4 · „Vorlesen" liest das Beispiel mit.
//
// GEPRÜFT WIRD DAS ECHTE BAUTEIL mit echtem Router und echtem i18n; ersetzt sind nur die
// Modellverfügbarkeit, die Modellanzeige (wie `tests/dok1-export-wahrheit/faq-anzeigeweg.test.tsx`)
// und für E4 die Sprachausgabe des Browsers, die jsdom nicht hat.
//
// GEGENPROBEN: ein Beispiel entfernen → E1 rot; die Beispielzeile aus dem Feldblock nehmen → E2 rot;
// aus dem Zeige-Modus-Block nehmen → E3 rot; `mitBeispiel` beim Vorlesen umgehen → E4 rot.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { KlaraAssistant } from "../../apps/web/src/components/KlaraAssistant";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_HELP_IDS } from "../../apps/web/src/lib/captureHelp";
import { KLARA_BEISPIELE, klaraBeispiel } from "../../apps/web/src/lib/klaraBeispiele";
import { klaraEntryById } from "../../apps/web/src/lib/klaraRegistry";
import { REVIEW_HELP_IDS } from "../../apps/web/src/lib/reviewHelp";
import { cleanForSpeech } from "../../apps/web/src/lib/vorlesen";

// R-1349 (Aufnahme gesamt-aufruferwaechter, Nacharbeit 7): die Pflichtliste stand bis hierher als
// Export in `lib/klaraBeispiele.ts`, gelesen nur von diesem Prüfstand. Sie ist die Erwartung DIESES
// Tests und steht deshalb hier — abgeleitet wie zuvor aus den Registern, nicht von Hand.
const BEISPIEL_PFLICHT: readonly string[] = [
  ...CAPTURE_HELP_IDS.map((id) => `cap:${id}`),
  ...REVIEW_HELP_IDS.map((id) => `rev:${id}`),
];

// E6 schaltet die Modellverfügbarkeit ein, alle anderen Fälle laufen ohne Modell.
const ki = vi.hoisted(() => ({ verfuegbar: false }));
vi.mock("../../apps/web/src/lib/useAiAvailable", () => ({
  useAiAvailable: () => ({ available: ki.verfuegbar, isLoading: false }),
}));
vi.mock("../../apps/web/src/components/AiModelInfo", () => ({ AiModelInfo: () => null }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let seite: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let client: QueryClient | null = null;

/** Ein Seitenelement mit `data-help`-Anker AUSSERHALB von Klara — das Element, auf das man tippt. */
function seitenelement(anker: string): HTMLButtonElement {
  seite = document.createElement("div");
  seite.setAttribute("data-help", anker);
  const knopf = document.createElement("button");
  knopf.textContent = "Seitenelement";
  seite.append(knopf);
  document.body.append(seite);
  return knopf;
}

async function klaraMounten(sprache: string): Promise<HTMLDivElement> {
  await i18n.changeLanguage(sprache);
  const flaeche = document.createElement("div");
  document.body.append(flaeche);
  host = flaeche;
  const wurzel = createRoot(flaeche);
  root = wurzel;
  const abfragen = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client = abfragen;
  await act(async () => {
    wurzel.render(
      createElement(
        QueryClientProvider,
        { client: abfragen },
        createElement(
          MemoryRouter,
          {
            initialEntries: ["/validierung"],
            future: { v7_startTransition: true, v7_relativeSplatPath: true },
          },
          createElement(KlaraAssistant),
        ),
      ),
    );
  });
  return flaeche;
}

afterEach(async () => {
  const wurzel = root;
  if (wurzel) {
    await act(async () => wurzel.unmount());
  }
  client?.clear();
  host?.remove();
  seite?.remove();
  host = null;
  seite = null;
  root = null;
  client = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  ki.verfuegbar = false;
  await i18n.changeLanguage("de");
});

/**
 * Wartet, bis das Panel nachgeladen hat, was es erst beim Öffnen holt (Deckel R-0801): die
 * Bibliothek (`lib/klaraBibliothek.ts`) und seit Nacharbeit 14 auch die Beispiele
 * (`lib/klaraBeispiele.ts`).
 */
async function bibliothekGeladen(): Promise<void> {
  await act(async () => {
    await import("../../apps/web/src/lib/klaraBibliothek");
    await import("../../apps/web/src/lib/klaraBeispiele");
    await new Promise((fertig) => setTimeout(fertig, 0));
  });
}

async function tippen(panel: HTMLElement, text: string): Promise<void> {
  const feld = panel.querySelector<HTMLInputElement>(
    `input[placeholder="${i18n.t("klara.searchPlaceholder")}"]`,
  );
  if (!feld) throw new Error("Klaras Suchfeld fehlt.");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function oeffnen(flaeche: HTMLElement): Promise<HTMLElement> {
  const knopf = flaeche.querySelector<HTMLButtonElement>(
    `button[aria-label="${i18n.t("klara.open")}"]`,
  );
  if (!knopf) throw new Error("Der Klara-Auslöser fehlt.");
  await act(async () => knopf.click());
  const panel = flaeche.querySelector<HTMLElement>("section[data-klara='1']");
  if (!panel) throw new Error("Klara hat sich nicht geöffnet.");
  return panel;
}

async function fokussieren(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  });
}

describe("R-0941 · das konkrete Beispiel in Klaras Elementerklärung", () => {
  it("E1 · jede Elementerklärung trägt ein Beispiel in DE, EN und NL", async () => {
    expect(BEISPIEL_PFLICHT.length).toBe(49);
    const fehlt: string[] = [];
    for (const id of BEISPIEL_PFLICHT) {
      const eintrag = klaraEntryById(id);
      if (!eintrag) {
        fehlt.push(`${id}: keine Elementerklärung`);
        continue;
      }
      const beispiel = KLARA_BEISPIELE[id];
      if (!beispiel) {
        fehlt.push(`${id}: kein Beispiel`);
        continue;
      }
      for (const sprache of ["de", "en", "nl"] as const) {
        await i18n.changeLanguage(sprache);
        const text = beispiel[sprache].trim();
        if (text.length < 40) fehlt.push(`${id} · ${sprache}: zu kurz`);
        if (text === i18n.t(eintrag.bodyKey).trim()) fehlt.push(`${id} · ${sprache}: = Hilfetext`);
      }
      if (beispiel.en === beispiel.de || beispiel.nl === beispiel.de) {
        fehlt.push(`${id}: nicht übersetzt`);
      }
    }
    // Und kein Beispiel hängt an einer Kennung, die keine Elementerklärung ist.
    for (const id of Object.keys(KLARA_BEISPIELE)) {
      if (!BEISPIEL_PFLICHT.includes(id)) fehlt.push(`${id}: Beispiel ohne Elementerklärung`);
    }
    expect(fehlt).toEqual([]);
  });

  it.each(["de", "en"] as const)(
    "E2 · %s: das aktive Element zeigt sein Beispiel in der Sprache der Oberfläche",
    async (sprache) => {
      const knopf = seitenelement("rev:approve");
      const flaeche = await klaraMounten(sprache);
      await fokussieren(knopf);
      const panel = await oeffnen(flaeche);
      await bibliothekGeladen();
      const zeile = panel.querySelector('[data-testid="klara-beispiel-feld"]');
      expect(zeile, "das aktive Element zeigt kein Beispiel").not.toBeNull();
      expect(zeile?.textContent).toContain(i18n.t("klarabeispiel.titel"));
      expect(zeile?.textContent).toContain(klaraBeispiel("rev:approve", sprache));
    },
  );

  it("E3 · der Zeige-Modus: Element erklären, auf das Element tippen — das Beispiel steht da", async () => {
    const knopf = seitenelement("cap:tagsField");
    const flaeche = await klaraMounten("de");
    const panel = await oeffnen(flaeche);
    await bibliothekGeladen();
    const zeigen = [...panel.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === i18n.t("klara.inspect"),
    );
    if (!zeigen) throw new Error("„Element erklären“ fehlt.");
    await act(async () => zeigen.click());
    await act(async () => knopf.click());
    const zeile = flaeche.querySelector('[data-testid="klara-beispiel-element"]');
    expect(zeile, "der Zeige-Modus zeigt kein Beispiel").not.toBeNull();
    expect(zeile?.textContent).toContain(klaraBeispiel("cap:tagsField", "de"));
  });

  it("E5 · Nacharbeit 5: Klaras Suchfeld findet einen Bibliotheksartikel („Leimzeit“)", async () => {
    // R-0890 / R-0935: „Leimzeit“ steht ausschließlich im Bereichsartikel „Wissen erfassen“
    // (`lib/hilfeBibliothek.ts`) — gefunden wird es nur, wenn das Panel die Artikel durchsucht.
    // Nacharbeit 6: das Panel lädt die Artikel beim Öffnen nach (`lib/klaraBibliothek.ts`, Deckel
    // R-0801); der Test wartet, bis dieses Nachladen durch ist, bevor er tippt.
    const flaeche = await klaraMounten("de");
    const panel = await oeffnen(flaeche);
    await bibliothekGeladen();
    await tippen(panel, "Leimzeit");
    const text = panel.textContent ?? "";
    expect(text, "der Artikel erscheint nicht unter Klaras Treffern").toContain(
      i18n.t("help.capture.title"),
    );
    expect(text).toContain("Leimzeit");
  });

  it("E6 · Nacharbeit 7: die KI-Suche nach „Leimzeit“ bekommt den Bibliotheksauszug als Grundlage", async () => {
    // R-0943 (Ben): „Bei „Leimzeit“ erscheint ein Artikel, während die KI-Suche fehlende Grundlage
    // meldet." Gelesen wird der Anfragekörper, den das Panel wirklich an `help.explain` gibt; die
    // Antwort bleibt aus (die Modellkante ist nicht Gegenstand dieses Falls).
    // GEGENPROBE: in `askAi` wieder `rankKlara(resolved, question, 12)` → kein Aufruf, E6 rot.
    ki.verfuegbar = true;
    const erklaeren = vi.spyOn(endpoints.help, "explain");
    erklaeren.mockReturnValue(new Promise<never>(() => {}));
    const flaeche = await klaraMounten("de");
    const panel = await oeffnen(flaeche);
    await bibliothekGeladen();
    await tippen(panel, "Leimzeit");
    const knopf = [...panel.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === i18n.t("klara.aiSearch"),
    );
    if (!knopf) throw new Error("Der Knopf der KI-Suche fehlt.");
    await act(async () => knopf.click());
    expect(erklaeren, "die KI-Suche ging ohne Grundlage nicht hinaus").toHaveBeenCalledTimes(1);
    const grundlage = erklaeren.mock.calls[0]?.[0].snippets ?? [];
    const auszug = grundlage.find((s) => s.id === "artikel:capture:was");
    expect(auszug, "der Auszug zu „Wissen erfassen“ fehlt in der Grundlage").toBeDefined();
    expect(auszug?.body).toContain("Leimzeit");
  });

  it("E4 · „Vorlesen“ liest das Beispiel mit", async () => {
    const gesprochen: string[] = [];
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        lang = "";
        voice: unknown = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    vi.stubGlobal("speechSynthesis", {
      speak: (u: { text: string }) => gesprochen.push(u.text),
      cancel: () => {},
      getVoices: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    const knopf = seitenelement("rev:approve");
    const flaeche = await klaraMounten("de");
    await fokussieren(knopf);
    const panel = await oeffnen(flaeche);
    await bibliothekGeladen();
    const block = panel.querySelector('[data-testid="klara-beispiel-feld"]')?.parentElement;
    const vorlesen = [...(block?.querySelectorAll("button") ?? [])].find(
      (b) => (b.textContent ?? "").trim() === i18n.t("klara.speak"),
    );
    if (!vorlesen) throw new Error("Der Vorlese-Knopf am aktiven Element fehlt.");
    await act(async () => vorlesen.click());
    expect(gesprochen).toHaveLength(1);
    expect(gesprochen[0]).toContain(cleanForSpeech(klaraBeispiel("rev:approve", "de") ?? "∅"));
  });
});
