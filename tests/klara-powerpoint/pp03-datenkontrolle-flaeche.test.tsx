// @vitest-environment jsdom
// ================================================================================================
// KLARA POWERPOINT · PP-03 — WAS DER MENSCH IM DETAILBEREICH SIEHT.
// ================================================================================================
//
// Gemountet wird der echte Baustein `components/bibliothek/DatenKontrolle.tsx` mit den Daten, die der
// PP-03-Kern für den kontrollierten Testbestand liefert (Form `Datenkontrolle`). Gelesen wird
// `textContent` und der Barrierebaum (Überschrift, Listen, Namen).
//
//   F1 · Klärungsbedarf: Zustand mit Fassung, Grund, was ihn ändert, je Dimension Stand und Herkunft
//   F2 · mögliche Abweichung: beide Angaben mit ihren Fundstellen nebeneinander
//   F3 · validierter Wert: „Validiert“ ohne offene Arbeit
//   F4 · Datenlage: Zustände gezählt, offene Klärungen mit Arbeit; ein Klick öffnet die Herkunft
//   F5 · Englisch: Beschriftungen übersetzt (die Begründungen des Servers bleiben deutsch, wie PP-02)
//   F6 · Prüfvermerk: Person bzw. Prüfweg und tatsächlicher Prüfzeitpunkt, getrennt von der
//        Kontrollberechnung (Nacharbeit 1)
//   F7 · Prüfvermerk ohne Namen: Kontokennung, übersetzt
//
// GRENZE: Die Einbindung in den PP-02-Detailbereich (`FolienDaten` › `Herkunft`) ist im Basisstand
// nicht möglich, weil PP-02 dort noch nicht geliefert ist. Belegt ist hier der Baustein selbst.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  DatenKontrolle,
  DatenLage,
  type DatenkontrolleSicht,
  type DatenlageSicht,
} from "../../apps/web/src/components/bibliothek/DatenKontrolle";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KLAERUNG: DatenkontrolleSicht = {
  datenpunktId: "dp-summe",
  datenFassung: 2,
  zustand: "klaerung",
  grund:
    "Klärungsbedarf (Berechnung, Konsistenz): Zeilen 2–4 ergeben „Nord“ 500 + „Süd“ 700 + „West“ 600 = 1.800; in der Summe steht „1.900“ (Abweichung 100).",
  naechsteArbeit: [
    "Summe oder Teilwert an der Quelle prüfen und korrigieren; danach wird neu nachgerechnet.",
    "Beide Fundstellen prüfen; den falschen Wert korrigieren oder den Bezugsrahmen (Zeitraum, Definition) präzisieren.",
  ],
  dimensionen: [
    {
      dimension: "erkennung",
      stand: "bestanden",
      grund: "Der Wert steht wörtlich an der Fundstelle der verwendeten Dateifassung.",
      herkunft: "pruefung",
      pruefung: { von: "klarwerk:pptx-leser", am: "2026-10-15T09:00:00.000Z" },
      befunde: [],
    },
    {
      dimension: "berechnung",
      stand: "klaerung",
      grund:
        "Zeilen 2–4 ergeben „Nord“ 500 + „Süd“ 700 + „West“ 600 = 1.800; in der Summe steht „1.900“ (Abweichung 100).",
      herkunft: "kontrolle",
      befunde: [
        {
          id: "berechnung.summe_falsch",
          dimension: "berechnung",
          ergebnis: "klaerung",
          titel: "Falsche Summe",
          grund:
            "Zeilen 2–4 ergeben „Nord“ 500 + „Süd“ 700 + „West“ 600 = 1.800; in der Summe steht „1.900“ (Abweichung 100).",
          regel: "V06 Rechenprüfung (rechne: summe)",
        },
      ],
    },
    {
      dimension: "konsistenz",
      stand: "klaerung",
      grund: "Mögliche Abweichung.",
      herkunft: "kontrolle",
      befunde: [
        {
          id: "konsistenz.widerspruch",
          dimension: "konsistenz",
          ergebnis: "klaerung",
          titel: "Mögliche Abweichung",
          grund:
            "Zum selben Sachverhalt (Umsatz gesamt, Q3 2026, T€) steht hier „1.900“, dort „1.500“. Klara entscheidet nicht, welcher Wert richtig ist.",
          regel: "PP-03 Konsistenz",
          hier: "Folie 2 „Umsatz je Region“, Tabelle „Tabelle 3“, Zeile 5 („Summe“)",
          gegenstellen: [
            {
              datenpunktId: "dp-bild",
              wert: "1.500",
              fundstelle: "Folie 3 „Screenshot“, Bild „Bild 6“ (OCR)",
            },
          ],
        },
      ],
    },
    {
      dimension: "fachliche_freigabe",
      stand: "offen",
      grund: "Keine fachliche Freigabe für diese Datenfassung.",
      herkunft: "keine",
      befunde: [],
    },
  ],
  prognose: false,
  gepruefAm: "2026-10-16T10:00:00.000Z",
};

