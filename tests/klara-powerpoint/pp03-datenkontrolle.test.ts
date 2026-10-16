// ================================================================================================
// KLARA POWERPOINT · PP-03 — VALIDIERUNG UND DATENKONTROLLE (Originalabnahme).
// ================================================================================================
//
// Auftrag `produkt:20261015:klara-powerpoint-validierung`. Geprüft wird der PP-03-Kern
// `services/app/src/praesentation-pruefung.ts` mit einem kontrollierten Testbestand, dessen Werte,
// Quellen und erwartete Ergebnisse bekannt sind (Paket Abschnitt 9):
//
//   A · fehlender Bezugszeitraum            → konkreter Klärungsbedarf (Struktur)
//   B · falsche Summe in der Folientabelle  → konkreter Klärungsbedarf mit Rechnung (V06)
//   C · unsichere OCR                       → Klärungsbedarf, bis ein Mensch am Bild bestätigt
//   D · veraltete Quellfassung / Quelle     → Überprüfung nötig bzw. Klärung (V02, V03)
//   E · passend geprüfter Wert              → validiert; ohne fachliche Freigabe nicht
//   F · Änderungen                          → alter Status aufgehoben, nachvollziehbar
//   G · Widerspruch kontextgerecht          → echte Abweichung mit beiden Fundstellen; anderer
//                                             Zeitraum, andere Einheit, unsichere OCR: kein Widerspruch
//   H · Rechte                              → ohne Leserecht an der Quelle keine Quellauskunft
//   I · Herkunft                            → berechneter Wert mit unvalidierter Eingabe nicht validiert
//
// GRENZE: Der Prüfstand aus PP-02 (`pruefstand`) ist im Basisstand dieses Auftrags noch nicht
// enthalten (PP-02 ist nicht geliefert). Er kommt hier in genau der Form herein, die der PP-02-Vertrag
// liefert (`stand02` unten); die Folientabelle in der Form von PP-02 `leseFolienDaten`. Die Frische
// der Quelle (V03) und die Rechnung (V06) sind die echten vorhandenen Klarwerk-Wege.
import { describe, expect, it } from "vitest";
import {
  DIMENSIONEN,
  type Datenkontrolle,
  type Dimension,
  type DimensionsEingang,
  type KontrollDatenpunkt,
  type KontrollFolien,
  type KontrollUmgebung,
  type PruefstandEingang,
  datenkontrolle,
  datenlage,
  eineZahl,
} from "../../services/app/src/praesentation-pruefung";
import type { KnowledgeObject } from "../../services/knowledge-object";

const JETZT = Date.parse("2026-10-16T10:00:00.000Z");
const TAG = 24 * 60 * 60 * 1000;

/** Ein Quellartikel mit genau den Feldern, die Fassung (V02), Frische (V03) und Status (V01) lesen. */
function artikel(teil: { readonly id: string } & Record<string, unknown>): KnowledgeObject {
  return {
    title: "Vertriebszahlen Q3",
    version: 4,
    status: "offen",
    type: "technik",
    category: "Vertrieb",
    author: "autorin",
    createdAt: new Date(JETZT - 10 * TAG).toISOString(),
    history: [],
    attachments: [{ id: "anh-1", name: "Quartal.pptx", objectId: "obj-2" }],
    ...teil,
  } as unknown as KnowledgeObject;
}

/** Die Folientabelle „Umsatz je Region“ in der Form von PP-02 `leseFolienDaten`. */
function tabelle(summe: string, objectId = "obj-2", nord = "500"): KontrollFolien {
  const zeilen = [
    ["Region", "Umsatz Q3 2026"],
    ["Nord", nord],
    ["Süd", "700"],
    ["West", "600"],
    ["Summe", summe],
  ];
  return {
    objectId,
    satz: {
      folien: [
        {
          sldId: "256",
          elemente: [
            {
              shapeId: "4",
              zellen: zeilen.flatMap((z, i) =>
                z.map((text, j) => ({ zeile: i + 1, spalte: j + 1, text })),
              ),
            },
          ],
        },
      ],
    },
  };
}

function zelle(zeile: number, zeilenkopf: string, wert: string) {
  return {
    art: "tabellenzelle",
    sldId: "256",
    shapeId: "4",
    folienPosition: 2,
    folienTitel: "Umsatz je Region",
    elementName: "Tabelle 3",
    zeile,
    spalte: 2,
    zeilenkopf,
    spaltenkopf: "Umsatz Q3 2026",
    zitat: wert,
  };
}

