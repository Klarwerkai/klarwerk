// ================================================================================================
// BPA-02 · REGELBASIERTE EXTRAKTION TECHNISCHER DATEN
// (produkt:20261011:assistenz-browser-wissenserfassung)
// ================================================================================================
//
// Geprüft wird das Modul `services/app/src/technische-daten.ts` an synthetischen Ventilen V-17/V-18
// (BPA-S01): Variantenzuordnung, Einheiten, Bedingungen, Normalisierung ohne falsche Genauigkeit,
// Herkunft je Wert, Klärungen statt Raten, Belegvergleich mit benannten Gewichten, keine Dubletten.
import { describe, expect, it } from "vitest";
import {
  BEWERTUNG,
  belegAdresse,
  belegFassung,
  entwurfHtml,
  extrahiere,
  fassungsUnterschied,
  pruefeAbschnitt,
  uebernahmeAufbauen,
  uebernahmeKennung,
} from "../../services/app/src/technische-daten";
import { DATENBLATT, HTML_SEITE, LUECKENHAFT, geaendert } from "./fixture";

function wert(e: ReturnType<typeof extrahiere>, modell: string, variante: string, merkmal: string) {
  const treffer = e.werte.filter(
    (w) => w.modell === modell && w.variante === variante && w.merkmal === merkmal,
  );
  expect(treffer, `${modell}/${variante}/${merkmal}`).toHaveLength(1);
  return treffer[0] as (typeof e.werte)[number];
}

describe("AC01 · Modell/Variante und Einheit je Zeile, keine vermischten Werte", () => {
  const e = extrahiere(HTML_SEITE);

  it("ordnet jede Zelle ihrer eigenen Zeile zu", () => {
    expect(wert(e, "V-17", "DN25", "Betriebsdruck")).toMatchObject({
      original: "16 bar ±0,5 bar",
      wert: "16",
      einheit: "bar",
      herkunft: { zeile: 1, spalte: "Betriebsdruck" },
    });
    expect(wert(e, "V-18", "DN40", "Betriebsdruck")).toMatchObject({
      original: "232 psi",
      wert: "232",
      einheit: "psi",
      herkunft: { zeile: 2 },
    });
    expect(wert(e, "V-18", "DN50", "Temperaturbereich")).toMatchObject({
      original: "-10 … 120 °C",
      art: "bereich",
      von: "-10",
      bis: "120",
      einheit: "°C",
      herkunft: { zeile: 3 },
    });
    // Sechs Datenzellen (3 Zeilen × 2 Merkmale); die Bedingungsspalte ist kein eigener Wert.
    expect(e.werte).toHaveLength(6);
  });

  it("liest Einheiten aus dem Spaltenkopf, wenn die Zelle keine trägt", () => {
    const d = extrahiere(DATENBLATT);
    expect(wert(d, "V-18", "DN40", "Betriebsdruck")).toMatchObject({
      original: "16",
      einheit: "bar",
      einheitHerkunft: "spaltenkopf",
      status: "uebernehmbar",
    });
  });

  it("spaltenorientiertes Datenblatt: jede Spalte ein Gerät", () => {
    const quer = extrahiere({
      ...DATENBLATT,
      kopf: ["Merkmal", "V-17", "V-18"],
      zeilen: [
        ["Betriebsdruck (bar)", "10", "16"],
        ["Werkstoff", "Messing", "Edelstahl"],
      ],
    });
    expect(quer.werte.map((w) => [w.modell, w.merkmal, w.original])).toEqual([
      ["V-17", "Betriebsdruck", "10"],
      ["V-18", "Betriebsdruck", "16"],
      ["V-17", "Werkstoff", "Messing"],
      ["V-18", "Werkstoff", "Edelstahl"],
    ]);
  });

  it("Zielauswahl nimmt nur das genannte Gerät", () => {
    const nur = extrahiere(HTML_SEITE, { objekt: "v 18", variante: "dn40" });
    const geraete = new Set(nur.werte.map((w) => `${w.modell}/${w.variante}`));
    expect(geraete).toEqual(new Set(["V-18/DN40"]));
    const keins = extrahiere(HTML_SEITE, { objekt: "V-99" });
    expect(keins.werte).toHaveLength(0);
    expect(keins.klaerungen.map((k) => k.art)).toEqual(["ziel_nicht_gefunden"]);
  });
});

