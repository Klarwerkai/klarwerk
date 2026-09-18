// @vitest-environment jsdom
// ================================================================================================
// JOB 4153 (WG-ANZEIGE) — R11: OHNE MAUS, OHNE KI, AUF SCHMALER FLÄCHE (G8) — UND IN DREI SPRACHEN.
// ================================================================================================
//
// WAS HIER GEMESSEN WIRD UND WAS NICHT. jsdom rechnet kein Layout: über gerenderte Breiten sagt
// diese Datei nichts, und sie behauptet es auch nicht. Was sie messen KANN, ist die Voraussetzung
// jeder Bedienbarkeit ohne Maus und jeder Lesbarkeit auf einem Telefon — und das sind
// Eigenschaften des Bauteils, nicht des Browsers:
//
//   · Jede Handlung hängt an einem ECHTEN Bedienelement (`button`, `a`, `input`, `select`). Ein
//     `div` mit `onClick` ist per Tastatur nicht erreichbar, und genau daran scheitern Flächen.
//   · Kein Bedienelement ist aus der Tab-Reihenfolge genommen (`tabindex="-1"`).
//   · Jedes Eingabefeld hat eine verbundene Beschriftung (`label for` → `id`).
//   · KEINE Aussage steht in einer abschneidenden Klasse (`truncate`, `*-nowrap`,
//     `overflow-hidden`) und keine in einer festen Pixelbreite: auf schmaler Fläche bricht die
//     Zeile um, statt den Satz zu verstümmeln. Diese Prüfung liest die Quelle — dieselbe Bauform
//     wie `tests/app/focus-visible-global-contract.test.ts`, und aus demselben Grund: die Klassen
//     sind hier die Zusage, und jsdom könnte sie nicht nachmessen.
//   · Kein KI-Weg: das Bauteil kennt weder Modell noch Vorschlag. Hier setzt ein Mensch.
//
// Und weil ein montierter Zugangstest allein kein Ergebnisbild belegt (Lehre JOB 4125 R1,
// 15.09. 13:48), wird derselbe gesetzte Bestand zusätzlich in DE, EN und NL gelesen: die Sätze
// müssen in der jeweiligen Sprache dastehen und nicht in einer anderen.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUELLE_ID, ZIEL_A, neuerPruefstand, zweiAktiveKanten } from "./bestand";

const stand: { p: ReturnType<typeof neuerPruefstand> } = { p: neuerPruefstand() };

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    ko: {
      beziehungen: vi.fn((id: string) => stand.p.beziehungen(id)),
      beziehungSetzen: vi.fn((id: string, body: never) => stand.p.setzen(id, body)),
      beziehungWiderrufen: vi.fn((kanteId: string, body: { version: number }) =>
        stand.p.widerruf(kanteId, body),
      ),
      get: vi.fn((id: string) => stand.p.ko(id)),
    },
    library: { search: vi.fn((params: { q?: string }) => stand.p.suche(params)) },
  };
  const endpoints = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return new Proxy({}, { get: () => leer() });
    },
  });
  return { endpoints };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { WissensbeziehungenBereich } from "../../apps/web/src/components/WissensbeziehungenBereich";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Die Quelle über die Projektwurzel, wie `tools/modalgrenze.ts:44` (`WURZEL = process.cwd()`).
// GEMESSEN und nicht gewählt: `new URL(..., import.meta.url)` — die Bauform von
// `tests/app/focus-visible-global-contract.test.ts:31` — trägt in der jsdom-Umgebung keinen
// `file:`-Ursprung und scheitert dort mit „The URL must be of scheme file". Jene Datei läuft in
// der Node-Umgebung; diese braucht jsdom für die Montage.
const QUELLE = readFileSync(
  join(process.cwd(), "apps", "web", "src", "components", "WissensbeziehungenBereich.tsx"),
  "utf8",
);