/** Ein direkt übernommener Wert aus der Summenzeile — vollständig beschrieben. */
function summenwert(teil: Partial<KontrollDatenpunkt> = {}): KontrollDatenpunkt {
  return {
    id: "dp-summe",
    heimatKoId: "ko-1",
    fassung: 2,
    art: "zahl",
    wert: "1.800",
    zahl: 1800,
    waehrung: "T€",
    zeitraum: "Q3 2026",
    bezugsgroesse: "Umsatz gesamt",
    erfassung: "direkt",
    quelle: { koId: "ko-1", koFassung: 4, anhangId: "anh-1", objectId: "obj-2" },
    fundstelle: zelle(5, "Summe", "1.800"),
    ...teil,
  };
}

/** Derselbe Datenpunkt ohne eine Angabe (wie nach einer Korrektur „Angabe entfernen“). */
function ohne(dp: KontrollDatenpunkt, feld: keyof KontrollDatenpunkt): KontrollDatenpunkt {
  const kopie: Record<string, unknown> = { ...dp };
  delete kopie[feld];
  return kopie as unknown as KontrollDatenpunkt;
}

/**
 * Der Prüfstand, wie PP-02 ihn für diesen Datenpunkt liefert: die erforderlichen Dimensionen nach
 * PP-02 `erforderlich`, je Dimension der übergebene Stand, sonst „offen“.
 */
function stand02(
  dp: KontrollDatenpunkt,
  staende: Partial<Record<Dimension, Partial<DimensionsEingang>>> = {},
): PruefstandEingang {
  const noetig = (d: Dimension): boolean => {
    switch (d) {
      case "erkennung":
        return dp.erfassung === "direkt" || dp.erfassung === "ocr";
      case "berechnung":
        return dp.rechenweg !== undefined;
      case "aktualitaet":
        return dp.quelle !== undefined || dp.rechenweg !== undefined;
      default:
        return true;
    }
  };
  const erforderlich = DIMENSIONEN.filter(noetig);
  return {
    datenFassung: dp.fassung,
    erforderlich,
    prognose: dp.erfassung === "prognose",
    dimensionen: DIMENSIONEN.map(
      (dimension): DimensionsEingang => ({
        dimension,
        stand: noetig(dimension) ? "offen" : "nicht_zutreffend",
        grund: "PP-02",
        ...staende[dimension],
      }),
    ),
  };
}

function geprueft(dimension: Dimension, von = "pruefer"): Partial<DimensionsEingang> {
  return {
    stand: "bestanden",
    grund: "Geprüft.",
    pruefung: {
      id: `p-${dimension}`,
      dimension,
      ergebnis: "bestanden",
      grund: "Geprüft.",
      von,
      am: new Date(JETZT - TAG).toISOString(),
      datenFassung: 2,
    },
  };
}

const UEBERHOLT = {
  stand: "ueberholt",
  grund:
    "Geprüft für Datenfassung 2; seitdem geändert: Bezugszeitraum. Die alte Prüfung gilt nicht für Fassung 3.",
} as const;

function umgebung(teil: Partial<KontrollUmgebung> = {}): KontrollUmgebung {
  return {
    artikel: async (id) => (id === "ko-1" ? artikel({ id }) : undefined),
    folien: async () => tabelle("1.800"),
    vergleichbare: async () => [],
    jetzt: JETZT,
    ...teil,
  };
}

function dimension(k: Datenkontrolle, d: Dimension) {
  const x = k.dimensionen.find((y) => y.dimension === d);
  if (!x) {
    throw new Error(d);
  }
  return x;
}

function befund(k: Datenkontrolle, id: string) {
  return k.befunde.find((b) => b.id === id);
}

describe("PP-03 · Zahlen lesen wie PP-02", () => {
  it("deutsche Schreibweise mit Nachkommastellen", () => {
    expect(eineZahl("1.800")).toEqual({ zahl: 1800, stellen: 0 });
    expect(eineZahl("1.234,50 €")).toEqual({ zahl: 1234.5, stellen: 2 });
    expect(eineZahl("29,4 %")).toEqual({ zahl: 29.4, stellen: 1 });
    expect(eineZahl("Q3 2026")).toBeUndefined();
  });
});