describe("AC02 · Bereich, Druck und Bedingungen gemeinsam; Normalisierung mit Formel ohne falsche Genauigkeit", () => {
  const e = extrahiere(HTML_SEITE);

  it("Toleranz und Prüfbedingung bleiben am Wert", () => {
    expect(wert(e, "V-17", "DN25", "Betriebsdruck")).toMatchObject({
      toleranz: "±0,5 bar",
      bedingungen: ["Prüfbedingung: Wasser, 20 °C"],
      normalisierung: null, // schon in bar — keine Umrechnung erfunden
    });
    expect(wert(e, "V-17", "DN25", "Temperaturbereich")).toMatchObject({
      art: "bereich",
      von: "−10",
      bis: "+120",
      einheit: "°C",
      bedingungen: ["Prüfbedingung: Wasser, 20 °C"],
    });
    const d = extrahiere(DATENBLATT);
    expect(wert(d, "V-17", "DN25", "Betriebsdruck").bedingungen).toEqual(["bei 20 °C"]);
  });

  it("psi → bar: Formel genannt, auf die Stellen des Originals gerundet", () => {
    expect(wert(e, "V-18", "DN40", "Betriebsdruck").normalisierung).toEqual({
      einheit: "bar",
      wert: "16.0",
      formel: "p[bar] = p[psi] × 0,0689476",
      stellen: 3,
    });
  });

  it("°F-Bereich → °C: beide Enden, Original bleibt daneben stehen", () => {
    const t = wert(e, "V-18", "DN40", "Temperaturbereich");
    expect(t.original).toBe("14 … 248 °F");
    expect(t.normalisierung).toEqual({
      einheit: "°C",
      von: "-10",
      bis: "120",
      formel: "t[°C] = (t[°F] − 32) × 5/9",
      stellen: 2,
    });
  });

  it("Dezimalkomma bleibt, Genauigkeit wird nicht erhöht", () => {
    const m = extrahiere({
      ...HTML_SEITE,
      kopf: ["Modell", "Nenndruck"],
      zeilen: [
        ["V-17", "1,50 MPa"],
        ["V-18", "0,5 MPa"],
      ],
    });
    expect(m.werte.map((w) => w.normalisierung?.wert)).toEqual(["15,0", "5"]);
  });
});

describe("AC03 · Herkunft je Wert: genauer Abschnitt und tatsächlich erfasste Fassung", () => {
  it("jeder Wert trägt Adresse mit Anker, Abschnitt, Zeile, Spalte, Fassung und Erfassungszeit", () => {
    const e = extrahiere(HTML_SEITE);
    const fassung = belegFassung(HTML_SEITE);
    expect(fassung).toMatch(/^[0-9a-f]{64}$/);
    for (const w of e.werte) {
      expect(w.herkunft).toMatchObject({
        url: HTML_SEITE.url,
        anker: "technische-daten",
        abschnitt: "Technische Daten",
        fassung,
        abgerufenAm: HTML_SEITE.abgerufenAm,
      });
      expect(w.herkunft.zeile).toBeGreaterThan(0);
      expect(HTML_SEITE.kopf).toContain(w.herkunft.spalte);
    }
    expect(belegAdresse(e.werte[0]?.herkunft as never)).toBe(
      "https://ventile.example.test/produkte/v-serie#technische-daten",
    );
  });

  it("ohne Abschnitt (nur Seitenadresse) wird nicht übernommen", () => {
    expect(pruefeAbschnitt({ ...HTML_SEITE, abschnitt: "" })).toBe("QUELLABSCHNITT_FEHLT");
    expect(pruefeAbschnitt({ ...HTML_SEITE, abschnitt: "   " })).toBe("QUELLABSCHNITT_FEHLT");
    expect(pruefeAbschnitt({ ...HTML_SEITE, url: "file:///etc/passwd" })).toBe("BELEG_URL");
    const ohneZone = { ...HTML_SEITE, abgerufenAm: "2026-10-11T14:05:00" };
    expect(pruefeAbschnitt(ohneZone)).toBe("BELEG_ZEIT");
    expect(pruefeAbschnitt(HTML_SEITE)).toBeNull();
  });

  it("die Fassung hängt am Inhalt, nicht am Erfassungszeitpunkt", () => {
    expect(belegFassung({ ...HTML_SEITE, abgerufenAm: "2026-10-12T09:00:00Z" })).toBe(
      belegFassung(HTML_SEITE),
    );
    expect(belegFassung(geaendert(HTML_SEITE, 0, 2, "20 bar"))).not.toBe(belegFassung(HTML_SEITE));
  });
});