const VALIDIERT: DatenkontrolleSicht = {
  ...KLAERUNG,
  zustand: "validiert",
  grund: "Validiert für Datenfassung 2 im Prüfrahmen Erkennung, Struktur, Berechnung.",
  naechsteArbeit: [],
  dimensionen: [],
};

const LAGE: DatenlageSicht = {
  anzahl: 3,
  jeZustand: { erfasst: 0, in_pruefung: 1, klaerung: 1, validiert: 1, ueberpruefung_noetig: 0 },
  offenePunkte: [
    {
      datenpunktId: "dp-ohne",
      zustand: "klaerung",
      dimension: "struktur",
      stand: "klaerung",
      titel: "Bezugszeitraum fehlt",
      grund: "Für „1.800“ fehlt der Bezugszeitraum.",
      naechsteArbeit: "Bezugszeitraum ergänzen (Korrektur am Datenpunkt).",
    },
    {
      datenpunktId: "dp-summe",
      zustand: "in_pruefung",
      dimension: "fachliche_freigabe",
      stand: "offen",
      titel: "Fachliche Freigabe offen",
      grund: "Keine fachliche Freigabe für diese Datenfassung.",
      naechsteArbeit: "Fachliche Freigabe prüfen.",
    },
  ],
};

/** Dieselbe Klärung, mit einer menschlichen Prüfung der Konsistenz (Name aus der PP-02-Sicht). */
const MIT_PERSON: DatenkontrolleSicht = {
  ...KLAERUNG,
  dimensionen: [
    ...KLAERUNG.dimensionen,
    {
      dimension: "struktur",
      stand: "bestanden",
      grund: "Geprüft.",
      herkunft: "pruefung",
      pruefung: {
        von: "u-7",
        name: "Erika Prüfer",
        am: "2026-10-14T08:30:00.000Z",
        datenFassung: 2,
      },
      befunde: [],
    },
  ],
};

const lokal = (iso: string, sprache: string) => new Date(iso).toLocaleString(sprache);

let aufraeumen: (() => void) | null = null;

afterEach(() => {
  aufraeumen?.();
  aufraeumen = null;
});

async function montieren(
  element: ReturnType<typeof createElement>,
  sprache = "de",
): Promise<HTMLElement> {
  await i18n.changeLanguage(sprache);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  aufraeumen = () => {
    act(() => root.unmount());
    container.remove();
  };
  return container;
}