describe("PP-03 · A — fehlender Bezugszeitraum", () => {
  it("liefert Klärungsbedarf in der Struktur mit konkreter Arbeit", async () => {
    const dp = ohne(summenwert(), "zeitraum");
    const k = await datenkontrolle(dp, stand02(dp), umgebung());
    expect(k.zustand).toBe("klaerung");
    expect(dimension(k, "struktur").stand).toBe("klaerung");
    expect(dimension(k, "struktur").grund).toContain("fehlt der Bezugszeitraum");
    expect(befund(k, "struktur.zeitraum_fehlt")?.ergebnis).toBe("klaerung");
    expect(k.naechsteArbeit).toContain("Bezugszeitraum ergänzen (Korrektur am Datenpunkt).");
  });

  it("lässt sich nicht wegbestätigen: ein „bestanden“ hebt den Mangel nicht auf", async () => {
    const dp = ohne(summenwert(), "zeitraum");
    const stand = stand02(dp, {
      struktur: geprueft("struktur"),
      fachliche_freigabe: geprueft("fachliche_freigabe"),
    });
    const k = await datenkontrolle(dp, stand, umgebung());
    expect(dimension(k, "struktur").stand).toBe("klaerung");
    expect(dimension(k, "struktur").herkunft).toBe("kontrolle");
    expect(k.zustand).toBe("klaerung");
  });

  it("Prozentwert ohne Bezugsgröße und Zahl ohne Einheit werden konkret benannt", async () => {
    const dp: KontrollDatenpunkt = {
      id: "dp-anteil",
      heimatKoId: "ko-1",
      fassung: 1,
      art: "zahl",
      wert: "29,4 %",
      zahl: 29.4,
      zeitraum: "Q3 2026",
      erfassung: "manuell",
      fundstelle: { art: "eingabe" },
    };
    const k = await datenkontrolle(dp, stand02(dp), umgebung());
    expect(befund(k, "struktur.bezugsgroesse_fehlt")?.grund).toContain("Nenner");
    expect(befund(k, "struktur.einheit_fehlt")?.ergebnis).toBe("klaerung");
  });
});

describe("PP-03 · B — falsche Summe", () => {
  it("rechnet die Summenzeile derselben Dateifassung nach und nennt Rechnung und Abweichung", async () => {
    const dp = summenwert({ wert: "1.900", zahl: 1900, fundstelle: zelle(5, "Summe", "1.900") });
    const k = await datenkontrolle(
      dp,
      stand02(dp),
      umgebung({ folien: async () => tabelle("1.900") }),
    );
    const b = befund(k, "berechnung.summe_falsch");
    expect(b?.ergebnis).toBe("klaerung");
    expect(b?.grund).toContain("„Nord“ 500 + „Süd“ 700 + „West“ 600 = 1.800");
    expect(b?.grund).toContain("in der Summe steht „1.900“ (Abweichung 100)");
    // Ein direkt übernommener Wert hat bei PP-02 keine Berechnungsdimension — die Summe macht sie
    // erforderlich.
    expect(k.erforderlich).toContain("berechnung");
    expect(dimension(k, "berechnung").stand).toBe("klaerung");
    expect(k.zustand).toBe("klaerung");
  });

  it("eine stimmende Summe ist maschinell nachgerechnet (V06) und als solche ausgewiesen", async () => {
    const dp = summenwert();
    const k = await datenkontrolle(dp, stand02(dp), umgebung());
    expect(dimension(k, "berechnung").stand).toBe("bestanden");
    expect(dimension(k, "berechnung").herkunft).toBe("kontrolle");
    expect(befund(k, "berechnung.summe_stimmt")?.regel).toContain("V06");
  });

  it("eine Teilzeile ohne eindeutige Zahl macht die Summe nicht nachrechenbar", async () => {
    const dp = summenwert();
    const k = await datenkontrolle(
      dp,
      stand02(dp),
      umgebung({ folien: async () => tabelle("1.800", "obj-2", "k. A.") }),
    );
    expect(befund(k, "berechnung.summe_unvollstaendig")?.grund).toContain("Zeile 2: „k. A.“");
    expect(dimension(k, "berechnung").stand).toBe("klaerung");
  });
});