/**
 * Die Quelle OHNE Kommentare — geprüft wird, was das Bauteil TUT, nicht was es über sich schreibt.
 *
 * GEMESSEN und nicht vorsorglich gebaut: der erste Lauf war rot, weil die Datei in ihrem eigenen
 * Kopf erklärt, dass sie „kein `truncate`" und „keinen Vorschlag" kennt. Eine Prüfung, die an der
 * Begründung ihrer eigenen Regel scheitert, misst die Regel nicht.
 */
const CODE = QUELLE.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/gm, "$1");

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * Einen Wert setzen, den React auch BEMERKT.
 *
 * React verfolgt den Wert eines Feldes über einen eigenen Setter auf dem Knoten; eine einfache
 * Zuweisung `feld.value = x` aktualisiert diesen Tracker mit und React sieht anschliessend KEINE
 * Änderung — `onChange` bleibt aus, und der Fall wird grün oder rot aus dem falschen Grund.
 * Gemessen im ersten Lauf dieser Datei (Suchtreffer erschienen nie). Der Prototyp-Setter umgeht
 * den Tracker; dieselbe Bauform wie `tests/import-freitext-titel/…:145-152`.
 */
function nativSetzen(el: HTMLInputElement | HTMLSelectElement, wert: string): void {
  const prototyp =
    el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototyp, "value")?.set;
  setter?.call(el, wert);
}

