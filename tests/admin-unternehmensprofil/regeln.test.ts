// ================================================================================================
// ADMIN-15 · DIE FACHLICHEN REGELN OHNE DRAHT — Kontrast, Logoprüfung, Wirkung einer Fassung.
// ================================================================================================
//
// K2: Jede angebotene Akzentfarbe hält mindestens 7:1; ungeeignete Dateien werden mit Grund
//     abgewiesen (SVG, falscher Inhalt, zu gross, zu klein, zu schmal).
// K3: Die Wirkung einer neuen Fassung sagt vorab, ob erneut Kenntnisnahme oder Zustimmung verlangt
//     wird, und zählt die betroffenen Konten nach Geltung.
// Alle Bilder sind im Test erzeugte, fiktive Dateien.
import { describe, expect, it } from "vitest";
import {
  AKZENTE,
  type Handlung,
  LOGO_GRENZEN,
  MIN_KONTRAST,
  type RichtlinienFassung,
  UnternehmenFehler,
  akzentListe,
  berechneWirkung,
  kontrastVerhaeltnis,
  pruefeLogo,
  pruefeProfilEingabe,
  pruefeRichtlinieEingabe,
} from "../../services/app/src/unternehmensprofil";
import { SVG_MIT_SKRIPT, alsLogo, jpegKopf, pngLogo } from "../../tests-smoke/support/logo-bild";

function fehlercode(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    if (e instanceof UnternehmenFehler) {
      return e.code;
    }
    throw e;
  }
  return "kein Fehler";
}

describe("K2 · Akzentfarben: feste Auswahl mit lesbarem Kontrast", () => {
  it("jede Akzentfarbe hält mindestens 7:1 zwischen Fläche und Schrift", () => {
    const liste = akzentListe();
    expect(liste.map((a) => a.id)).toEqual(Object.keys(AKZENTE));
    for (const a of liste) {
      expect(a.kontrast, a.id).toBeGreaterThanOrEqual(MIN_KONTRAST);
      expect(kontrastVerhaeltnis(a.flaeche, a.schrift)).toBe(a.kontrast);
    }
  });

  it("die Kontrastrechnung trifft die bekannten Eckwerte (Schwarz/Weiss 21:1, gleich 1:1)", () => {
    expect(kontrastVerhaeltnis("#000000", "#ffffff")).toBe(21);
    expect(kontrastVerhaeltnis("#ffffff", "#ffffff")).toBe(1);
    // Gegenprobe: eine helle Farbe auf Weiss fiele durch — sie steht deshalb nicht in der Liste.
    expect(kontrastVerhaeltnis("#e8630a", "#ffffff")).toBeLessThan(MIN_KONTRAST);
  });

  it("eine nicht angebotene Farbe wird abgewiesen — es gibt keinen freien Farbwert", () => {
    expect(
      fehlercode(() => pruefeProfilEingabe({ name: "Nordtal", logo: null, akzent: "#ff00ff" })),
    ).toBe("AKZENT_UNBEKANNT");
    expect(
      fehlercode(() => pruefeProfilEingabe({ name: "Nordtal", logo: null, akzent: "toString" })),
    ).toBe("AKZENT_UNBEKANNT");
  });
});

describe("K2 · Logodateien: geeignet angenommen, ungeeignet erklärt abgewiesen", () => {
  it("ein PNG und ein JPEG mit lesbaren Massen werden angenommen; die Masse kommen aus der Datei", () => {
    const png = pruefeLogo(alsLogo(pngLogo(160, 48), "image/png"));
    expect(png).toMatchObject({ typ: "image/png", breite: 160, hoehe: 48 });
    const jpeg = pruefeLogo(alsLogo(jpegKopf(300, 80), "image/jpeg"));
    expect(jpeg).toMatchObject({ typ: "image/jpeg", breite: 300, hoehe: 80 });
    expect(pruefeLogo(null)).toBeNull();
  });

  it("SVG wird abgewiesen — mit einer Begründung, die SVG und Skripte nennt", () => {
    try {
      pruefeLogo(alsLogo(SVG_MIT_SKRIPT, "image/svg+xml"));
      throw new Error("SVG wurde angenommen");
    } catch (e) {
      expect(e).toBeInstanceOf(UnternehmenFehler);
      const f = e as UnternehmenFehler;
      expect(f.status).toBe(400);
      expect(f.code).toBe("LOGO_TYP");
      expect(f.message).toMatch(/SVG/);
      expect(f.message).toMatch(/Skripte/);
    }
  });

  it("ein als PNG ausgegebenes SVG, kaputtes Base64 und ein leerer Inhalt werden abgewiesen", () => {
    expect(fehlercode(() => pruefeLogo(alsLogo(SVG_MIT_SKRIPT, "image/png")))).toBe("LOGO_INHALT");
    expect(fehlercode(() => pruefeLogo({ typ: "image/png", daten: "nicht base64!" }))).toBe(
      "LOGO_INHALT",
    );
    expect(fehlercode(() => pruefeLogo({ typ: "image/jpeg", daten: "" }))).toBe("LOGO_INHALT");
    expect(fehlercode(() => pruefeLogo(alsLogo(pngLogo(64, 64), "image/jpeg")))).toBe(
      "LOGO_INHALT",
    );
  });

  it("zu klein, zu schmal und zu gross werden mit eigenem Grund abgewiesen", () => {
    expect(fehlercode(() => pruefeLogo(alsLogo(pngLogo(16, 16), "image/png")))).toBe("LOGO_MASSE");
    expect(fehlercode(() => pruefeLogo(alsLogo(pngLogo(400, 40), "image/png")))).toBe(
      "LOGO_FORMAT",
    );
    expect(fehlercode(() => pruefeLogo(alsLogo(jpegKopf(5000, 1000), "image/jpeg")))).toBe(
      "LOGO_MASSE",
    );
    const riesig = Buffer.concat([pngLogo(64, 64), Buffer.alloc(LOGO_GRENZEN.bytes)]);
    expect(fehlercode(() => pruefeLogo(alsLogo(riesig, "image/png")))).toBe("LOGO_ZU_GROSS");
  });
});