describe("PP-03 · C — unsichere OCR", () => {
  const ocr = (unsicher: boolean): KontrollDatenpunkt => ({
    id: "dp-ocr",
    heimatKoId: "ko-1",
    fassung: 1,
    art: "zahl",
    wert: "1.800",
    zahl: 1800,
    waehrung: "T€",
    zeitraum: "Q3 2026",
    bezugsgroesse: "Umsatz gesamt",
    erfassung: "ocr",
    quelle: { koId: "ko-1", koFassung: 4, anhangId: "anh-1", objectId: "obj-2" },
    fundstelle: {
      art: "bild",
      sldId: "257",
      shapeId: "7",
      folienPosition: 3,
      folienTitel: "Screenshot",
      elementName: "Bild 6",
      ocrText: "Gesamt 1.800",
      unsicher,
    },
  });

  it("liefert Klärungsbedarf in der Erkennung mit der Fundstelle am Bild", async () => {
    const dp = ocr(true);
    const k = await datenkontrolle(dp, stand02(dp), umgebung());
    const b = befund(k, "erkennung.ocr_unsicher");
    expect(dimension(k, "erkennung").stand).toBe("klaerung");
    expect(b?.grund).toContain("Folie 3 „Screenshot“, Bild „Bild 6“");
    expect(b?.grund).toContain("OCR allein validiert nicht");
    expect(k.naechsteArbeit).toContain("Wert am Bild bestätigen oder korrigieren.");
  });

  it("nach der Bestätigung am Bild durch einen Menschen gilt dessen Prüfung", async () => {
    const dp = ocr(true);
    const k = await datenkontrolle(
      dp,
      stand02(dp, { erkennung: geprueft("erkennung") }),
      umgebung(),
    );
    expect(befund(k, "erkennung.ocr_unsicher")).toBeUndefined();
    expect(dimension(k, "erkennung").stand).toBe("bestanden");
    expect(dimension(k, "erkennung").herkunft).toBe("pruefung");
  });

  it("auch sichere OCR bleibt offen und wird nie maschinell bestätigt", async () => {
    const dp = ocr(false);
    const k = await datenkontrolle(dp, stand02(dp), umgebung());
    expect(dimension(k, "erkennung").stand).toBe("offen");
    expect(befund(k, "erkennung.ocr_unbestaetigt")?.ergebnis).toBe("offen");
  });
});

describe("PP-03 · D — veraltete Quellfassung", () => {
  it("neue Artikelfassung: Überprüfung nötig, mit verwendeter und aktueller Fassung", async () => {
    const dp = summenwert({
      quelle: { koId: "ko-1", koFassung: 3, anhangId: "anh-1", objectId: "obj-2" },
    });
    const stand = stand02(dp, {
      aktualitaet: {
        stand: "ueberholt",
        grund: "Verwendet wurde Quellfassung 3; die Quelle steht jetzt bei Fassung 4.",
      },
    });
    const k = await datenkontrolle(dp, stand, umgebung());
    expect(k.zustand).toBe("ueberpruefung_noetig");
    expect(dimension(k, "aktualitaet").stand).toBe("ueberholt");
    expect(befund(k, "aktualitaet.neue_quellfassung")?.grund).toBe(
      "Verwendet wurde Fassung 3 von „Vertriebszahlen Q3“; aktuell ist Fassung 4.",
    );
    expect(befund(k, "aktualitaet.quelle_aktuell")).toBeUndefined();
  });

  it("neue Dateifassung: die Summe wird nicht an einer anderen Fassung gerechnet", async () => {
    const dp = summenwert({
      quelle: { koId: "ko-1", koFassung: 4, anhangId: "anh-1", objectId: "obj-1" },
    });
    const k = await datenkontrolle(dp, stand02(dp), umgebung());
    expect(befund(k, "aktualitaet.neue_quellfassung")?.grund).toContain("„Quartal.pptx“");
    expect(dimension(k, "aktualitaet").stand).toBe("klaerung");
    expect(befund(k, "berechnung.summe_stimmt")).toBeUndefined();
    expect(dimension(k, "berechnung").stand).toBe("offen");
    expect(dimension(k, "berechnung").grund).toContain("nicht mehr die aktuelle");
  });

  it("Quelle laut Klarwerk-Frische veraltet (V03): Klärung, auch gegen ein „bestanden“", async () => {
    const alt = artikel({ id: "ko-1", createdAt: new Date(JETZT - 400 * TAG).toISOString() });
    const dp = summenwert();
    const k = await datenkontrolle(
      dp,
      stand02(dp, { aktualitaet: geprueft("aktualitaet") }),
      umgebung({ artikel: async () => alt }),
    );
    expect(befund(k, "aktualitaet.quelle_veraltet")?.grund).toContain("„veraltet“");
    expect(befund(k, "aktualitaet.quelle_veraltet")?.regel).toBe("V03 Frische");
    expect(dimension(k, "aktualitaet").stand).toBe("klaerung");
  });
});