async function montiere(): Promise<{
  container: HTMLElement;
  text: () => string;
  finde: (marke: string) => HTMLElement | null;
  klick: (el: Element | null | undefined) => Promise<void>;
  tippe: (el: Element | null | undefined, wert: string) => Promise<void>;
  unmount: () => void;
}> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(
          QueryClientProvider,
          { client },
          createElement(WissensbeziehungenBereich, { koId: QUELLE_ID }),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return {
    container,
    text: () => container.textContent ?? "",
    finde: (marke) => container.querySelector<HTMLElement>(`[data-testid="${marke}"]`),
    klick: async (el) => {
      await act(async () => {
        (el as HTMLElement | undefined)?.click();
        await flush();
      });
      await act(flush);
    },
    tippe: async (el, wert) => {
      const feld = el as HTMLInputElement;
      await act(async () => {
        nativSetzen(feld, wert);
        feld.dispatchEvent(new Event("input", { bubbles: true }));
        await flush();
      });
      await act(flush);
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

beforeEach(async () => {
  stand.p = neuerPruefstand();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
  await i18n.changeLanguage("de");
});

describe("R11a · Jede Handlung hängt an einem echten Bedienelement", () => {
  it("Liste, Zielauswahl, Setzen und Widerruf sind Buttons, Links, Felder — kein div mit onClick", async () => {
    stand.p.kanten = zweiAktiveKanten();
    const b = await montiere();
    // Zuerst die Wege, die ohne weitere Eingabe da sind.
    expect(b.finde("wb-widerruf")?.tagName).toBe("BUTTON");
    expect(b.finde("wb-setzen-knopf")?.tagName).toBe("BUTTON");
    expect(b.finde("wb-suche")?.tagName).toBe("INPUT");
    expect(b.finde("wb-art")?.tagName).toBe("SELECT");
    expect(b.finde("wb-richtung")?.tagName).toBe("SELECT");
    // Der Weg zum Gegenstück ist ein echter Link mit Adresse.
    const link = b.container.querySelector("a");
    expect(link?.getAttribute("href")).toBe(`/wissen/${ZIEL_A.id}`);
    // Dann die Wege hinter der Suche.
    await b.tippe(b.finde("wb-suche"), ZIEL_A.title.slice(0, 10));
    expect(b.finde("wb-treffer")?.tagName).toBe("BUTTON");
    await b.klick(b.finde("wb-treffer"));
    expect(b.finde("wb-ziel-aendern")?.tagName).toBe("BUTTON");
    // Und die Rückfrage des Widerrufs.
    await b.klick(b.finde("wb-widerruf"));
    expect(b.finde("wb-widerruf-ja")?.tagName).toBe("BUTTON");
    expect(b.finde("wb-widerruf-nein")?.tagName).toBe("BUTTON");
    b.unmount();
  });

  it("kein Bedienelement ist aus der Tab-Reihenfolge genommen", async () => {
    stand.p.kanten = zweiAktiveKanten();
    const b = await montiere();
    await b.tippe(b.finde("wb-suche"), ZIEL_A.title.slice(0, 10));
    await b.klick(b.finde("wb-widerruf"));
    const bedienbar = [...b.container.querySelectorAll("button, a, input, select, textarea")];
    expect(bedienbar.length).toBeGreaterThan(5);
    const ausgenommen = bedienbar
      .filter((el) => Number(el.getAttribute("tabindex") ?? "0") < 0)
      .map((el) => el.getAttribute("data-testid") ?? el.tagName);
    expect(ausgenommen, "Bedienelemente ohne Tab-Zugang").toEqual([]);
    b.unmount();
  });

  it("jedes Eingabefeld hat eine verbundene Beschriftung", async () => {
    const b = await montiere();
    for (const feld of [...b.container.querySelectorAll<HTMLElement>("input, select")]) {
      const id = feld.getAttribute("id");
      expect(id, `Feld ohne id: ${feld.outerHTML.slice(0, 80)}`).toBeTruthy();
      const label = b.container.querySelector(`label[for="${id}"]`);
      expect(label, `keine Beschriftung für „${id}"`).not.toBeNull();
      expect((label?.textContent ?? "").trim().length).toBeGreaterThan(0);
    }
    b.unmount();
  });
});

describe("R11b · Schmale Fläche: keine Aussage wird abgeschnitten", () => {
  it("das Bauteil benutzt keine abschneidende Klasse", () => {
    const verboten = ["truncate", "whitespace-nowrap", "text-nowrap", "overflow-hidden"];
    const gefunden = verboten.filter((k) => CODE.includes(k));
    expect(gefunden, "abschneidende Klassen im Beziehungsbereich").toEqual([]);
  });

  it("das Bauteil hat keine feste Pixelbreite — es folgt der Fläche", () => {
    // `text-[12.5px]` ist eine Schriftgröße und kein Maß der Fläche; verboten sind Breiten.
    const breiten = CODE.match(/\b(?:w|min-w|max-w)-\[[^\]]*px[^\]]*\]/g) ?? [];
    expect(breiten, "feste Pixelbreiten").toEqual([]);
  });

  it("jede Zeile mit mehreren Angaben darf umbrechen", () => {
    // Jede `flex`-Reihe dieses Bauteils trägt `flex-wrap` — sonst schiebt sie ihre Angaben
    // auf schmaler Fläche aus dem Bild.
    const reihen = CODE.match(/className="[^"]*\bflex\b[^"]*"/g) ?? [];
    expect(reihen.length).toBeGreaterThan(0);
    const ohneUmbruch = reihen.filter((r) => !r.includes("flex-wrap"));
    expect(ohneUmbruch, "flex-Reihen ohne Umbruch").toEqual([]);
  });

  it("die Sätze stehen in Blockelementen und nicht in einer Zeile aneinandergereiht", async () => {
    stand.p.kanten = zweiAktiveKanten();
    const b = await montiere();
    const kante = b.finde("wb-kante");
    expect(kante).not.toBeNull();
    // Satz, Fassungsvermerk und Grenze sind je ein eigenes `<p>` — jedes bricht für sich um.
    expect(kante?.querySelectorAll("p").length ?? 0).toBeGreaterThanOrEqual(2);
    b.unmount();
  });

  // ----------------------------------------------------------------------------------------------
  // RUNDE 2 — KEIN `placeholder`. DER SATZ STEHT, ER VERSCHWINDET NICHT.
  // ----------------------------------------------------------------------------------------------
  // ZWEI GRÜNDE, und der erste ist der Nutzer: ein Platzhalter ist weg, sobald jemand tippt, und
  // auf schmaler Fläche ist er das Erste, was der Browser abschneidet — die Gestalt des
  // Nutzerbefunds N-0022. Der zweite ist gemessen: die Platzhalter unter „Mehr" sind GEZÄHLT und
  // mit Wortlaut je Sprache festgehalten (`tests/bibliothek-mehr-platzhalter/
  // platzhalter-englisch-chromium.test.ts`, Sollwerttabelle mit ACHT Zeilen). Dieser Bereich hängt
  // in einem `[data-bib-abschnitt]`; in Runde 1 trug sein Suchfeld einen Platzhalter, und das Tor
  // wurde rot: „expected 'de: 9 Platzhalter …' to be 'de: 8 Platzhalter …'". Jene Tabelle gehört
  // diesem Auftrag nicht — also steht hier keiner, und dieser Fall hält das fest.
  it("kein Bedienelement trägt einen `placeholder` — der Hinweis steht als Text", async () => {
    const b = await montiere();
    const mitPlatzhalter = [...b.container.querySelectorAll("[placeholder]")].map(
      (el) => `${el.tagName}#${el.getAttribute("id") ?? "?"}="${el.getAttribute("placeholder")}"`,
    );
    expect(mitPlatzhalter, "Platzhalter im Beziehungsbereich (zählt unter „Mehr“ mit)").toEqual([]);
    // Und der Hinweis ist nicht einfach weg, sondern steht sichtbar UND mit dem Feld verbunden.
    const hinweis = b.finde("wb-suche-hinweis");
    expect(hinweis?.textContent ?? "").toBe(i18n.t("wb.setzen.sucheHinweis"));
    expect(b.finde("wb-suche")?.getAttribute("aria-describedby")).toBe(hinweis?.getAttribute("id"));
    b.unmount();
  });

  it("auch die Quelle trägt kein `placeholder`-Attribut (kein zweiter Weg zurück)", () => {
    expect(CODE.match(/\bplaceholder[=:]/g) ?? []).toEqual([]);
  });
});

describe("R11c · Ohne KI — und derselbe Bestand in DE, EN und NL", () => {
  it("das Bauteil kennt kein Modell, keinen Vorschlag, keine Automatik", () => {
    for (const wort of ["reasoner", "useAssist", "aiCheck", "vorschlag", "suggest"]) {
      expect(CODE.toLowerCase(), `„${wort}" gehört nicht in diesen Bereich`).not.toContain(
        wort.toLowerCase(),
      );
    }
  });

  it.each(["de", "en", "nl"])("Richtungssatz und Fassungsvermerk stehen in %s", async (sprache) => {
    stand.p.kanten = zweiAktiveKanten();
    stand.p.quelleVersion = 9;
    await i18n.changeLanguage(sprache);
    const b = await montiere();
    const text = b.text();
    // Der Richtungssatz und der Fassungsvermerk in DIESER Sprache — und beide Zahlen des
    // Vergleichs (beurteilt 4, heute 9) stehen darin.
    expect(text).toContain(i18n.t("wb.satz.ersetzt.quelle", { title: ZIEL_A.title }));
    expect(b.finde("wb-fassung")?.textContent ?? "").toBe(
      // JOB 4336: dieselben Zahlen, neue Parameternamen — die Kante trägt `rolle: "quelle"`, der
      // geöffnete Eintrag ist die Quelle, 4 → 9 also seine eigene Fassung.
      i18n.t("wb.fassung.geaendert", {
        beurteiltDieser: 4,
        beurteiltGegen: 2,
        aktuellDieser: 9,
        aktuellGegen: 2,
      }),
    );
    // Und die Sprachen sind wirklich verschieden: der deutsche Satz steht in EN/NL nicht da.
    if (sprache !== "de") {
      const deutsch = i18n.getFixedT("de")("wb.satz.ersetzt.quelle", { title: ZIEL_A.title });
      expect(text).not.toContain(deutsch);
    }
    b.unmount();
  });
});