describe("AC04 · Fehlende Einheit und Widerspruch → konkrete Klärung, kein verbindlicher Wert", () => {
  const e = extrahiere(LUECKENHAFT);

  it("Zahl ohne Einheit bleibt ohne Einheit und in Klärung", () => {
    const hub = e.werte.find((w) => w.merkmal === "Hub" && w.original === "12");
    expect(hub).toMatchObject({ einheit: null, status: "in_klaerung", normalisierung: null });
    const fehlt = e.klaerungen.filter((k) => k.art === "einheit_fehlt");
    expect(fehlt.some((k) => k.text.includes("Hub"))).toBe(true);
  });

  it("widersprüchliche Zeilen nennen beide Angaben; keine wird übernehmbar", () => {
    const druck = e.werte.filter((w) => w.merkmal === "Betriebsdruck");
    expect(druck.map((w) => w.status)).toEqual(["in_klaerung", "in_klaerung"]);
    const w = e.klaerungen.find((k) => k.art === "widerspruch" && k.text.includes("Betriebsdruck"));
    expect(w?.text).toContain('„25 bar" (Zeile 1) gegen „16 bar" (Zeile 2)');
    expect(w?.betrifft.map((h) => h.zeile)).toEqual([1, 2]);
  });

  it("Zelleneinheit gegen Kopfeinheit wird nicht still aufgelöst", () => {
    const k = extrahiere({ ...DATENBLATT, zeilen: [["V-17", "DN25", "150 psi", "-10 … 100"]] });
    expect(k.werte[0]).toMatchObject({ einheit: "psi", status: "in_klaerung" });
    expect(k.klaerungen.map((x) => x.art)).toContain("einheit_widerspruch");
  });
});