describe("PP-03 · Prüfstand und Kontrollen im Detailbereich", () => {
  it("F1 · Klärungsbedarf: Zustand, Grund, Arbeit, Stand und Herkunft je Dimension", async () => {
    const c = await montieren(createElement(DatenKontrolle, { kontrolle: KLAERUNG }));
    const flaeche = c.querySelector("[data-datenkontrolle='dp-summe']");
    const titelId = flaeche?.getAttribute("aria-labelledby") ?? "";
    expect(c.querySelector(`[id="${titelId}"]`)?.textContent).toBe("Prüfstand und Kontrollen");
    expect(c.querySelector("[data-zustand]")?.textContent).toBe("Klärungsbedarf · Datenfassung 2");
    expect(c.textContent).toContain("in der Summe steht „1.900“ (Abweichung 100)");
    expect(c.querySelector("[data-naechste-arbeit]")?.textContent).toContain(
      "Was den Zustand ändert",
    );
    expect(c.querySelector("[data-naechste-arbeit]")?.textContent).toContain(
      "Summe oder Teilwert an der Quelle prüfen und korrigieren",
    );
    const liste = c.querySelector("ul[aria-label='Prüfungen je Dimension']");
    expect(liste).not.toBeNull();
    expect(c.querySelector("[data-dimension='berechnung']")?.textContent).toContain(
      "Berechnung: Klärungsbedarf · von Klarwerk kontrolliert",
    );
    expect(c.querySelector("[data-dimension='erkennung']")?.textContent).toContain(
      "Erkennung: bestanden · geprüft",
    );
    expect(c.querySelector("[data-dimension='fachliche_freigabe']")?.textContent).toContain(
      "Fachliche Freigabe: offen",
    );
    const befund = c.querySelector("[data-befund='berechnung.summe_falsch']");
    expect(befund?.textContent).toContain("Klärung: Falsche Summe");
    expect(befund?.textContent).toContain("Grundlage: V06 Rechenprüfung");
  });

  it("F2 · mögliche Abweichung: beide Angaben mit ihren Fundstellen", async () => {
    const c = await montieren(createElement(DatenKontrolle, { kontrolle: KLAERUNG }));
    const gegen = c.querySelector(
      "[data-befund='konsistenz.widerspruch'] [data-gegenueberstellung]",
    );
    expect(gegen?.textContent).toContain(
      "HierFolie 2 „Umsatz je Region“, Tabelle „Tabelle 3“, Zeile 5 („Summe“)",
    );
    expect(gegen?.querySelector("[data-gegenstelle='dp-bild']")?.textContent).toBe(
      "Dort„1.500“ — Folie 3 „Screenshot“, Bild „Bild 6“ (OCR)",
    );
  });

  it("F3 · ein passend geprüfter Wert wird als gültig angezeigt, ohne offene Arbeit", async () => {
    const c = await montieren(createElement(DatenKontrolle, { kontrolle: VALIDIERT }));
    expect(c.querySelector("[data-zustand='validiert']")?.textContent).toBe(
      "Validiert · Datenfassung 2",
    );
    expect(c.querySelector("[data-naechste-arbeit]")).toBeNull();
  });

  it("F4 · Datenlage: Zustände und offene Klärungen; ein Klick öffnet die Herkunft", async () => {
    const geoeffnet: string[] = [];
    const c = await montieren(
      createElement(DatenLage, { lage: LAGE, oeffne: (id: string) => geoeffnet.push(id) }),
    );
    expect(c.querySelector("[data-datenlage] h6")?.textContent).toBe("Datenlage · 3 Datenpunkte");
    expect(c.querySelector("[data-lage-zustand='klaerung']")?.textContent).toBe(
      "Klärungsbedarf: 1",
    );
    expect(c.querySelector("[data-lage-zustand='erfasst']")).toBeNull();
    const punkt = c.querySelector("[data-offener-punkt='dp-ohne']");
    expect(punkt?.querySelector("[data-aufgabe]")?.textContent).toBe(
      "Bezugszeitraum fehlt — Bezugszeitraum ergänzen (Korrektur am Datenpunkt).",
    );
    expect(punkt?.textContent).toContain(
      "Struktur: Klärungsbedarf · Für „1.800“ fehlt der Bezugszeitraum.",
    );
    // Nacharbeit 1 (Ben): auch eine offene erforderliche Prüfung steht in der Datenlage.
    const offen = c.querySelector(
      "[data-offener-punkt='dp-summe'][data-dimension='fachliche_freigabe']",
    );
    expect(offen?.getAttribute("data-stand")).toBe("offen");
    expect(offen?.textContent).toContain("Fachliche Freigabe offen — Fachliche Freigabe prüfen.");
    expect(c.querySelector("[data-datenlage]")?.textContent).toContain(
      "Offene Prüfungen und Klärungen",
    );
    await act(async () => {
      punkt?.querySelector("button")?.click();
      offen?.querySelector("button")?.click();
    });
    expect(geoeffnet).toEqual(["dp-ohne", "dp-summe"]);
  });

  // Nacharbeit 1 (Ben): wer bzw. welcher Weg wann geprüft hat — getrennt von der Kontrollberechnung.
  it("F6 · Prüfvermerk: Person bzw. Prüfweg und tatsächlicher Prüfzeitpunkt", async () => {
    const c = await montieren(createElement(DatenKontrolle, { kontrolle: MIT_PERSON }));
    const person = c.querySelector("[data-dimension='struktur'] [data-pruefvermerk]");
    expect(person?.textContent).toBe(
      `Geprüft von Erika Prüfer am ${lokal("2026-10-14T08:30:00.000Z", "de")} (Datenfassung 2)`,
    );
    expect(person?.querySelector("time")?.getAttribute("datetime")).toBe(
      "2026-10-14T08:30:00.000Z",
    );
    const weg = c.querySelector("[data-dimension='erkennung'] [data-pruefvermerk]");
    expect(weg?.textContent).toBe(
      `Maschinell geprüft über pptx-leser am ${lokal("2026-10-15T09:00:00.000Z", "de")}`,
    );
    // Der Zeitpunkt der Kontrollberechnung steht davon getrennt und anders beschriftet.
    expect(c.textContent).toContain(
      `Kontrollen von Klarwerk berechnet am ${lokal("2026-10-16T10:00:00.000Z", "de")}`,
    );
    // Ohne Prüfung kein Vermerk.
    const ohne = c.querySelector("[data-dimension='fachliche_freigabe'] [data-pruefvermerk]");
    expect(ohne).toBeNull();
  });

  it("F7 · Prüfvermerk ohne Namen nennt die Kontokennung, auf Englisch übersetzt", async () => {
    const ohneName: DatenkontrolleSicht = {
      ...KLAERUNG,
      dimensionen: [
        {
          dimension: "konsistenz",
          stand: "bestanden",
          grund: "Geprüft.",
          herkunft: "pruefung",
          pruefung: { von: "u-7", am: "2026-10-14T08:30:00.000Z" },
          befunde: [],
        },
      ],
    };
    const c = await montieren(createElement(DatenKontrolle, { kontrolle: ohneName }), "en");
    expect(c.querySelector("[data-pruefvermerk]")?.textContent).toBe(
      `Checked by u-7 on ${lokal("2026-10-14T08:30:00.000Z", "en")}`,
    );
    await i18n.changeLanguage("de");
  });

  it("F5 · Englisch: die Beschriftungen sind übersetzt", async () => {
    const c = await montieren(createElement(DatenKontrolle, { kontrolle: KLAERUNG }), "en");
    expect(c.querySelector("[data-zustand]")?.textContent).toBe(
      "Needs clarification · Data version 2",
    );
    expect(c.querySelector("[data-dimension='berechnung']")?.textContent).toContain(
      "Calculation: needs clarification · controlled by Klarwerk",
    );
    await i18n.changeLanguage("de");
  });
});
