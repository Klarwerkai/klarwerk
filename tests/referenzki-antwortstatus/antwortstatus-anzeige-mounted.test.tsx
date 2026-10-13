// @vitest-environment jsdom
// ================================================================================================
// produkt:20261009:referenzki-antwortstatus (REF-04) — ANTWORTSTATUS AN DER ANTWORT, GEMOUNTET.
// ================================================================================================
//
// Die bediente Fassung (echte App, Chromium, Desktop/390, Tastatur) steht in
// `antwortstatus-bedienung-chromium.test.ts`. Hier die Regeln im Einzelnen:
//   A1 (K3/K4/K7) · „Quellen geprüft" NUR bei vollständiger, unabhängiger Bestätigung derselben
//                   Antwortfassung; jeder andere Stand ist ein Entwurf mit Grund
//   A2 (K9)       · Gegenproben am ECHTEN Prüfdienst: sachfremde Quelle, Rechteentzug, Zeitlimit,
//                   Quellenänderung und Modellwechsel ergeben nie „Quellen geprüft"
//   A3 (K2)       · Zustand mit Zeichen UND Wort; „Prüfung läuft" während eines Laufs,
//                   „Prüfung nicht abgeschlossen" nach Fehler
//   A4 (K5)       · Aussage → Fundstelle mit Passage und Begründung → zurück, mit Fokusführung;
//                   „belegt" heißt nicht „garantiert wahr"; Aktualitätshinweise bleiben sichtbar
//   A5 (K8)       · konkreter Grund und sinnvoller nächster Schritt, in allen drei Sprachen
import { afterEach, describe, expect, it } from "vitest";

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { ReferenzPruefung } from "../../apps/web/src/api/types";
import {
  type ReferenzGesamt,
  Referenzpruefung,
  referenzGesamt,
} from "../../apps/web/src/components/fragen/Referenzpruefung";
import i18n from "../../apps/web/src/i18n";
import { type ReferenzPruefErgebnis, referenzSichtFuerFragende } from "../../services/ask";
import type { ReferenzPruefer } from "../../services/reasoner";
import { PRUEF_FAELLE, type PruefFall, belegDes } from "../referenzki-pruefdienst/faelle";
import {
  ANTWORT_ROLLE,
  PRUEF_ROLLE_NEU,
  alle,
  bestand,
  dienstMit,
  doppelgaenger,
  nieFertig,
} from "./hilfen";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FUNDSTELLE = {
  fundstelleId: "fs_a",
  koId: "ko-fiktiv-pumpe",
  koVersion: 2,
  start: 0,
  ende: 40,
};
const PASSAGE = "Die Pumpe P7 fördert mit höchstens 3 bar.";

function ergebnis(over: Partial<ReferenzPruefung> = {}): ReferenzPruefung {
  return {
    richtlinie: "referenzpruefung-v1",
    pruefId: "ref_fiktiv",
    status: "geprueft",
    rollen: { antwort: "cloud", pruefer: "local" },
    aussagen: [
      {
        aussageId: "aus_1",
        zustand: "belegt",
        teile: [
          {
            teilId: "aus_1.t1",
            zustand: "belegt",
            fundstelle: FUNDSTELLE,
            begruendung: "Nennt 3 bar.",
          },
        ],
        fundstellen: [FUNDSTELLE],
        begruendung: "Nennt 3 bar.",
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
    ],
    globaleAktualitaet: "nicht_behauptet",
    ausCache: false,
    messung: { dauerMs: 12, modellaufrufe: 1 },
    versuch: { nummer: 1, hoechstens: 2 },
    bindung: {
      antwortFingerabdruck: "sha256:antwort-1",
      belegFingerabdruck: "sha256:beleg-1",
      paketFingerabdruck: "sha256:paket-1",
      richtlinie: "referenzpruefung-v1",
      ergebnisFingerabdruck: "sha256:ergebnis-1",
    },
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

async function mounten(
  e: ReferenzPruefung,
  zusatz: { laeuft?: boolean; fehler?: boolean; mitErneut?: boolean } = {},
): Promise<HTMLDivElement> {
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
          aussageTexte: new Map([["aus_1", PASSAGE]]),
          titelVon: (id: string) => (id === "ko-fiktiv-pumpe" ? "Pumpe P7 Förderdruck" : undefined),
          wissenHref: (id: string, fassung: number) => `/wissen/${id}?fassung=${fassung}`,
          auszugVon: (id: string) => (id === "fs_a" ? PASSAGE : undefined),
          antwortFingerabdruck: "sha256:antwort-1",
          laeuft: zusatz.laeuft ?? false,
          fehler: zusatz.fehler ?? false,
          ...(zusatz.mitErneut ? { onErneut: () => undefined } : {}),
        }),
      ),
    );
  });
  return container;
}

