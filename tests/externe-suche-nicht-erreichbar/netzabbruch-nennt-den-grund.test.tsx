// @vitest-environment jsdom
// ================================================================================================
// JOB 3802 — FÄLLT DAS NETZ AUS, SAGT `/extern` ES IN DER SPRACHE DES NUTZERS.
// ================================================================================================
//
// BESTELLT VON JOB 3796 (`jobs/3796/runde-1/RUECKGABE.md:60`): wer auf `/extern` sucht und dabei
// das Netz verliert, las bis hierher den Browser-Innentext „Failed to fetch" — in Safari „Load
// failed", in Firefox „NetworkError when attempting to fetch resource". Drei fremde Zeichenketten
// für DIESELBE Lage, keine davon ein Satz für einen Menschen.
//
// WARUM DER ALTE RÜCKFALL NIE GRIFF: `pages/ExternalKnowledge.tsx:32` hielt zwar
// `t("ext.unavailable")` bereit, prüfte aber `err instanceof Error` — und ein `TypeError` aus
// `fetch` IST eine `Error`-Instanz. Der Rückfall war toter Code. Die Reparatur prüft auf
// `ApiError` (so wie `MehrAbschnitte.tsx:375` und `lib/brandTheme.ts:148` es längst tun).
//
// DIE PRÜFRICHTUNG IST DER ZWECK, NICHT DIE ZEICHENKETTE: N3 wirft drei verschiedene fremde
// Netzfehlertexte. Wer die Reparatur auf „Failed to fetch" festnageln würde, hätte N3 rot — genau
// das ist gewollt.
//
// DIE DREI GEGENPROBEN, JEDE EINE ECHTE MUTATION (Runde 2, nach BEN-Hinweis zu Runde 1): (1) der
// alte Stand `err instanceof Error ? err.message : t("ext.unavailable")` zurück → N1/N2/N3 rot;
// (2) die Reihenfolge in `buildExternalSearchView` gedreht (`unreachable` vor `disabled`) → N5 rot,
// und zwar an der eigens dafür gepinnten Zeile am Ende von N5; (3) der TATSÄCHLICH befürchtete
// Fehler — eine 501-Antwort wird fälschlich als „nicht erreichbar" gezeigt (`serverantwort: false`
// auch für `ApiError`) → N4 rot. Ein blosses Vertauschen zweier DISJUNKTER Bedingungen wäre keine
// Gegenprobe; es bleibt still grün, solange kein Aufrufer beide zugleich setzt.
//
// ARIA-HIDDEN / SICHTBARKEIT (LEHREN JOB 3258 und 2045/2188): `sichtbarerText()` liest verborgene
// Teilbäume AUSDRÜCKLICH NICHT mit (`hidden`, `aria-hidden`, `sr-only`, `invisible`,
// `display:none`, `visibility:hidden`, 0-Pixel-Clip). Die Zusicherung dieses Auftrags ist, dass ein
// Mensch den Satz LIEST; ein `container.textContent` bewiese nur, dass er im DOM steht. Gegenprobe
// in der Rückgabe: mit `sr-only` an der Fehlerkarte wird N1 rot.
//
// I18N ALS SOLLWERT, NICHT ALS BEIDE SEITEN (LEHRE `LEHREN.md:146/153`): die Katalogwerte kommen
// über `i18n.getFixedT(<sprache>)` aus `i18n.ts` — abgeschrieben wird nichts. Damit ein Umbenennen
// des Wertes den Test nicht still grün lässt, steht in N1 ZUSÄTZLICH der unabhängige deutsche
// Wortlaut, und N2 prüft, dass die drei Sprachwerte paarweise verschieden sind.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { external: { search: vi.fn() } },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ApiError } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import i18n from "../../apps/web/src/i18n";
import {
  buildExternalSearchView,
  klassifiziereSuchfehler,
} from "../../apps/web/src/lib/externalKnowledge";
import { ExternalKnowledge } from "../../apps/web/src/pages/ExternalKnowledge";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const searchMock = endpoints.external.search as unknown as ReturnType<typeof vi.fn>;

/** Der Katalogwert einer Sprache — gelesen, nicht abgeschrieben. */
function katalog(sprache: string, schluessel: string): string {
  return i18n.getFixedT(sprache)(schluessel);
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  act(() => {
    root.render(
      createElement(QueryClientProvider, { client: qc }, createElement(ExternalKnowledge)),
    );
  });
}

beforeEach(() => {
  searchMock.mockReset();
});

afterEach(async () => {
  act(() => {
    root.unmount();
  });
  container.remove();
  await act(async () => {
    await i18n.changeLanguage("de");
  });
});

