// ================================================================================================
// JOB 3063 · H4 — DER ZUSTAND EINES EINTRAGS, DOM-FREI GEPRÜFT.
// ================================================================================================
//
// Punkt-Ton, Segment-Zugehörigkeit und Listenende sind reine Rechnungen (`components/bibliothek/
// zustand.ts`). Sie bekommen ihren eigenen Test, weil die Chromium-Messung darüber nur EINEN Fall
// je Lauf sieht — hier stehen alle sieben Anzeigestatus und beide Segmente vollständig da.
import { describe, expect, it } from "vitest";
import {
  BIB_SEGMENTE,
  BIB_SEGMENT_STANDARD,
  amListenende,
  bibSegmentAus,
  passtZuSegment,
  zustandsTon,
} from "../../apps/web/src/components/bibliothek/zustand";
// Der Typ kommt aus der JSX-freien Typdatei, nicht aus dem Barrel: der Wurzel-Typprüfer ist
// Node-rein (kein DOM, kein JSX) und zöge über `components/trust` sonst die ganze Oberfläche mit.
import type { DisplayStatus } from "../../apps/web/src/components/trust/types";

const ALLE: DisplayStatus[] = [
  "entwurf",
  "offen",
  "pruefung",
  "validiert",
  "abgelehnt",
  "revalidierung",
  "konflikt",
];

describe("JOB 3063 · H4 · der Zustandspunkt", () => {
  it("Z1 · grün gibt es AUSSCHLIESSLICH für den freigegebenen Zustand", () => {
    const gruen = ALLE.filter((s) => zustandsTon(s) === "pos");
    expect(gruen).toEqual(["validiert"]);
  });

  it("Z2 · rot gibt es für abgelehnt und Konflikt — und ein offener Konflikt schlägt jeden anderen Zustand", () => {
    expect(ALLE.filter((s) => zustandsTon(s) === "crit").sort()).toEqual(["abgelehnt", "konflikt"]);
    // Genau der Fall aus der Vorlage: ein freigegebener Eintrag mit Widerspruch ist ROT, nicht grün.
    expect(zustandsTon("validiert", true)).toBe("crit");
    expect(zustandsTon("offen", true)).toBe("crit");
  });

  it("Z3 · alles Übrige ist gelb — kein Zustand bleibt ohne Ton", () => {
    for (const s of ALLE) {
      expect(["pos", "warn", "crit"]).toContain(zustandsTon(s));
    }
    expect(ALLE.filter((s) => zustandsTon(s) === "warn").sort()).toEqual([
      "entwurf",
      "offen",
      "pruefung",
      "revalidierung",
    ]);
  });
});

describe("JOB 3063 · H4 · der Umschalter Alle · Validiert · Offen", () => {
  it("S1 · „Alle“ ist die Vorgabe und lässt jeden Zustand durch", () => {
    expect(BIB_SEGMENT_STANDARD).toBe("alle");
    for (const s of ALLE) {
      expect(passtZuSegment(s, "alle")).toBe(true);
    }
  });

  it("S2 · „Validiert“ ist GENAU der freigegebene Zustand — nichts Halbgares rutscht mit", () => {
    expect(ALLE.filter((s) => passtZuSegment(s, "validiert"))).toEqual(["validiert"]);
  });

  it("S3 · „Offen“ ist die Gegenmenge: alles, was nicht freigegeben ist (auch abgelehnt und Konflikt)", () => {
    expect(ALLE.filter((s) => passtZuSegment(s, "offen")).sort()).toEqual(
      ["abgelehnt", "entwurf", "konflikt", "offen", "pruefung", "revalidierung"].sort(),
    );
  });

  it("S4 · die zwei Segmente teilen den Bestand vollständig und überschneidungsfrei", () => {
    for (const s of ALLE) {
      const treffer = [passtZuSegment(s, "validiert"), passtZuSegment(s, "offen")].filter(Boolean);
      expect(treffer.length, `Zustand ${s} fällt in ${treffer.length} Segmente`).toBe(1);
    }
  });

  it("S5 · die Adresse trägt den Umschalter; ein fremder oder fehlender Wert fällt auf „Alle“ zurück", () => {
    expect(BIB_SEGMENTE).toEqual(["alle", "validiert", "offen"]);
    expect(bibSegmentAus("validiert")).toBe("validiert");
    expect(bibSegmentAus("offen")).toBe("offen");
    // Die schwächere Aussage gewinnt: ein unbekannter Wert filtert NICHT still etwas weg.
    expect(bibSegmentAus("erfunden")).toBe("alle");
    expect(bibSegmentAus(null)).toBe("alle");
  });
});

describe("JOB 3063 · H4 · Nachladen beim Scrollen ans Listenende", () => {
  it("N1 · am Anfang einer langen Liste wird nicht nachgeladen", () => {
    expect(amListenende({ scrollTop: 0, clientHeight: 600, scrollHeight: 4000 })).toBe(false);
  });

  it("N2 · im Vorlauf vor dem Ende wird nachgeladen (die Zeile kommt VOR ihrem Bedarf)", () => {
    expect(amListenende({ scrollTop: 3200, clientHeight: 600, scrollHeight: 4000 })).toBe(true);
  });

  it("N3 · eine Liste, die die Spalte gar nicht füllt, gilt sofort als am Ende", () => {
    expect(amListenende({ scrollTop: 0, clientHeight: 600, scrollHeight: 300 })).toBe(true);
  });

  it("N4 · der Vorlauf ist der einzige Unterschied — mit Vorlauf 0 zählt nur die echte Kante", () => {
    expect(amListenende({ scrollTop: 3200, clientHeight: 600, scrollHeight: 4000 }, 0)).toBe(false);
    expect(amListenende({ scrollTop: 3400, clientHeight: 600, scrollHeight: 4000 }, 0)).toBe(true);
  });
});
