// ================================================================================================
// ADMIN-11 · WISSENSKENNZAHLEN — Anzeigeentscheid, Adresse, Export und Wortwahl, DOM-frei.
// ================================================================================================
//
// produkt:20261009:admin-wissenskennzahlen.
//   A1  Null, unbekannt, unvollständig, nicht erhoben und „nicht berechenbar“ sind fünf sichtbar
//       verschiedene Zustände; eine 0 steht nur, wo gemessen wurde (K1).
//   A2  Trend nur aus einem belegten Vergleich; Quoten in Prozentpunkten (K3).
//   A3  Die Auswahl lebt in der Adresse und übersteht Rückweg und Neuladen (K3).
//   A4  Der Export trägt denselben Stand, denselben Zeitraum und dieselbe Auswahl wie die Ansicht —
//       und nur Zahlen (K5, K6).
//   A5  Kein Text nennt Antwortquote, Aufrufe oder Aktivität eine gemessene Zeit- oder
//       Geldersparnis; wo das Wort vorkommt, wird es verneint (K6).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Kennzahl, Wissenskennzahlen } from "../../apps/web/src/api/wissenskennzahlen";
import i18n from "../../apps/web/src/i18n";
import {
  OHNE_WERT,
  anzeigeVon,
  auswahlAusAdresse,
  auswahlInAdresse,
  csvFeld,
  exportDateiname,
  kennzahlenCsv,
  trendText,
} from "../../apps/web/src/lib/wissenskennzahlen";
import texte from "../../apps/web/src/texte/wissenskennzahlen";
import { repoPfad } from "../support/repoPfad";

const de = i18n.getFixedT("de");

function kennzahl(teil: Partial<Kennzahl>): Kennzahl {
  return {
    schluessel: "fragen",
    art: "zeitraum",
    einheit: "anzahl",
    wert: 0,
    zaehler: null,
    nenner: null,
    lage: "gemessen",
    erhobenSeit: "2026-09-20T08:00:00.000Z",
    trend: null,
    trendGrund: "vorperiode_unvollstaendig",
    arbeitsliste: null,
    ...teil,
  };
}

const ANTWORT: Wissenskennzahlen = {
  stand: "2026-10-09T12:00:00.000Z",
  anfrage: { tage: 7, space: "space-a", team: null },
  zeitraum: { von: "2026-10-02T12:00:00.000Z", bis: "2026-10-09T12:00:00.000Z" },
  vorperiode: { von: "2026-09-25T12:00:00.000Z", bis: "2026-10-02T12:00:00.000Z" },
  handlungsbedarf: [
    kennzahl({
      schluessel: "pruefung",
      art: "momentaufnahme",
      wert: 1,
      erhobenSeit: null,
      trendGrund: "momentaufnahme",
      arbeitsliste: "/qualitaetsaufgaben?typ=pruefung&space=space-a",
      eintraege: [
        {
          schluessel: "pruefung:ko-1",
          typ: "pruefung",
          zustand: "offen",
          titel: "Fiktiv: Geheimer Titel Q-9",
          arbeitsweg: "/wissen/ko-1",
          spaces: ["space-a"],
          seit: null,
          ueberfaellig: false,
        },
      ],
    }),
    kennzahl({
      schluessel: "luecke",
      art: "momentaufnahme",
      wert: null,
      lage: "nicht_erhoben",
      erhobenSeit: null,
      trendGrund: "nicht_erhoben",
    }),
  ],
  nutzung: [
    kennzahl({
      schluessel: "antwortquote",
      einheit: "prozent",
      wert: null,
      lage: "nicht_erhoben",
      erhobenSeit: null,
      trendGrund: "nicht_erhoben",
    }),
  ],
  bedarf: { lage: "nicht_erhoben", offen: null, ohneZaehlung: null, eintraege: [] },
  suche: { lage: "nicht_erhoben" },
  filterwerte: {
    spaces: [{ id: "space-a", name: "Fiktiv Montage" }],
    teams: [],
  },
  quellen: { vorgaenge: "ok", fragen: "ok", luecken: "ok" },
};

