// @vitest-environment jsdom
// ================================================================================================
// JOB 4353 · DAS STATUSWORT AN DER BEZIEHUNG — AUS DEM BESTAND, NICHT AUS DER HANDLUNG.
// ================================================================================================
//
// DER AUSGANGSFEHLER, den diese Datei zuerst rot gezeigt hat: an einer gesetzten Fachbeziehung
// stand KEIN Statuswort. Ein Widerruf war ausschliesslich als Abwesenheit der Kachel zu erkennen
// — so steht es wörtlich in der Strecke von JOB 4328 (`tests/wissensnetz-nutzerweg/strecke.ts:24`)
// und als offene Frage in `archiv/4328/runde-3/RUECKGABE.md:55`.
//
// WAS HIER GEMESSEN WIRD und was nicht:
//
//   · GEMESSEN: dass das Wort je Beziehung erscheint, dass es aus `status` der GESPEICHERTEN Kante
//     kommt (derselbe Klick führt bei zwei verschiedenen Serverständen zu zwei verschiedenen
//     Wörtern, S4 gegen S3), dass es aus dem Sprachkatalog stammt und kein Rohbezeichner ist, und
//     dass Art, Richtung und Herkunft daneben unverändert stehen.
//   · NICHT GEMESSEN: Sichtbarkeit im Sinne von REGELN.md 9. jsdom rechnet kein Layout und kein
//     `checkVisibility`. Die Sichtbarkeitszusage trägt ausschliesslich der Chromium-Lauf
//     (`statuswort-am-bestand.integration.test.ts`) samt seiner Kalibrierung; diese Datei sagt
//     über sie NICHTS.
//
// Die Gegenseite ist der bestehende Prüfstand aus JOB 4153 (`../wissensgraph-anzeige/bestand.ts`):
// er hält einen Kantenbestand, gibt im Leseweg nur AKTIVE Kanten aus und beantwortet den Widerruf
// mit der Kante, die danach wirklich im Bestand steht. Eine feste Antwortliste könnte S3/S4 nicht
// unterscheiden — sie würde zweimal dasselbe behaupten.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QUELLE_ID,
  ZIEL_A,
  kanteWiderspricht,
  neuerPruefstand,
  zweiAktiveKanten,
} from "../wissensgraph-anzeige/bestand";
import { SOLL_WORT, SPRACHEN } from "./sollwoerter";

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
import {
  WissensbeziehungenBereich,
  beziehungsstatusText,
} from "../../apps/web/src/components/WissensbeziehungenBereich";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Der Sollwert aus dem KATALOG — für alles, was weiterhin dort wohnt (Art, Richtung, Herkunft). */
const wort = (schluessel: string): string => String(i18n.t(schluessel, {}));

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

interface Buehne {
  text: () => string;
  finde: (marke: string) => HTMLElement | null;
  alle: (marke: string) => HTMLElement[];
  klick: (el: Element | null | undefined) => Promise<void>;
  unmount: () => void;
}