// Ist dieser Knoten (samt Elternkette) für einen sehenden Menschen da? jsdom rechnet kein Layout —
// geprüft wird genau das, was die Fläche selbst setzen würde, um etwas zu verbergen.
function verborgen(el: Element): boolean {
  for (let node: Element | null = el; node !== null; node = node.parentElement) {
    if (node.hasAttribute("hidden") || node.getAttribute("aria-hidden") === "true") {
      return true;
    }
    if (/\b(sr-only|invisible|hidden)\b/.test(node.getAttribute("class") ?? "")) {
      return true;
    }
    if (
      /display:\s*none|visibility:\s*hidden|clip:\s*rect\(0/.test(node.getAttribute("style") ?? "")
    ) {
      return true;
    }
  }
  return false;
}

function sichtbarerText(): string {
  const teile: string[] = [];
  const gehe = (el: Element): void => {
    if (verborgen(el)) {
      return;
    }
    for (const kind of el.childNodes) {
      if (kind.nodeType === 3) {
        teile.push(kind.textContent ?? "");
      } else if (kind.nodeType === 1) {
        gehe(kind as Element);
      }
    }
  };
  gehe(container);
  return teile.join(" ");
}

/** Sucht, während `endpoints.external.search` den übergebenen Wert wirft. */
async function sucheMitWurf(wurf: unknown): Promise<string> {
  searchMock.mockRejectedValue(wurf);
  mount();
  const feld = [...container.querySelectorAll("input")].find(
    (el) => el.getAttribute("placeholder") === i18n.t("ext.placeholder"),
  );
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error(`Suchfeld nicht gefunden; sichtbar: ${sichtbarerText()}`);
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(feld, "Dichtung");
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const knopf = [...container.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").includes(i18n.t("ext.search")) && !verborgen(b),
  );
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Suchknopf nicht gefunden; sichtbar: ${sichtbarerText()}`);
  }
  await act(async () => {
    knopf.click();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return sichtbarerText();
}

describe("JOB 3802: der Netzabbruch auf /extern bekommt einen eigenen, übersetzten Satz", () => {
  it("N1 · Netzabbruch: der deutsche Satz steht da, kein Browser-Innentext, keine Trefferaussage", async () => {
    const text = await sucheMitWurf(new TypeError("Failed to fetch"));

    // Der Satz, den ein Mensch liest — unabhängig formuliert UND gegen den Katalog geprüft.
    expect(text).toContain("Externe Suche ist nicht verfügbar.");
    expect(text).toContain(katalog("de", "ext.unavailable"));

    // Nichts aus dem Maschinenraum.
    expect(text).not.toContain("Failed to fetch");
    expect(text).not.toContain("ext.unavailable");

    // Keine Tatsachenaussage ohne Grundlage: „Keine Treffer" hat hier nichts zu suchen, und eine
    // Trefferliste erst recht nicht (LEHREN §7: eine Aussage hängt an ihrer Voraussetzung).
    expect(text).not.toContain(katalog("de", "extpage.noResults"));
    expect(text).not.toContain(katalog("de", "extpage.disabled"));
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });

  it("N2 · derselbe Fall auf Englisch und Niederländisch — je der eigene Satz, kein deutscher", async () => {
    // Erst der Beweis, dass die drei Katalogwerte überhaupt verschieden sind: sonst prüfte N2 nichts.
    const werte = ["de", "en", "nl"].map((s) => katalog(s, "ext.unavailable"));
    expect(new Set(werte).size, `drei verschiedene Sätze, gelesen: ${werte.join(" | ")}`).toBe(3);

    for (const sprache of ["en", "nl"]) {
      await act(async () => {
        await i18n.changeLanguage(sprache);
      });
      const text = await sucheMitWurf(new TypeError("Failed to fetch"));
      expect(text, `${sprache}: eigener Satz`).toContain(katalog(sprache, "ext.unavailable"));
      expect(text, `${sprache}: kein deutscher Satz`).not.toContain(
        katalog("de", "ext.unavailable"),
      );
      expect(text, `${sprache}: kein Browser-Innentext`).not.toContain("Failed to fetch");
      act(() => {
        root.unmount();
      });
      container.remove();
    }
    // Damit `afterEach` einen montierten Baum vorfindet.
    await sucheMitWurf(new TypeError("Failed to fetch"));
  });

  it("N3 · Safari und Firefox sagen es anders — die Fläche sagt denselben Satz", async () => {
    for (const fremd of ["Load failed", "NetworkError when attempting to fetch resource"]) {
      const text = await sucheMitWurf(new TypeError(fremd));
      expect(text, `„${fremd}" führt zum Hauskatalogsatz`).toContain(
        katalog("de", "ext.unavailable"),
      );
      expect(text, `„${fremd}" steht nicht auf der Fläche`).not.toContain(fremd);
      act(() => {
        root.unmount();
      });
      container.remove();
    }
    await sucheMitWurf(new TypeError("Load failed"));
  });

  it("N4 · Abgrenzung nach oben: ein antwortender Server behält sein Wort", async () => {
    // 502 mit Serversatz: der Server HAT geantwortet — sein Satz bleibt stehen.
    const serversatz = "Der Anbieter antwortet gerade nicht.";
    const mit502 = await sucheMitWurf(new ApiError(502, "UPSTREAM_UNAVAILABLE", serversatz));
    expect(mit502).toContain(serversatz);
    expect(mit502).not.toContain(katalog("de", "ext.unavailable"));
    act(() => {
      root.unmount();
    });
    container.remove();

    // 501: abgeschaltet — auch das ist eine Serverantwort und behält seinen eigenen Satz.
    const mit501 = await sucheMitWurf(
      new ApiError(501, "EXTERNAL_SEARCH_DISABLED", "external search disabled"),
    );
    expect(mit501).toContain(katalog("de", "extpage.disabled"));
    expect(mit501).not.toContain(katalog("de", "ext.unavailable"));
  });

  it("N5 · DOM-frei: die vier Fehlerzustände sind einzeln herstellbar und paarweise verschieden", async () => {
    const basis = { pending: false, hasSearched: true };

    const abgeschaltet = buildExternalSearchView({
      ...basis,
      error: klassifiziereSuchfehler(new ApiError(501, "EXTERNAL_SEARCH_DISABLED", "off")),
    });
    const unerreichbar = buildExternalSearchView({
      ...basis,
      error: klassifiziereSuchfehler(new TypeError("Failed to fetch")),
    });
    const serverfehler = buildExternalSearchView({
      ...basis,
      error: klassifiziereSuchfehler(new ApiError(500, "ERROR", "Boom")),
    });
    const leer = buildExternalSearchView({ ...basis, results: [] });

    expect(abgeschaltet).toEqual({ kind: "disabled" });
    expect(unerreichbar).toEqual({ kind: "unreachable" });
    expect(serverfehler).toEqual({ kind: "error", message: "Boom" });
    expect(leer).toEqual({ kind: "empty" });
    expect(new Set([abgeschaltet.kind, unerreichbar.kind, serverfehler.kind, leer.kind]).size).toBe(
      4,
    );

    // Ein Wurf, der GAR KEIN `Error` ist, ergibt ebenfalls „unerreichbar" — und keinen erfundenen
    // Fehlertext (Wissenslücke statt Erfindung).
    const blank = klassifiziereSuchfehler("kaputt");
    expect(blank?.serverantwort).toBe(false);
    expect(buildExternalSearchView({ ...basis, error: blank })).toEqual({ kind: "unreachable" });

    // Ohne Wurf gibt es keinen Fehler.
    expect(klassifiziereSuchfehler(null)).toBeNull();
    expect(klassifiziereSuchfehler(undefined)).toBeNull();

    // Nur ein `ApiError` ist eine Serveraussage.
    expect(klassifiziereSuchfehler(new ApiError(404, "NOT_FOUND", "weg"))?.serverantwort).toBe(
      true,
    );

    // DER FALL, DEN DIE REIHENFOLGE IN `buildExternalSearchView` WIRKLICH SCHÜTZT (Runde 2, nach
    // BEN-Hinweis): über `klassifiziereSuchfehler` können `501` und `serverantwort: false` nie
    // zusammen auftreten — ein Vertauschen der beiden Abfragen bliebe auf diesem Weg still grün und
    // bewiese nichts. Ein Aufrufer, der sein Fehlerobjekt SELBST zusammensetzt, kann beides zugleich
    // setzen. Dann gilt die AUSKUNFT des Servers (abgeschaltet), nicht die Vermutung des Aufrufers.
    // Dreht man die Reihenfolge, wird genau diese Zeile rot — die Gegenprobe steht in der Rückgabe.
    expect(
      buildExternalSearchView({
        ...basis,
        error: {
          status: 501,
          code: "EXTERNAL_SEARCH_DISABLED",
          message: "off",
          serverantwort: false,
        },
      }),
      "501 und zugleich keine Serverantwort: die Auskunft des Servers schlägt die Vermutung",
    ).toEqual({ kind: "disabled" });

    // Damit `afterEach` einen montierten Baum vorfindet.
    await sucheMitWurf(new TypeError("Failed to fetch"));
  });
});
