// ================================================================================================
// JOB B4-INSEL-RELEASE · RUNDE 2 — GEGENPROBEN ZUM BESTANDSURTEIL, im gewöhnlichen Tor.
// ================================================================================================
//
// Bens Befund (Runde 1): ein Befund mit NUR dem Dokumentsatz und leerem Titel ergab `maengel=[]`.
// Genau dieser Befund und seine Verwandten werden hier dem Urteil vorgelegt. Die echte Strecke
// (`release-update-rueckfall.integration.test.ts`, G1) misst dasselbe zusätzlich am laufenden Paket.
import { describe, expect, it } from "vitest";
import {
  ABSATZTEXTE,
  type Bestandsbefund,
  type Bestandserwartung,
  DOKUMENTSATZ,
  ERSTER_SATZ,
  ZWEITER_SATZ,
  bestandsmaengel,
  bestandsvergleich,
} from "./bestand";

const ERWARTUNG: Bestandserwartung = {
  quellenzeile: "Quelle: inselprobe-stellwerk.docx, gesamtes Dokument",
  dateiSha256: "a".repeat(64),
};

const VOLL: Bestandsbefund = {
  adresse: "http://127.0.0.1:1/wissen/x",
  angemeldet: true,
  titel: "inselprobe-stellwerk",
  text: `${ERWARTUNG.quellenzeile} ${ABSATZTEXTE.join(" ")} inselprobe-stellwerk.docx`,
  quelle: ERWARTUNG.quellenzeile,
  originalHref: "/api/objects/1/raw",
  download: { name: "inselprobe-stellwerk.docx", sha256: ERWARTUNG.dateiSha256, bytes: 1 },
  downloadFehler: "",
  inselmarke: "KW-MAC-ISLAND-03",
};

describe("JOB B4-INSEL-RELEASE · das Bestandsurteil verlangt den VOLLSTÄNDIGEN Eintrag", () => {
  it("B1 · der vollständige Befund ist ohne Mangel und gleich sich selbst", () => {
    expect(bestandsmaengel(VOLL, ERWARTUNG)).toEqual([]);
    expect(bestandsvergleich(VOLL, { ...VOLL, inselmarke: "andere Fassung" })).toEqual([]);
  });

  it("B2 · Bens Gegenprobe: nur der Dokumentsatz und leerer Titel schlagen an", () => {
    const duenn = { ...VOLL, titel: "", text: DOKUMENTSATZ };
    const maengel = bestandsmaengel(duenn, ERWARTUNG);
    expect(maengel).toContain("Titel: leer");
    expect(maengel).toContain(`Inhalt: der Absatz «${ERSTER_SATZ}» fehlt im Rumpf`);
    expect(maengel).toContain(`Inhalt: der Absatz «${ZWEITER_SATZ}» fehlt im Rumpf`);
  });

  it("B3 · fehlt EIN anderer Absatz, schlagen Urteil UND Vergleich mit K2 an", () => {
    for (const fehlend of [ERSTER_SATZ, ZWEITER_SATZ]) {
      const lueckig = { ...VOLL, text: VOLL.text.replace(fehlend, "") };
      expect(bestandsmaengel(lueckig, ERWARTUNG)).toEqual([
        `Inhalt: der Absatz «${fehlend}» fehlt im Rumpf`,
      ]);
      expect(bestandsvergleich(VOLL, lueckig).some((u) => u.startsWith("Rumpftext:"))).toBe(true);
    }
  });

  it("B4 · ein veränderter oder zusätzlicher Text, anderer Titel oder andere Datei fällt im Vergleich auf", () => {
    expect(bestandsvergleich(VOLL, { ...VOLL, text: `${VOLL.text} Zusatz` })).toHaveLength(1);
    expect(bestandsvergleich(VOLL, { ...VOLL, titel: "anders" })).toHaveLength(1);
    expect(
      bestandsvergleich(VOLL, {
        ...VOLL,
        download: { name: "x.docx", sha256: "b".repeat(64), bytes: 1 },
      }),
    ).toHaveLength(1);
    expect(bestandsvergleich(VOLL, { ...VOLL, download: null })).toHaveLength(1);
  });

  it("B5 · fehlende Datei und fehlender Quellenvermerk bleiben Mängel", () => {
    const maengel = bestandsmaengel(
      { ...VOLL, quelle: "", download: null, downloadFehler: "GET → HTTP 404" },
      ERWARTUNG,
    );
    expect(maengel.some((m) => m.startsWith("Quellenbezug:"))).toBe(true);
    expect(maengel).toContain("Originaldatei: GET → HTTP 404");
  });
});