const KONTEN = [
  { id: "a", name: "Admin Nordtal", role: "admin" as const, approved: true },
  { id: "e", name: "Erika Nordtal", role: "experte" as const, approved: true },
  { id: "v", name: "Vera Nordtal", role: "viewer" as const, approved: true },
  { id: "w", name: "Wartend", role: "viewer" as const, approved: false },
];

function fassung(nr: number, anforderung: RichtlinienFassung["anforderung"]): RichtlinienFassung {
  return {
    id: "r1",
    fassung: nr,
    titel: "Hausordnung Nordtal",
    text: "Text",
    verantwortlich: "Personalabteilung",
    gueltigAb: "2026-10-09",
    rollen: [],
    anforderung,
    veroeffentlichtVon: "a",
    veroeffentlichtAm: "2026-10-09T08:00:00.000Z",
    aenderungsgrund: null,
  };
}

describe("K3 · Wirkung einer neuen Fassung — vorab sichtbar", () => {
  const handlungen: Handlung[] = [
    { richtlinieId: "r1", fassung: 1, personId: "e", handlung: "kenntnisnahme", am: "x" },
    { richtlinieId: "r1", fassung: 1, personId: "v", handlung: "kenntnisnahme", am: "y" },
  ];

  it("erste Fassung mit Kenntnisnahme: verlangt, nicht „erneut“, freigegebene Konten gezählt", () => {
    const w = berechneWirkung({
      bisher: undefined,
      anforderung: "kenntnisnahme",
      rollen: [],
      konten: KONTEN,
      handlungenBisher: [],
    });
    expect(w).toEqual({
      verlangt: "kenntnisnahme",
      erneut: false,
      betroffen: 3,
      bisherigeFassung: null,
      bisherigeHandlungen: 0,
    });
  });

  it("neue Fassung mit Zustimmung: ERNEUT verlangt, alte Handlungen gezählt, aber nicht übertragen", () => {
    const w = berechneWirkung({
      bisher: fassung(1, "kenntnisnahme"),
      anforderung: "zustimmung",
      rollen: ["experte", "viewer"],
      konten: KONTEN,
      handlungenBisher: handlungen,
    });
    expect(w).toEqual({
      verlangt: "zustimmung",
      erneut: true,
      betroffen: 2,
      bisherigeFassung: 1,
      bisherigeHandlungen: 2,
    });
  });

  it("neue Fassung „nur anzeigen“: keine erneute Handlung", () => {
    const w = berechneWirkung({
      bisher: fassung(1, "zustimmung"),
      anforderung: "anzeige",
      rollen: [],
      konten: KONTEN,
      handlungenBisher: handlungen,
    });
    expect(w.erneut).toBe(false);
    expect(w.verlangt).toBe("anzeige");
  });

  it("eine Fassung ohne Verantwortlichkeit, Datum oder Handlungsart wird nicht angenommen", () => {
    const gut = {
      titel: "Hausordnung Nordtal",
      text: "Bitte Türen schliessen.",
      verantwortlich: "Personalabteilung Nordtal",
      gueltigAb: "2026-10-09",
      rollen: [],
      anforderung: "kenntnisnahme",
    };
    expect(pruefeRichtlinieEingabe(gut)).toEqual(gut);
    expect(fehlercode(() => pruefeRichtlinieEingabe({ ...gut, verantwortlich: "" }))).toBe(
      "VERANTWORTLICH_UNGUELTIG",
    );
    expect(fehlercode(() => pruefeRichtlinieEingabe({ ...gut, gueltigAb: "2026-02-30" }))).toBe(
      "GELTUNG_UNGUELTIG",
    );
    expect(fehlercode(() => pruefeRichtlinieEingabe({ ...gut, rollen: ["chef"] }))).toBe(
      "GELTUNG_UNGUELTIG",
    );
    expect(fehlercode(() => pruefeRichtlinieEingabe({ ...gut, anforderung: "gelesen" }))).toBe(
      "ANFORDERUNG_UNGUELTIG",
    );
  });
});