describe("PP-03 · E — ein passend geprüfter Wert wird gültig angezeigt", () => {
  it("validiert, wenn alle erforderlichen Dimensionen bestanden sind, Freigabe eingeschlossen", async () => {
    const dp = summenwert();
    const stand = stand02(dp, {
      erkennung: geprueft("erkennung", "klarwerk:pptx-leser"),
      struktur: geprueft("struktur"),
      konsistenz: geprueft("konsistenz"),
      fachliche_freigabe: geprueft("fachliche_freigabe"),
    });
    const k = await datenkontrolle(dp, stand, umgebung());
    expect(k.zustand).toBe("validiert");
    expect(k.zustandName).toBe("Validiert");
    expect(k.grund).toContain("Validiert für Datenfassung 2");
    expect(dimension(k, "aktualitaet").stand).toBe("bestanden");
    expect(befund(k, "aktualitaet.quelle_aktuell")?.grund).toContain("aktuelle Fassung 4");
    expect(k.naechsteArbeit).toEqual([]);
  });

  it("ohne fachliche Freigabe nicht validiert — Erkennung und Teilprüfungen genügen nicht", async () => {
    const dp = summenwert();
    const stand = stand02(dp, {
      erkennung: geprueft("erkennung", "klarwerk:pptx-leser"),
      struktur: geprueft("struktur"),
      konsistenz: geprueft("konsistenz"),
    });
    const k = await datenkontrolle(dp, stand, umgebung());
    expect(k.zustand).toBe("in_pruefung");
    expect(dimension(k, "fachliche_freigabe").stand).toBe("offen");
    expect(k.naechsteArbeit).toContain("Fachliche Freigabe prüfen.");
  });

  it("eine validierte Quelle validiert den Wert nicht; ihr Status ist Auskunft (V01)", async () => {
    const dp = summenwert();
    const k = await datenkontrolle(
      dp,
      stand02(dp),
      umgebung({ artikel: async () => artikel({ id: "ko-1", status: "validiert" }) }),
    );
    const b = befund(k, "freigabe.quellstatus");
    expect(b?.ergebnis).toBe("hinweis");
    expect(b?.grund).toContain("validiert den Wert nicht automatisch");
    expect(dimension(k, "fachliche_freigabe").stand).toBe("offen");
  });
});

describe("PP-03 · F — Änderungen heben den alten Status nachvollziehbar auf", () => {
  it("nach einer Korrektur gilt die alte Prüfung nicht mehr: Überprüfung nötig mit Grund", async () => {
    const dp = summenwert({ fassung: 3 });
    const stand = stand02(dp, {
      erkennung: geprueft("erkennung", "klarwerk:pptx-leser"),
      struktur: UEBERHOLT,
      konsistenz: geprueft("konsistenz"),
      fachliche_freigabe: UEBERHOLT,
    });
    const k = await datenkontrolle(dp, stand, umgebung());
    expect(k.zustand).toBe("ueberpruefung_noetig");
    expect(k.grund).toContain("seitdem geändert: Bezugszeitraum");
    expect(k.naechsteArbeit).toContain("Struktur für Fassung 3 erneut prüfen.");
    expect(k.naechsteArbeit).toContain("Fachliche Freigabe für Fassung 3 erneut prüfen.");
  });

  it("eine neue Quelldatei hebt eine zuvor nachgerechnete Summe auf", async () => {
    const dp = summenwert();
    const vorher = await datenkontrolle(dp, stand02(dp), umgebung());
    expect(dimension(vorher, "berechnung").stand).toBe("bestanden");
    // Nord ist in der neuen Dateifassung 600 statt 500 — der Artikel trägt die neue Fassung.
    const neu = artikel({
      id: "ko-1",
      attachments: [{ id: "anh-1", name: "Quartal.pptx", objectId: "obj-3" }],
    });
    const nachher = await datenkontrolle(
      dp,
      stand02(dp),
      umgebung({ artikel: async () => neu, folien: async () => tabelle("1.800", "obj-3", "600") }),
    );
    expect(befund(nachher, "berechnung.summe_stimmt")).toBeUndefined();
    expect(dimension(nachher, "berechnung").stand).toBe("offen");
    expect(dimension(nachher, "aktualitaet").stand).toBe("klaerung");
    expect(nachher.zustand).toBe("klaerung");
  });
});

