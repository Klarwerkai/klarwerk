// @vitest-environment jsdom
// ================================================================================================
// produkt:20261009:referenzki-pruefdienst (REF-02, Ben nacharbeit-3) — ANZEIGE UND ADMINLISTE, GEMOUNTET.
// ================================================================================================
//
// Die bediente Fassung steht in `referenzpruefung-bedienung-chromium.test.ts` (echte App, Chromium,
// Desktop/390, Tastatur, Rückweg). Hier die Regeln, die dort nicht alle durchlaufen werden:
//   A1 · Aktualitäts-/Konflikthinweise und technische Hinweise stehen GETRENNT von den Aussagen.
//   A2 · „nicht prüfbar" nennt den Grund; ein unbekannter Grund fällt auf einen Satz, nie auf einen
//        Rohschlüssel; je Aussage der Zustand, die Fundstelle mit Fassung und die Begründung.
//   A3 · „Erneut prüfen" nur, solange erlaubt UND sinnvoll — nicht bei dauerhaften Gründen, nicht
//        nach dem letzten Versuch.
//   A4 · Die Adminliste: lesen (nur bekannte Werte, ohne Doppelung), umschalten, nach vorn ziehen.
import { afterEach, describe, expect, it } from "vitest";

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { ReasonerConfigStatus, ReferenzPruefung } from "../../apps/web/src/api/types";
import {
  Referenzpruefung,
  erneutAngeboten,
} from "../../apps/web/src/components/fragen/Referenzpruefung";
import i18n from "../../apps/web/src/i18n";
import {
  referenzAus,
  referenzUmschalten,
  referenzVorziehen,
} from "../../apps/web/src/pages/AdminKiDetails";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FUNDSTELLE = {
  fundstelleId: "fs_a",
  koId: "ko-fiktiv-pumpe",
  koVersion: 2,
  start: 0,
  ende: 40,
};

function ergebnis(over: Partial<ReferenzPruefung> = {}): ReferenzPruefung {
  return {
    richtlinie: "referenzpruefung-v1",
    pruefId: "ref_fiktiv",
    status: "geprueft",
    rollen: { antwort: "deterministic", pruefer: "cloud" },
    aussagen: [
      {
        aussageId: "aus_1",
        zustand: "belegt",
        teile: [
          {
            teilId: "aus_1.t1",
            zustand: "belegt",
            fundstelle: FUNDSTELLE,
            begruendung: "Die Fundstelle nennt 3 bar.",
          },
        ],
        fundstellen: [FUNDSTELLE],
        begruendung: "Die Fundstelle nennt 3 bar.",
      },
    ],
    hinweise: [
      {
        art: "neuere_fassung",
        koId: "ko-fiktiv-pumpe",
        fundstelleId: "fs_a",
        fassung: { gebunden: 2, aktuell: 3, passageUnveraendert: false },
        hinweis: "",
      },
      { art: "anweisungsaehnlicher_text", aussageId: "aus_1", teilId: "aus_1.t1", hinweis: "" },
    ],
    globaleAktualitaet: "nicht_behauptet",
    ausCache: false,
    messung: { dauerMs: 12, modellaufrufe: 1 },
    versuch: { nummer: 1, hoechstens: 2 },
    ...over,
  };
}

const gemountet: { root: ReturnType<typeof createRoot>; container: HTMLDivElement }[] = [];

afterEach(() => {
  for (const { root, container } of gemountet.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

async function mounten(e: ReferenzPruefung, mitErneut = true): Promise<HTMLDivElement> {
  await i18n.changeLanguage("de");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  gemountet.push({ root, container });
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(Referenzpruefung, {
          ergebnis: e,
          aussageTexte: new Map([["aus_1", "Die Pumpe P7 fördert mit höchstens 3 bar."]]),
          titelVon: (id: string) => (id === "ko-fiktiv-pumpe" ? "Pumpe P7 Förderdruck" : undefined),
          wissenHref: (id: string, fassung: number) => `/wissen/${id}?fassung=${fassung}`,
          ...(mitErneut ? { onErneut: () => undefined } : {}),
        }),
      ),
    );
  });
  return container;
}

const text = (c: HTMLElement, id: string): string =>
  c.querySelector(`[data-testid="${id}"]`)?.textContent ?? "";

