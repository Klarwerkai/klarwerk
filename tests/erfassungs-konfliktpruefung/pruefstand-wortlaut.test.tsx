// @vitest-environment jsdom
// ================================================================================================
// P-M3b · BEN-3 (Runde 2) — EIN PRÜFSTAND-WORTLAUT FÜR BEIDE TREFFERLISTEN.
// ================================================================================================
//
// Maßgeblich ist Pedis Entscheidung vom 05.09.2026 zu M3 „Haben wir das schon?“: der Treffer nennt
// seinen Prüfstand „noch nicht geprüft“ bzw. „Validiert“. Das Word-Panel zeigt das seit JOB 3093;
// die Live-Zone im Web sagte für denselben Zustand „Offen“. Die ältere Quelle R-0240 („zu prüfen“)
// ist damit abgelöst.
//
// Beide Flächen werden hier gegen DIESELBE Tabelle gemessen, jede an ihrem ausgelieferten Weg:
//   · Web: `LiveReactionZone` gemountet, sichtbare Fundortzeile.
//   · Word: das ausgelieferte Aufgabenfenster (`createKlaraPanel`), „Haben wir das schon?“ geklickt,
//     sichtbare `#bestand-liste`.
// Die beiden Verträge bleiben getrennt (R-0718): Web liest `koStatus` von `/api/knowledge/check`,
// Word `pruefstand` von `/api/check-text`. Gleich ist nur das Wort, das der Mensch liest.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { KoStatus } from "../../apps/web/src/api/types";
import { LiveReactionZone } from "../../apps/web/src/components/capture/intake/LiveReactionZone";
import i18n from "../../apps/web/src/i18n";
import { type KlaraPanel, createKlaraPanel, reply } from "../app/klara-panel-fixture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Sprache = "de" | "en" | "nl";

/** Der vereinbarte Wortlaut — EINE Tabelle für beide Flächen. */
const WORTLAUT: Record<Sprache, Record<KoStatus, string>> = {
  de: { offen: "noch nicht geprüft", validiert: "Validiert" },
  en: { offen: "not yet reviewed", validiert: "Validated" },
  nl: { offen: "nog niet beoordeeld", validiert: "Gevalideerd" },
};

/** Was die Web-Fläche früher für „offen“ sagte — darf in keiner Sprache mehr stehen. */
const ALTES_WORT: Record<Sprache, string> = { de: "Offen", en: "Open", nl: "Open" };

/** Der Draht des Word-Panels: `pruefstand` statt `koStatus` (check-text-routes.ts, JOB 3093). */
const PRUEFSTAND_VON: Record<KoStatus, string> = { offen: "eingereicht", validiert: "validiert" };

const SPRACHEN: Sprache[] = ["de", "en", "nl"];
const ZUSTAENDE: KoStatus[] = ["offen", "validiert"];

describe("P-M3b · Web: die Live-Zone nennt den Prüfstand mit dem vereinbarten Wort", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    await i18n.changeLanguage("de");
  });

  for (const lng of SPRACHEN) {
    for (const zustand of ZUSTAENDE) {
      it(`W · ${lng} · ${zustand} → „${WORTLAUT[lng][zustand]}“`, async () => {
        await act(async () => {
          await i18n.changeLanguage(lng);
        });
        await act(async () => {
          root.render(
            createElement(
              MemoryRouter,
              null,
              createElement(LiveReactionZone, {
                verdict: {
                  status: "similar",
                  match: {
                    koId: "ko-1",
                    title: "Presse P2 sichern",
                    score: 0.8,
                    koStatus: zustand,
                    koCategory: null,
                  },
                },
              }),
            ),
          );
        });
        const zeile = container.querySelector('[data-testid="live-fundort"]');
        expect(zeile, "Fundortzeile fehlt").not.toBeNull();
        expect(zeile?.textContent).toBe(WORTLAUT[lng][zustand]);
        expect(container.textContent).not.toContain(ALTES_WORT[lng]);
      });
    }
  }
});

const ABSATZ =
  "Vor jeder Wartung an der Presse P2 ist der Hauptschalter abzuschließen und der Druck im " +
  "Hydrauliksystem vollständig abzubauen. Erst danach darf die Schutzhaube geöffnet werden.";

function trefferAntwort(zustand: KoStatus) {
  return {
    duplicates: [
      {
        koId: "ko-1",
        koTitle: "Presse P2 sichern",
        relation: "identisch",
        confidence: null,
        method: "deterministic",
        rationale: null,
        koStatus: zustand,
        koCategory: "Instandhaltung",
        pruefstand: PRUEFSTAND_VON[zustand],
        version: 3,
        fundort: {
          kategorie: "Instandhaltung",
          bereich: "Instandhaltung",
          bibliothekPfad: "/wissen/ko-1",
        },
      },
    ],
    conflicts: [],
    answer: null,
    note: null,
    persisted: false,
  };
}

describe("P-M3b · Word: das ausgelieferte Panel nennt denselben Prüfstand", () => {
  let panel: KlaraPanel | null = null;

  afterEach(() => {
    panel?.restore();
    panel = null;
  });

  for (const lng of SPRACHEN) {
    for (const zustand of ZUSTAENDE) {
      it(`P · ${lng} · ${zustand} → „${WORTLAUT[lng][zustand]}“`, async () => {
        panel = createKlaraPanel({
          selectionText: ABSATZ,
          routes: { "/api/check-text": reply(200, trefferAntwort(zustand)) },
        });
        await panel.flush();
        panel.setLang(lng);
        await panel.flush();
        const knopf = panel.q("#bestand-btn");
        expect(knopf, "der Knopf „Haben wir das schon?“ fehlt").not.toBeNull();
        (knopf as { click(): void }).click();
        await panel.flush();
        const liste = panel.text("#bestand-liste");
        expect(liste).toContain("Presse P2 sichern");
        expect(liste).toContain(WORTLAUT[lng][zustand]);
      });
    }
  }
});