describe("PP-03 · G — Widersprüche kontextgerecht prüfen", () => {
  const bild = (teil: Partial<KontrollDatenpunkt> = {}): KontrollDatenpunkt => ({
    id: "dp-bild",
    heimatKoId: "ko-1",
    fassung: 1,
    art: "zahl",
    wert: "1.500",
    zahl: 1500,
    waehrung: "T€",
    zeitraum: "Q3 2026",
    bezugsgroesse: "Umsatz gesamt",
    erfassung: "ocr",
    quelle: { koId: "ko-1", koFassung: 4, anhangId: "anh-1", objectId: "obj-2" },
    fundstelle: {
      art: "bild",
      folienPosition: 3,
      folienTitel: "Screenshot",
      elementName: "Bild 6",
      unsicher: false,
    },
    ...teil,
  });

  it("echte Abweichung: beide Angaben mit ihren Fundstellen, keine Entscheidung", async () => {
    const dp = summenwert();
    const k = await datenkontrolle(
      dp,
      stand02(dp),
      umgebung({ vergleichbare: async () => [bild()] }),
    );
    const b = befund(k, "konsistenz.widerspruch");
    expect(b?.ergebnis).toBe("klaerung");
    expect(b?.hier).toContain("Folie 2 „Umsatz je Region“, Tabelle „Tabelle 3“, Zeile 5 („Summe“)");
    expect(b?.gegenstellen?.[0]).toMatchObject({ wert: "1.500", erfassung: "ocr" });
    expect(b?.gegenstellen?.[0]?.fundstelle).toContain("Folie 3 „Screenshot“, Bild „Bild 6“");
    expect(b?.grund).toContain("Klara entscheidet nicht, welcher Wert richtig ist.");
    expect(dimension(k, "konsistenz").stand).toBe("klaerung");
  });

  it("anderer Zeitraum oder andere Einheit ist kein Widerspruch", async () => {
    const dp = summenwert();
    const andere = [
      bild({ id: "dp-q2", zeitraum: "Q2 2026" }),
      bild({ id: "dp-eur", wert: "1.800.000", zahl: 1_800_000, waehrung: "€" }),
    ];
    const k = await datenkontrolle(
      dp,
      stand02(dp),
      umgebung({ vergleichbare: async () => andere }),
    );
    const b = befund(k, "konsistenz.anderer_bezugsrahmen");
    expect(befund(k, "konsistenz.widerspruch")).toBeUndefined();
    expect(b?.ergebnis).toBe("hinweis");
    expect(b?.grund).toContain("„1.500“ (Q2 2026, T€)");
    expect(b?.grund).toContain("„1.800.000“ (Q3 2026, €)");
    expect(dimension(k, "konsistenz").stand).toBe("offen");
  });

  it("eine unsicher erkannte Gegenangabe ist kein belegter Widerspruch", async () => {
    const dp = summenwert();
    const unsicher = bild({ fundstelle: { ...bild().fundstelle, unsicher: true } });
    const k = await datenkontrolle(
      dp,
      stand02(dp),
      umgebung({ vergleichbare: async () => [unsicher] }),
    );
    expect(befund(k, "konsistenz.widerspruch")).toBeUndefined();
    expect(befund(k, "konsistenz.abweichung_unsicher")?.ergebnis).toBe("offen");
    expect(dimension(k, "konsistenz").stand).toBe("offen");
  });

  it("gleichlautende Werte: Übereinstimmung statt Abweichungshinweis", async () => {
    const dp = summenwert();
    const k = await datenkontrolle(
      dp,
      stand02(dp),
      umgebung({ vergleichbare: async () => [bild({ wert: "1.800", zahl: 1800 })] }),
    );
    const klaerung = k.befunde.filter(
      (b) => b.dimension === "konsistenz" && b.ergebnis === "klaerung",
    );
    expect(befund(k, "konsistenz.uebereinstimmung")?.ergebnis).toBe("bestanden");
    expect(klaerung).toEqual([]);
  });

  it("eine Folie, die etwas anderes zeigt als die gebundene Datenfassung", async () => {
    const dp = summenwert();
    const k = await datenkontrolle(dp, stand02(dp), umgebung(), [
      { lage: "aktuell", folienPosition: 2, elementName: "Tabelle 3", datenFassung: 2 },
      {
        lage: "abweichung",
        folienPosition: 5,
        elementName: "Kernaussage",
        datenFassung: 2,
        anhangName: "Vorstand.pptx",
        heute: "Umsatz 1,9 Mio. €",
      },
    ]);
    expect(befund(k, "konsistenz.folie_abweichend")?.grund).toBe(
      "Folie 5 „Kernaussage“ (Vorstand.pptx) zeigt „Umsatz 1,9 Mio. €“; gebunden ist „1.800“ (Datenfassung 2).",
    );
    expect(dimension(k, "konsistenz").stand).toBe("klaerung");
  });
});