describe("REF-02 · Anzeige des Prüfergebnisses", () => {
  it("A1 · Aktualität/Konflikte und technische Hinweise stehen getrennt von den Aussagen", async () => {
    const c = await mounten(ergebnis());
    expect(text(c, "referenzpruefung-aktualitaet")).toContain("neuere Fassung (3)");
    expect(text(c, "referenzpruefung-aktualitaet")).toContain("Fassung 2");
    expect(text(c, "referenzpruefung-technisch")).toContain("anweisungsähnlichen Text");
    // Weder Hinweis steht in einer Aussage.
    const aussage = text(c, "referenzpruefung-aussage");
    expect(aussage).not.toContain("neuere Fassung");
    expect(text(c, "referenzpruefung-grenze")).toContain("keine allgemeine Wahrheit");
  });

  it("A2 · je Aussage Zustand, Fundstelle mit Fassung und Begründung; „nicht prüfbar“ mit Grund", async () => {
    const c = await mounten(ergebnis());
    expect(text(c, "referenzpruefung-zustand")).toBe("Belegt");
    const link = c.querySelector<HTMLAnchorElement>('[data-testid="referenzpruefung-fundstelle"]');
    expect(link?.getAttribute("href")).toBe("/wissen/ko-fiktiv-pumpe?fassung=2");
    expect(link?.textContent).toContain("Pumpe P7 Förderdruck");
    expect(text(c, "referenzpruefung-begruendung")).toBe("Die Fundstelle nennt 3 bar.");
    expect(c.textContent).not.toContain("referenzpruefung.");

    const aus = await mounten(
      ergebnis({
        status: "nicht_pruefbar",
        grund: "keine_freigabe_externe_verarbeitung",
        aussagen: [
          {
            aussageId: "aus_1",
            zustand: "nicht_pruefbar",
            grund: "ein_kuenftiger_grund",
            teile: [],
            fundstellen: [],
            begruendung: "Feste Begründung des Servers.",
          },
        ],
        hinweise: [],
      }),
    );
    expect(text(aus, "referenzpruefung-status")).toContain("Nicht prüfbar.");
    expect(text(aus, "referenzpruefung-status")).toContain("Freigabe für externe Verarbeitung");
    expect(aus.querySelector('[data-testid="referenzpruefung-status"]')?.getAttribute("role")).toBe(
      "status",
    );
    expect(aus.textContent).toContain("Der Grund ist nicht bekannt.");
    expect(aus.textContent).not.toContain("ein_kuenftiger_grund");
  });

  it("A3 · „Erneut prüfen“ nur, solange erlaubt und sinnvoll", async () => {
    const ausfall = ergebnis({ status: "nicht_pruefbar", grund: "pruefer_fehler" });
    expect(erneutAngeboten(ausfall)).toBe(true);
    const c = await mounten(ausfall);
    const knopf = c.querySelector<HTMLButtonElement>('[data-testid="referenzpruefung-erneut"]');
    expect(knopf?.tagName).toBe("BUTTON");
    expect(knopf?.disabled).toBe(false);
    expect(erneutAngeboten({ ...ausfall, versuch: { nummer: 2, hoechstens: 2 } })).toBe(false);
    expect(erneutAngeboten({ ...ausfall, grund: "pruefer_nicht_eingerichtet" })).toBe(false);
    expect(erneutAngeboten({ ...ausfall, grund: "modellaufruf_ausgeschlossen" })).toBe(false);
    expect(erneutAngeboten(ergebnis())).toBe(false);
    const ohne = await mounten(ausfall, false);
    expect(ohne.querySelector('[data-testid="referenzpruefung-erneut"]')).toBeNull();
  });
});

describe("REF-02 · Adminliste der Referenz-KIs", () => {
  it("A4 · lesen, umschalten, nach vorn ziehen", () => {
    const konfig = {
      taskConfig: {
        global: "auto",
        perTask: {},
        referenzpruefung: ["anthropic", "unbekannt", "anthropic", "local"],
      },
    } as unknown as ReasonerConfigStatus;
    expect(referenzAus(konfig)).toEqual(["anthropic", "local"]);
    expect(referenzAus(undefined)).toEqual([]);
    expect(referenzUmschalten(["anthropic"], "openai")).toEqual(["anthropic", "openai"]);
    expect(referenzUmschalten(["anthropic", "openai"], "anthropic")).toEqual(["openai"]);
    expect(referenzVorziehen(["anthropic", "openai", "local"], "local")).toEqual([
      "anthropic",
      "local",
      "openai",
    ]);
    expect(referenzVorziehen(["anthropic", "openai"], "anthropic")).toEqual([
      "anthropic",
      "openai",
    ]);
  });
});