describe("ADMIN-11 · A1 · Null, unbekannt und unvollständig bleiben unterscheidbar", () => {
  it("fünf Lagen, fünf Anzeigen — eine 0 nur bei gemessenem Wert", () => {
    const faelle: [Partial<Kennzahl>, string, string][] = [
      [{ wert: 0, lage: "gemessen" }, "zahl", "0"],
      [{ wert: 4, lage: "unvollstaendig" }, "unvollstaendig", "4"],
      [{ wert: null, lage: "unbekannt" }, "unbekannt", OHNE_WERT],
      [{ wert: null, lage: "nicht_erhoben" }, "nicht_erhoben", OHNE_WERT],
      [{ wert: null, lage: "gemessen", einheit: "prozent" }, "nicht_berechenbar", OHNE_WERT],
    ];
    const etiketten = new Set<string>();
    for (const [teil, art, text] of faelle) {
      const a = anzeigeVon(kennzahl(teil), "de");
      expect(a).toEqual({ art, text });
      etiketten.add(de(`wkz.anzeige.${a.art}`));
    }
    // Jede Lage hat ihr eigenes Etikett — keine zwei sehen gleich aus.
    expect(etiketten.size).toBe(faelle.length);
    // Ein Wert, den die Quelle nicht belegt, wird nie als Zahl gezeigt — auch nicht, wenn er da ist.
    expect(anzeigeVon(kennzahl({ wert: 7, lage: "unbekannt" }), "de").text).toBe(OHNE_WERT);
    expect(anzeigeVon(kennzahl({ wert: 75, einheit: "prozent" }), "de").text).toBe("75 %");
  });
});

describe("ADMIN-11 · A2 · Trend nur aus belegtem Vergleich", () => {
  it("Vorzeichen, Prozentpunkte, kein Trend ohne Vergleich", () => {
    expect(trendText(kennzahl({ trend: { vorher: 2, differenz: 2 } }), de, "de")).toBe("+2");
    expect(trendText(kennzahl({ trend: { vorher: 5, differenz: -3 } }), de, "de")).toBe("−3");
    expect(trendText(kennzahl({ trend: { vorher: 5, differenz: 0 } }), de, "de")).toBe("±0");
    expect(
      trendText(kennzahl({ einheit: "prozent", trend: { vorher: 50, differenz: 25 } }), de, "de"),
    ).toBe(de("wkz.trend.prozentpunkte", { zahl: "+25" }));
    expect(trendText(kennzahl({ trend: null }), de, "de")).toBeNull();
  });
});

describe("ADMIN-11 · A3 · die Auswahl steht in der Adresse", () => {
  it("lesen, setzen, entfernen — fremde Parameter bleiben", () => {
    const p = new URLSearchParams("tage=90&space=space-a&fremd=1");
    expect(auswahlAusAdresse(p)).toEqual({ tage: 90, space: "space-a", team: null });
    expect(auswahlAusAdresse(new URLSearchParams("tage=12")).tage).toBe(30);
    const mitTeam = auswahlInAdresse(p, "team", "team-1");
    expect(mitTeam.get("team")).toBe("team-1");
    expect(mitTeam.get("fremd")).toBe("1");
    const ohneSpace = auswahlInAdresse(mitTeam, "space", null);
    expect(ohneSpace.has("space")).toBe(false);
    // Unverändert: das Original wird nicht angefasst.
    expect(p.has("team")).toBe(false);
  });
});

describe("ADMIN-11 · A4 · der Export ist die gezeigte Antwort", () => {
  it("Stand, Zeitraum, Auswahl und Lage wie in der Ansicht — keine Titel, kein Fragetext", () => {
    const csv = kennzahlenCsv(ANTWORT, de, "de");
    const zeilen = csv.trimEnd().split("\r\n");
    expect(zeilen[0]).toBe(`${de("wkz.export.stand")};2026-10-09T12:00:00.000Z`);
    expect(zeilen[1]).toBe(
      `${de("wkz.export.zeitraum")};2026-10-02T12:00:00.000Z – 2026-10-09T12:00:00.000Z`,
    );
    expect(zeilen[2]).toBe(`${de("wkz.export.tage")};7`);
    expect(zeilen[3]).toBe(`${de("wkz.filter.space")};Fiktiv Montage`);
    expect(zeilen[4]).toBe(`${de("wkz.filter.team")};${de("wkz.filter.alle")}`);
    // Jede Kennzahl genau einmal, mit derselben Lage wie auf dem Bildschirm.
    const pruefung = zeilen.find((z) => z.includes(de("wkz.k.pruefung.titel")));
    expect(pruefung?.split(";")[2]).toBe("1");
    expect(pruefung?.split(";")[3]).toBe(de("wkz.anzeige.zahl"));
    const luecke = zeilen.find((z) => z.includes(de("wkz.k.luecke.titel")));
    expect(luecke?.split(";")[2]).toBe(OHNE_WERT);
    expect(luecke?.split(";")[3]).toBe(de("wkz.anzeige.nicht_erhoben"));
    // Datensparsam: Detailtitel stehen in der Ansicht, nicht im Export.
    expect(csv).not.toContain("Geheimer Titel");
    expect(exportDateiname(ANTWORT)).toBe("wissenskennzahlen_2026-10-09_7t_space-space-a.csv");
  });

  it("CSV-Felder: Trenner und Anführungszeichen maskiert, Formelanfang entschärft", () => {
    expect(csvFeld("a;b")).toBe('"a;b"');
    expect(csvFeld('sag "x"')).toBe('"sag ""x"""');
    expect(csvFeld("=SUMME(A1)")).toBe("'=SUMME(A1)");
    expect(csvFeld("−3")).toBe("−3");
  });
});