describe("PP-03 · H — Rechte bei Abruf", () => {
  it("ohne Leserecht an der Quelle: kein Titel, keine Fassung, keine Frische", async () => {
    const dp = summenwert();
    const k = await datenkontrolle(dp, stand02(dp), umgebung({ artikel: async () => undefined }));
    expect(JSON.stringify(k)).not.toContain("Vertriebszahlen Q3");
    expect(k.befunde.some((b) => b.dimension === "aktualitaet")).toBe(false);
    expect(dimension(k, "aktualitaet").stand).toBe("offen");
  });
});

describe("PP-03 · I — Herkunft eines berechneten Werts", () => {
  const berechnet: KontrollDatenpunkt = {
    id: "dp-anteil",
    heimatKoId: "ko-1",
    fassung: 1,
    art: "zahl",
    wert: "38,9 %",
    zahl: 38.9,
    einheit: "%",
    zeitraum: "Q3 2026",
    bezugsgroesse: "Anteil Süd am Umsatz gesamt",
    erfassung: "berechnet",
    fundstelle: { art: "rechenweg" },
    rechenweg: {
      eingaben: [
        { datenpunktId: "dp-sued", fassung: 1, wert: "700" },
        { datenpunktId: "dp-summe", fassung: 2, wert: "1.800" },
      ],
    },
  };
  const allesGeprueft = stand02(berechnet, {
    berechnung: geprueft("berechnung", "klarwerk:rechenweg"),
    struktur: geprueft("struktur"),
    konsistenz: geprueft("konsistenz"),
    aktualitaet: geprueft("aktualitaet"),
    fachliche_freigabe: geprueft("fachliche_freigabe"),
  });

  it("eine nicht validierte Eingabe verhindert die Validierung — auch gegen eine Freigabe", async () => {
    const k = await datenkontrolle(
      berechnet,
      allesGeprueft,
      umgebung({
        eingabeZustand: async (id) =>
          id === "dp-sued"
            ? { zustand: "klaerung", wert: "700" }
            : { zustand: "validiert", wert: "1.800" },
      }),
    );
    expect(befund(k, "freigabe.eingaben_nicht_validiert")?.grund).toContain(
      "„700“ (Klärungsbedarf)",
    );
    expect(dimension(k, "fachliche_freigabe").stand).toBe("klaerung");
    expect(k.zustand).toBe("klaerung");
  });

  it("mit validierten Eingaben bleibt die Freigabe des Menschen maßgeblich", async () => {
    const k = await datenkontrolle(
      berechnet,
      allesGeprueft,
      umgebung({ eingabeZustand: async () => ({ zustand: "validiert", wert: "" }) }),
    );
    expect(k.zustand).toBe("validiert");
  });
});

describe("PP-03 · Datenlage einer Präsentation", () => {
  it("zählt Zustände und nennt jeden Klärungspunkt mit der nötigen Arbeit", async () => {
    const gut = summenwert();
    const lueckig = ohne(summenwert({ id: "dp-ohne" }), "zeitraum");
    const lage = datenlage([
      await datenkontrolle(gut, stand02(gut), umgebung()),
      await datenkontrolle(lueckig, stand02(lueckig), umgebung()),
    ]);
    expect(lage.anzahl).toBe(2);
    expect(lage.jeZustand.klaerung).toBe(1);
    expect(lage.jeZustand.in_pruefung).toBe(1);
    expect(lage.offenePunkte).toContainEqual({
      datenpunktId: "dp-ohne",
      zustand: "klaerung",
      titel: "Bezugszeitraum fehlt",
      naechsteArbeit: "Bezugszeitraum ergänzen (Korrektur am Datenpunkt).",
    });
  });
});
