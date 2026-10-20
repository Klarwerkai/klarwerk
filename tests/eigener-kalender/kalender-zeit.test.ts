// ================================================================================================
// AW-16 · K2 — DIE ZEITRECHNUNG DER ANSICHTEN (`apps/web/src/lib/kalenderZeit.ts`).
// ================================================================================================
//
// Tag-, Wochen- und Agendaansicht ordnen jeden Eintrag Kalendertagen zu. Zwei Regeln werden hier
// gemessen: ein Termin mit Uhrzeit fällt auf den Tag SEINER LOKALEN ZEITZONE, und eine ganztägige
// Frist bleibt auf ihrem Datum — gleich, in welcher Zone sie gelesen wird.
import { describe, expect, it } from "vitest";
import {
  isoZuOrtszeit,
  ortszeitZuIso,
  tagVon,
  tageVon,
  uhrzeit,
  verschiebe,
  wocheVon,
  zoneLesbar,
} from "../../apps/web/src/lib/kalenderZeit";

describe("K2 · lokale Zeitzone und ganztägige Fristen", () => {
  it("ein Zeitpunkt fällt auf den Kalendertag seiner Zone", () => {
    const spaet = new Date("2026-10-11T22:30:00Z");
    expect(tagVon(spaet, "Europe/Berlin")).toBe("2026-10-12");
    expect(tagVon(spaet, "America/New_York")).toBe("2026-10-11");
    expect(uhrzeit("2026-10-12T07:00:00.000Z", "Europe/Berlin", "de")).toBe("09:00");
    expect(uhrzeit("2026-12-12T08:00:00.000Z", "Europe/Berlin", "de")).toBe("09:00");
  });

  it("eine ganztägige Frist bleibt in jeder Zone auf ihrem Datum", () => {
    const frist = { ganztaegig: true, beginn: "2026-11-30", ende: null };
    for (const zone of ["Europe/Berlin", "America/New_York", "Pacific/Auckland", "UTC"]) {
      expect(tageVon(frist, zone), zone).toEqual(["2026-11-30"]);
    }
    const spanne = { ganztaegig: true, beginn: "2026-11-29", ende: "2026-12-01" };
    expect(tageVon(spanne, "UTC")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"]);
  });

  it("ein Termin über Mitternacht steht an beiden lokalen Tagen", () => {
    const termin = {
      ganztaegig: false,
      beginn: "2026-10-12T21:30:00.000Z",
      ende: "2026-10-12T23:30:00.000Z",
    };
    expect(tageVon(termin, "Europe/Berlin")).toEqual(["2026-10-12", "2026-10-13"]);
    expect(tageVon(termin, "UTC")).toEqual(["2026-10-12"]);
  });

  it("die Woche läuft von Montag bis Sonntag, auch über Monats- und Zeitumstellungsgrenzen", () => {
    expect(wocheVon("2026-10-14")).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    // 25.10.2026: Ende der Sommerzeit in Europa — die Tagesrechnung bleibt lückenlos.
    expect(wocheVon("2026-10-25")[0]).toBe("2026-10-19");
    expect(verschiebe("2026-10-25", 1)).toBe("2026-10-26");
    expect(verschiebe("2026-10-31", 1)).toBe("2026-11-01");
    expect(verschiebe("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("die Zone steht mit ihrem Kurznamen da — Sommer und Winter unterscheidbar", () => {
    const sommer = zoneLesbar("Europe/Berlin", "de", new Date("2026-07-01T12:00:00Z"));
    const winter = zoneLesbar("Europe/Berlin", "de", new Date("2026-12-01T12:00:00Z"));
    expect(sommer).toMatch(/^Europe\/Berlin \(.+\)$/);
    expect(winter).toMatch(/^Europe\/Berlin \(.+\)$/);
    expect(sommer).not.toBe(winter);
  });

  it("Formularwerte (Ortszeit) und gespeicherte Zeitpunkte (UTC) lassen sich verlustfrei umrechnen", () => {
    const iso = ortszeitZuIso("2026-10-12T09:15");
    expect(iso).not.toBeNull();
    expect(isoZuOrtszeit(iso as string)).toBe("2026-10-12T09:15");
    expect(ortszeitZuIso("")).toBeNull();
  });
});