describe("ADMIN-11 · A6 · /analytics ordnet: Handlungsbedarf zuerst, Rechnung zugeklappt", () => {
  const quelle = readFileSync(repoPfad("apps/web/src/pages/Analytics.tsx"), "utf8");
  const stelle = (text: string): number => {
    const i = quelle.indexOf(text);
    expect(i, `„${text}“ fehlt in Analytics.tsx`).toBeGreaterThanOrEqual(0);
    return i;
  };

  it("Kennzahlen vor Qualitätswert vor Bestandszahlen vor Protokoll", () => {
    const kennzahlen = stelle("<Wissenskennzahlen />");
    const wert = stelle('t("fachwort.gesundheit.titel")');
    const bestand = stelle('t("wkz.bestand.titel")');
    const protokoll = stelle("id={ANALYTICS_AUDIT_ANCHOR}");
    expect(kennzahlen).toBeLessThan(wert);
    expect(wert).toBeLessThan(bestand);
    expect(bestand).toBeLessThan(protokoll);
  });

  it("die Unsicherheitskennzeichnung bleibt sichtbar; Faktoren und Gründe liegen im Detail", () => {
    const kennzeichnung = stelle('data-testid="health-conflict-unproven"');
    const titel = stelle('t("health.conflictUnproven.title"');
    const details = stelle('<details data-testid="health-berechnung"');
    const grund = stelle("t(`health.conflictUnproven.${health.conflictFactor.reason}`)");
    const faktoren = stelle("health.factors.map(");
    expect(kennzeichnung).toBeLessThan(details);
    expect(titel).toBeLessThan(details);
    expect(stelle('data-testid="health-band-unproven"')).toBeLessThan(details);
    expect(grund).toBeGreaterThan(details);
    expect(faktoren).toBeGreaterThan(details);
  });

  it("kein rückwirkender Wochenverlauf mehr", () => {
    expect(quelle).not.toContain("weeklyValidated(");
    expect(quelle).not.toContain('t("ana.weekly")');
  });
});

describe("ADMIN-11 · A5 · keine gemessene Zeit- oder Geldersparnis", () => {
  const ERSPARNIS = /erspar|gespart|zeitgewinn|saving|saved|time saved|besparing|bespaard/i;
  const VERNEINT = /\b(kein\w*|nicht|nichts|not|no|nothing|geen|niet|niets)\b/i;

  it("jede Fundstelle in allen drei Sprachen ist eine Verneinung", () => {
    let funde = 0;
    for (const sprache of ["de", "en", "nl"] as const) {
      for (const [schluessel, text] of Object.entries(texte[sprache])) {
        if (ERSPARNIS.test(text)) {
          funde += 1;
          expect(text, `${sprache} ${schluessel}`).toMatch(VERNEINT);
        }
      }
    }
    // Kalibrierung: die ausdrückliche Abgrenzung steht wirklich da (sonst prüfte der Fall nichts).
    expect(funde).toBeGreaterThanOrEqual(3);
  });

  it("die Erklärungen von Antwortquote und Nutzung grenzen sich ausdrücklich ab", () => {
    for (const sprache of ["de", "en", "nl"] as const) {
      const t = i18n.getFixedT(sprache);
      expect(t("wkz.nutzung.erklaerung")).toMatch(VERNEINT);
      expect(t("wkz.k.antwortquote.bedeutung")).toMatch(VERNEINT);
      expect(t("wkz.bestand.fragenHilfe")).toMatch(VERNEINT);
    }
  });
});