async function montiere(): Promise<Buehne> {
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
    text: () => container.textContent ?? "",
    finde: (marke) => container.querySelector<HTMLElement>(`[data-testid="${marke}"]`),
    alle: (marke) => [...container.querySelectorAll<HTMLElement>(`[data-testid="${marke}"]`)],
    klick: async (el) => {
      await act(async () => {
        (el as HTMLElement | undefined)?.click();
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

/** Den Widerruf einer Kachel bis zur Antwort führen — der Weg, den ein Mensch geht. */
async function widerrufe(b: Buehne, kanteId: string): Promise<void> {
  const kachel = b.alle("wb-kante").find((k) => k.getAttribute("data-kante-id") === kanteId);
  expect(kachel, `Kachel ${kanteId} fehlt`).toBeDefined();
  await b.klick(kachel?.querySelector('[data-testid="wb-widerruf"]'));
  await b.klick(b.finde("wb-widerruf-ja"));
}

let buehne: Buehne | undefined;

beforeEach(async () => {
  stand.p = neuerPruefstand();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  buehne?.unmount();
  buehne = undefined;
  await i18n.changeLanguage("de");
});

describe("JOB 4353 · Wissensbeziehungen zeigen ihren Status", () => {
  it("S1 · jede gesetzte Beziehung trägt ihr Statuswort, und es ist kein Rohbezeichner", async () => {
    stand.p.kanten = zweiAktiveKanten();
    buehne = await montiere();

    const kacheln = buehne.alle("wb-kante");
    expect(kacheln.length, "beide gesetzten Beziehungen stehen in der Liste").toBe(2);
    const marken = buehne.alle("wb-status");
    expect(marken.length, "jede Kachel trägt genau ein Statuswort").toBe(2);
    for (const marke of marken) {
      expect(marke.textContent, "das Statuswort ist das zugesagte Wort").toBe(SOLL_WORT.de?.aktiv);
      expect(marke.getAttribute("data-status"), "die Marke nennt den gelesenen Wert").toBe("aktiv");
    }
    // Das Wort steht IN der Kachel, also an der Beziehung — nicht als Kopfzeile des Blocks.
    for (const kachel of kacheln) {
      expect(
        kachel.querySelector('[data-testid="wb-status"]'),
        "das Statuswort gehört in die Kachel der Beziehung",
      ).not.toBeNull();
    }
    // Der Rohbezeichner des Bestands darf an der Fläche NIE erscheinen.
    expect(buehne.text(), "„aktiv“ ist ein Bezeichner und kein Wort für Menschen").not.toContain(
      "aktiv",
    );
  });

  it("S2 · Art, Richtung und Herkunft stehen unverändert daneben", async () => {
    stand.p.kanten = zweiAktiveKanten();
    buehne = await montiere();

    const gerichtet = buehne
      .alle("wb-kante")
      .find((k) => k.getAttribute("data-kante-id") === "k-ersetzt");
    expect(gerichtet, "die gerichtete Kante fehlt").toBeDefined();
    // Der Richtungssatz (Art + Richtung in einem Satz) — zeichengleich der Sollwert des Katalogs.
    expect(gerichtet?.querySelector("p:first-of-type")?.textContent).toBe(
      String(i18n.t("wb.satz.ersetzt.quelle", { title: ZIEL_A.title })),
    );
    expect(
      gerichtet?.querySelector('[data-testid="wb-herkunft"]')?.textContent,
      "das Herkunftsetikett bleibt",
    ).toBe(wort("wb.herkunft.gesetzt"));
    expect(
      gerichtet?.querySelector('[data-testid="wb-fassung"]')?.textContent,
      "der Fassungsvermerk bleibt — er ist die Inhaltsauskunft, der Status ist es NICHT",
    ).toBe(String(i18n.t("wb.fassung.unveraendert", { aktuellDieser: "4", aktuellGegen: "2" })));

    const ungerichtet = buehne
      .alle("wb-kante")
      .find((k) => k.getAttribute("data-kante-id") === "k-ergaenzt");
    expect(
      ungerichtet?.querySelector("p:first-of-type")?.textContent,
      "die ungerichtete Kante behält ihren Satz ohne Richtungsaussage",
    ).toBe(
      String(
        i18n.t("wb.satz.ohneRichtung", {
          title: stand.p.kanten[1]?.gegenstueck.title ?? "",
          art: wort("wb.art.ergaenzt"),
        }),
      ),
    );
  });

  it("S3 · nach einem angenommenen Widerruf steht das Wort der WIDERRUFENEN Beziehung da", async () => {
    stand.p.kanten = kanteWiderspricht();
    buehne = await montiere();
    await widerrufe(buehne, "k-wider");

    expect(buehne.finde("wb-widerruf-erfolg"), "der Widerruf wurde angenommen").not.toBeNull();
    const marke = buehne.finde("wb-antwort-status");
    expect(marke, "die Antwort des Widerrufs nennt ihren Status").not.toBeNull();
    expect(marke?.textContent).toBe(SOLL_WORT.de?.widerrufen);
    expect(marke?.getAttribute("data-status")).toBe("widerrufen");
    // Und die Liste folgt dem Bestand: die widerrufene Beziehung wird nicht mehr ausgegeben.
    expect(buehne.alle("wb-kante").length, "die widerrufene Kachel ist aus der Liste").toBe(0);
  });

  it("S4 · derselbe Klick, ein anderer gespeicherter Status — ein anderes Wort", async () => {
    // DIE KALIBRIERUNG DER ZUSAGE „aus der gespeicherten Beziehung": der Server antwortet mit 200
    // und die Kante bleibt AKTIV. Käme das Wort aus der Handlung, stünde hier „widerrufen“.
    stand.p.kanten = kanteWiderspricht();
    stand.p.widerrufOhneWirkung = true;
    buehne = await montiere();
    await widerrufe(buehne, "k-wider");

    expect(
      buehne.finde("wb-widerruf-ohne-wirkung"),
      "eine angekommene Antwort ist keine Zustandsänderung",
    ).not.toBeNull();
    expect(buehne.finde("wb-widerruf-erfolg"), "und sie ist keine Erfolgsmeldung").toBeNull();
    const marke = buehne.finde("wb-antwort-status");
    expect(marke?.textContent, "der Bestand meldet die Beziehung weiterhin als geltend").toBe(
      SOLL_WORT.de?.aktiv,
    );
    expect(marke?.getAttribute("data-status")).toBe("aktiv");
    expect(buehne.alle("wb-kante").length, "sie steht deshalb weiter in der Liste").toBe(1);
  });

  it("S5 · die Zuordnung ist für alle drei Sprachen vollständig, verschieden und ohne „geprüft“", async () => {
    // Die Zuordnung der Komponente gegen die AUSGESCHRIEBENE Sollwerttabelle oben — Sprache für
    // Sprache, Wert für Wert. Ein still geändertes Wort wird hier rot.
    for (const sprache of SPRACHEN) {
      const soll = SOLL_WORT[sprache];
      expect(soll, `für ${sprache} fehlt die Sollwertzeile`).toBeDefined();
      expect(beziehungsstatusText("aktiv", sprache), `${sprache}: das Wort für „aktiv“`).toBe(
        soll?.aktiv,
      );
      expect(
        beziehungsstatusText("widerrufen", sprache),
        `${sprache}: das Wort für „widerrufen“`,
      ).toBe(soll?.widerrufen);
      // Ohne Unterschied wäre die Zusage „eine geltende von einer widerrufenen unterscheiden“ leer.
      expect(soll?.aktiv, `${sprache}: geltend und widerrufen müssen verschieden heissen`).not.toBe(
        soll?.widerrufen,
      );
      for (const w of [soll?.aktiv ?? "", soll?.widerrufen ?? ""]) {
        expect(w.length, `${sprache}: ein leeres Statuswort ist kein Wort`).toBeGreaterThan(0);
        expect(
          w.toLowerCase(),
          "„geprüft“ ist an dieser Fläche eine Inhaltsaussage ohne Messung und verboten",
        ).not.toContain("geprüft");
      }
    }
    // Ein unbekannter oder regionalisierter Wert darf zu einem VERSTÄNDLICHEN Wort führen, nie zu
    // einer leeren Fläche — dieselbe Vorgabe wie `fallbackLng: "de"` in `i18n.ts`.
    expect(beziehungsstatusText("aktiv", "de-DE"), "ein Regionalcode fällt auf de zurück").toBe(
      SOLL_WORT.de?.aktiv,
    );
    expect(beziehungsstatusText("aktiv", "fr"), "eine fremde Sprache fällt auf de zurück").toBe(
      SOLL_WORT.de?.aktiv,
    );

    stand.p.kanten = zweiAktiveKanten();
    buehne = await montiere();
    expect(buehne.text().toLowerCase()).not.toContain("geprüft");
    expect(buehne.text().toLowerCase()).not.toContain("ungeprüft");
  });

  it("S6 · das Wort folgt der Sprache der Fläche und ist nicht fest verdrahtet", async () => {
    stand.p.kanten = zweiAktiveKanten();
    buehne = await montiere();
    expect(buehne.finde("wb-status")?.textContent).toBe(SOLL_WORT.de?.aktiv);

    await act(async () => {
      await i18n.changeLanguage("en");
      await flush();
    });
    await act(flush);
    expect(
      SOLL_WORT.en?.aktiv,
      "die englische Zeile trägt ein eigenes Wort — sonst prüft der Fall nichts",
    ).not.toBe(SOLL_WORT.de?.aktiv);
    expect(buehne.finde("wb-status")?.textContent, "die Fläche folgt der Sprache").toBe(
      SOLL_WORT.en?.aktiv,
    );

    await act(async () => {
      await i18n.changeLanguage("nl");
      await flush();
    });
    await act(flush);
    expect(buehne.finde("wb-status")?.textContent, "und sie folgt ihr auch nach nl").toBe(
      SOLL_WORT.nl?.aktiv,
    );
  });
});