const q = (c: ParentNode, id: string): HTMLElement | null =>
  c.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const text = (c: ParentNode, id: string): string => q(c, id)?.textContent ?? "";

describe("REF-04 · A1 — die zusammenfassende Kennzeichnung", () => {
  it("A1 · „Quellen geprüft“ nur bei vollständiger, unabhängiger Bestätigung derselben Fassung", () => {
    const gemischt = ergebnis({
      aussagen: [
        ...ergebnis().aussagen,
        {
          aussageId: "aus_2",
          zustand: "teilweise_belegt",
          teile: [],
          fundstellen: [FUNDSTELLE],
          begruendung: "Nur der Druck ist belegt.",
        },
      ],
    });
    const nichtPruefbar = (grund: string, aussagen?: ReferenzPruefung["aussagen"]) =>
      ergebnis({ status: "nicht_pruefbar", grund, ...(aussagen ? { aussagen } : {}) });
    const ohneFundstelle = {
      ...(ergebnis().aussagen[0] as ReferenzPruefung["aussagen"][number]),
      fundstellen: [],
    };
    const eigene = { antwortFingerabdruck: "sha256:antwort-1" };
    const faelle: [ReferenzGesamt, ReturnType<typeof referenzGesamt>][] = [
      ["quellen_geprueft", referenzGesamt(ergebnis(), eigene)],
      ["gemischt", referenzGesamt(gemischt)],
      ["nicht_pruefbar", referenzGesamt(nichtPruefbar("pruefer_nicht_eingerichtet"))],
      ["nicht_abgeschlossen", referenzGesamt(nichtPruefbar("zeitlimit"))],
      ["laeuft", referenzGesamt(ergebnis(), { laeuft: true })],
      ["nicht_abgeschlossen", referenzGesamt(ergebnis(), { fehler: true })],
      ["offen", referenzGesamt(null)],
      ["fremde_fassung", referenzGesamt(ergebnis(), { antwortFingerabdruck: "sha256:andere" })],
      ["keine_aussage", referenzGesamt(nichtPruefbar("keine_aussage", []))],
      // Ein „belegt" ohne Fundstelle ist keine Bestätigung.
      ["gemischt", referenzGesamt(ergebnis({ aussagen: [ohneFundstelle] }))],
    ];
    for (const [erwartet, ist] of faelle) {
      expect(ist).toBe(erwartet);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// A2 — Gegenproben am echten Prüfdienst: was der Server liefert, zeigt die Fläche nie bestätigt.
// ------------------------------------------------------------------------------------------------

function fall(kennung: PruefFall["kennung"]): PruefFall {
  const f = PRUEF_FAELLE.find((x) => x.kennung === kennung);
  if (!f) {
    throw new Error(kennung);
  }
  return f;
}

const sicht = (e: ReferenzPruefErgebnis): ReferenzPruefung =>
  referenzSichtFuerFragende(e) as unknown as ReferenzPruefung;

describe("REF-04 · A2 — Gegenproben ohne falschen Bestätigungsstatus", () => {
  it("A2 · positiv bestätigt; sachfremd, Rechteentzug, Zeitlimit, Quellenänderung und Modellwechsel nie", async () => {
    const p = doppelgaenger(alle("belegt"));
    const wahl = { jetzt: p as { pruefer: ReferenzPruefer } };
    const { dienst } = dienstMit(wahl);
    const pumpe = fall("korrekter_beleg");
    const b = bestand(pumpe.quellen);
    const eingabe = {
      beleg: belegDes(pumpe),
      antwortRolle: ANTWORT_ROLLE,
      akteur: "nutzer-fiktiv-1",
      leser: b.leser,
      darfSehen: () => true,
    };
    const gesamt = (e: ReferenzPruefErgebnis) =>
      referenzGesamt(sicht(e), { antwortFingerabdruck: eingabe.beleg.antwortFingerabdruck });

    // Positivkontrolle.
    const positiv = await dienst.pruefe(eingabe);
    expect(gesamt(positiv)).toBe("quellen_geprueft");

    // Sachfremde Quelle: der Prüfer findet keinen Beleg.
    const kantine = fall("sachfremde_quelle");
    wahl.jetzt = doppelgaenger(alle("nicht_pruefbar", "Die Quelle behandelt ein anderes Thema."));
    const sachfremd = await dienst.pruefe({
      ...eingabe,
      beleg: belegDes(kantine),
      leser: bestand(kantine.quellen).leser,
    });
    expect(gesamt(sachfremd)).not.toBe("quellen_geprueft");

    // Rechteentzug.
    wahl.jetzt = p;
    const entzogen = await dienst.pruefe({ ...eingabe, darfSehen: () => false });
    expect(gesamt(entzogen)).toBe("nicht_pruefbar");

    // Zeitlimit.
    wahl.jetzt = doppelgaenger(nieFertig, PRUEF_ROLLE_NEU);
    const zeitlimit = await dienst.pruefe(eingabe);
    expect(zeitlimit.grund).toBe("zeitlimit");
    expect(gesamt(zeitlimit)).toBe("nicht_abgeschlossen");

    // Quellenänderung: die gespeicherte Bestätigung wird gegen den neuen Stand bestätigt — sie gilt
    // nicht mehr, ohne neuen Modellaufruf.
    wahl.jetzt = p;
    const aufrufe = p.zaehler.aufrufe;
    b.revidiere("ko-fiktiv-pumpe", "Die Pumpe P7 fördert mit höchstens 4 bar.");
    const bestaetigt = await dienst.erneut(
      positiv.pruefId,
      "nutzer-fiktiv-1",
      { leser: b.leser, darfSehen: () => true },
      { nurBestaetigen: true },
    );
    const nachAenderung = "ergebnis" in bestaetigt ? bestaetigt.ergebnis : null;
    expect(nachAenderung?.grund).toBe("bestaetigung_abgelaufen");
    expect(nachAenderung ? gesamt(nachAenderung) : null).toBe("nicht_abgeschlossen");
    expect(p.zaehler.aufrufe).toBe(aufrufe);

    // Modellwechsel: dieselbe Bestätigung mit anderem Prüfmodell gilt ebenfalls nicht.
    const c = bestand(pumpe.quellen);
    const zweit = await dienst.pruefe({ ...eingabe, leser: c.leser });
    expect(gesamt(zweit)).toBe("quellen_geprueft");
    wahl.jetzt = doppelgaenger(alle("belegt"), PRUEF_ROLLE_NEU);
    const gewechselt = await dienst.erneut(
      zweit.pruefId,
      "nutzer-fiktiv-1",
      { leser: c.leser, darfSehen: () => true },
      { nurBestaetigen: true },
    );
    const nachWechsel = "ergebnis" in gewechselt ? gewechselt.ergebnis : null;
    expect(nachWechsel?.grund).toBe("bestaetigung_abgelaufen");
    expect(nachWechsel ? gesamt(nachWechsel) : null).not.toBe("quellen_geprueft");
  });
});

describe("REF-04 · A3 — Zustände nicht nur durch Farbe, laufend und nicht abgeschlossen", () => {
  it("A3 · Zeichen und Wort je Aussage; „Prüfung läuft“ und „nicht abgeschlossen“ sichtbar", async () => {
    const c = await mounten(ergebnis());
    expect(text(c, "referenzpruefung-zustand")).toBe("Belegt");
    expect(text(c, "referenzpruefung-zeichen")).toBe("✓");
    expect(q(c, "referenzpruefung-gesamt")?.getAttribute("data-gesamt")).toBe("quellen_geprueft");
    expect(text(c, "referenzpruefung-gesamt")).toContain("Quellen geprüft");
    expect(text(c, "referenzpruefung-gesamt")).not.toContain("Entwurf");

    const laeuft = await mounten(ergebnis({ status: "nicht_pruefbar", grund: "pruefer_fehler" }), {
      laeuft: true,
      mitErneut: true,
    });
    expect(text(laeuft, "referenzpruefung-gesamt")).toContain("Entwurf · Prüfung läuft");
    expect(q(laeuft, "referenzpruefung")?.getAttribute("aria-busy")).toBe("true");
    expect((q(laeuft, "referenzpruefung-erneut") as HTMLButtonElement | null)?.disabled).toBe(true);

    const fehler = await mounten(ergebnis(), { fehler: true });
    expect(text(fehler, "referenzpruefung-gesamt")).toContain("Prüfung nicht abgeschlossen");
    expect(text(fehler, "referenzpruefung-gesamt")).toContain("keine Quellenfreigabe");
  });
});

describe("REF-04 · A4 — Aussage → Fundstelle → zurück", () => {
  it("A4 · Passage, Fundstelle in ihrer Fassung und Begründung; Rückweg mit Fokus; Aktualität getrennt", async () => {
    const c = await mounten(ergebnis());
    expect(text(c, "referenzpruefung-bedeutung")).toContain("nicht: garantiert wahr");
    expect(text(c, "referenzpruefung-aktualitaet")).toContain("neuere Fassung (3)");
    const knopf = q(c, "referenzpruefung-zur-fundstelle") as HTMLButtonElement;
    expect(knopf.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      knopf.click();
    });
    const detail = q(c, "referenzpruefung-fundstelle-detail");
    expect(detail).not.toBeNull();
    expect(knopf.getAttribute("aria-expanded")).toBe("true");
    expect(knopf.getAttribute("aria-controls")).toBe(detail?.id);
    expect(document.activeElement).toBe(detail);
    expect(text(c, "referenzpruefung-passage")).toBe(PASSAGE);
    expect(text(c, "referenzpruefung-detail-begruendung")).toContain("Nennt 3 bar.");
    const link = detail ? q(detail, "referenzpruefung-fundstelle") : null;
    expect(link?.getAttribute("href")).toBe("/wissen/ko-fiktiv-pumpe?fassung=2");
    // Der Aktualitätshinweis bleibt neben dem geöffneten Bereich sichtbar.
    expect(q(c, "referenzpruefung-aktualitaet")).not.toBeNull();

    await act(async () => {
      (q(c, "referenzpruefung-zurueck") as HTMLButtonElement).click();
    });
    expect(q(c, "referenzpruefung-fundstelle-detail")).toBeNull();
    expect(document.activeElement).toBe(knopf);

    // Escape führt ebenso zurück.
    await act(async () => {
      knopf.click();
    });
    await act(async () => {
      q(c, "referenzpruefung-fundstelle-detail")?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(q(c, "referenzpruefung-fundstelle-detail")).toBeNull();
    expect(document.activeElement).toBe(knopf);
  });
});

describe("REF-04 · A5 — Ursache und nächster Schritt", () => {
  it("A5 · jeder Grund nennt einen nächsten Schritt; „Erneut prüfen“ nur, wo angeboten", async () => {
    const freigabe = await mounten(
      ergebnis({ status: "nicht_pruefbar", grund: "keine_freigabe_externe_verarbeitung" }),
    );
    expect(text(freigabe, "referenzpruefung-status")).toContain(
      "Freigabe für externe Verarbeitung",
    );
    expect(text(freigabe, "referenzpruefung-naechster")).toContain("interne Referenz-KI erlauben");

    const zeit = await mounten(ergebnis({ status: "nicht_pruefbar", grund: "zeitlimit" }), {
      mitErneut: true,
    });
    expect(text(zeit, "referenzpruefung-naechster")).toContain("erneut anstoßen");
    expect(q(zeit, "referenzpruefung-erneut")).not.toBeNull();

    const geprueft = await mounten(ergebnis());
    expect(q(geprueft, "referenzpruefung-naechster")).toBeNull();

    const gruende = [
      "keine_aussage",
      "keine_fundstelle",
      "fundstelle_nicht_aufgeloest",
      "keine_freigabe_externe_verarbeitung",
      "pruefer_nicht_eingerichtet",
      "pruefer_nicht_verfuegbar",
      "pruefer_nicht_freigegeben",
      "pruefer_nicht_unabhaengig",
      "antwortmodell_unbekannt",
      "zeitlimit",
      "abgebrochen",
      "budget_erschoepft",
      "ki_abgeschaltet",
      "ungueltige_pruefausgabe",
      "pruefer_fehler",
      "modellaufruf_ausgeschlossen",
      "bestaetigung_abgelaufen",
      "kein_urteil",
    ];
    const gesamt = [
      "quellen_geprueft",
      "gemischt",
      "nicht_pruefbar",
      "nicht_abgeschlossen",
      "laeuft",
      "offen",
      "fremde_fassung",
      "keine_aussage",
    ];
    for (const lng of ["de", "en", "nl"]) {
      for (const g of gruende) {
        expect(i18n.exists(`referenzpruefung.naechster.${g}`, { lng }), `${lng}:${g}`).toBe(true);
      }
      for (const g of gesamt) {
        expect(i18n.exists(`referenzpruefung.gesamt.${g}`, { lng }), `${lng}:${g}`).toBe(true);
      }
    }
  });
});