describe("AC05 · HTML-Seite und Datenblatt bleiben getrennte Belege; Empfehlung mit benannten Gewichten", () => {
  const u = uebernahmeAufbauen([HTML_SEITE, DATENBLATT], {});

  it("nur echte Abweichungen; 232 psi und 16 bar gelten im Rahmen der Genauigkeit als gleich", () => {
    expect(u.abweichungen.map((a) => `${a.modell}/${a.variante}/${a.merkmal}`)).toEqual([
      "V-17/DN25/Betriebsdruck",
      "V-17/DN25/Temperaturbereich",
    ]);
  });

  it("beide Belege sichtbar, Bewertung aus Dokumentart 40, Vollständigkeit 30, Stand 30", () => {
    expect(BEWERTUNG.map((b) => [b.kriterium, b.gewicht])).toEqual([
      ["Dokumentart", 40],
      ["Angabenvollständigkeit", 30],
      ["Quellenstand", 30],
    ]);
    const druck = u.abweichungen[0];
    expect(druck?.belege.map((b) => [b.herkunft.art, b.original, b.prozent])).toEqual([
      ["html", "16 bar ±0,5 bar", 65],
      ["datenblatt", "10 (bei 20 °C)", 100],
    ]);
    expect(druck?.empfehlung).toBe(1);
    expect(druck?.begruendung).toContain("nicht die Wahrscheinlichkeit");
    expect(druck?.begruendung).toContain("Dokumentart (40)");
    // Die Empfehlung übernimmt nichts: beide Werte bleiben in Klärung.
    const v17 = u.geraete.find((g) => g.modell === "V-17");
    expect(v17?.werte.filter((w) => w.merkmal === "Betriebsdruck").map((w) => w.status)).toEqual([
      "in_klaerung",
      "in_klaerung",
    ]);
  });

  it("zu knapper Abstand → keine Empfehlung", () => {
    const zwei = uebernahmeAufbauen(
      [HTML_SEITE, { ...geaendert(HTML_SEITE, 0, 2, "18 bar"), url: `${HTML_SEITE.url}?v=2` }],
      { objekt: "V-17" },
    );
    const a = zwei.abweichungen.find((x) => x.merkmal === "Betriebsdruck");
    expect(a?.empfehlung).toBeNull();
    expect(a?.begruendung).toContain("Keine Empfehlung");
  });

  it("der Entwurfsrumpf nennt beide Belege, Formel und die Grenze der Prozentzahl", () => {
    const html = entwurfHtml(u, false);
    expect(html).toContain("16 bar ±0,5 bar");
    expect(html).toContain("10 (bei 20 °C)");
    expect(html).toContain("p[bar] = p[psi] × 0,0689476");
    expect(html).toContain("Belegbewertung 100 %");
    expect(html).toContain("ohne KI-Anbieter");
    expect(html).toContain('href="https://ventile.example.test/produkte/v-serie#technische-daten"');
  });
});

describe("AC06 · Keine Dublette, keine Zusammenlegung verschiedener Geräte", () => {
  it("gleiche 16 bar bei V-17/DN25 und V-18/DN50 bleiben zwei Geräte", () => {
    const u = uebernahmeAufbauen([HTML_SEITE], {});
    expect(u.geraete.map((g) => `${g.modell}/${g.variante}`)).toEqual([
      "V-17/DN25",
      "V-18/DN40",
      "V-18/DN50",
    ]);
  });

  it("dieselbe Zeile doppelt im Abschnitt ergibt einen Wert", () => {
    const doppelt = extrahiere({
      ...HTML_SEITE,
      zeilen: [HTML_SEITE.zeilen[0] as string[], HTML_SEITE.zeilen[0] as string[]],
    });
    expect(doppelt.werte).toHaveLength(2);
    expect(doppelt.klaerungen).toHaveLength(0);
  });

  it("dieselben Fassungen und dasselbe Ziel ergeben dieselbe Vorgangskennung", () => {
    const a = uebernahmeKennung([HTML_SEITE, DATENBLATT], { objekt: "V-17" });
    const spaeter = { ...HTML_SEITE, abgerufenAm: "2026-10-12T08:00:00Z" };
    expect(uebernahmeKennung([DATENBLATT, spaeter], { objekt: "v17" })).toBe(a);
    expect(uebernahmeKennung([HTML_SEITE, DATENBLATT], { objekt: "V-18" })).not.toBe(a);
    const anders = geaendert(HTML_SEITE, 0, 2, "20 bar");
    expect(uebernahmeKennung([anders, DATENBLATT], { objekt: "V-17" })).not.toBe(a);
  });
});

describe("AC08 · Fassungsabgleich zellgenau", () => {
  it("nennt genau die geänderte Zelle", () => {
    expect(fassungsUnterschied(HTML_SEITE, geaendert(HTML_SEITE, 0, 2, "20 bar"))).toEqual([
      { zeile: 1, spalte: "Betriebsdruck", vorher: "16 bar ±0,5 bar", jetzt: "20 bar" },
    ]);
    expect(fassungsUnterschied(HTML_SEITE, HTML_SEITE)).toEqual([]);
  });
});
