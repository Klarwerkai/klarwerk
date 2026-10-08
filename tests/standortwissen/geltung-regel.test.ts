// ================================================================================================
// R-1632 / R-1633 (aufnahme:20260922:gesamt-standortwissen) — DIE GELTUNGSREGEL SELBST.
// ================================================================================================
//
// R-1632: „Wissen kann als ‚Konzern-Standard', ‚Werks-Praxis' oder ‚Schicht-Spezifisch' geführt
// werden. Kollisionen werden als Kontext-Konflikt sauber dargestellt."
// R-1633: „Wenn ein Mitarbeiter aus der Frühschicht fragt, gewichtet KLARWERK Antworten, die aus der
// Frühschicht stammen, höher als solche aus der Nachtschicht — falls relevant."
//
// Geprüft wird die EINE Regel in services/knowledge-object/src/geltung.ts: Normalform (was geführt
// werden kann), Vererbung beim Fragen (wer erbt was) und die Konfliktart einer Kollision.
import { describe, expect, it } from "vitest";
import {
  type KoGeltung,
  geltungFuerFrage,
  geltungsKollision,
  normalizeFragekontext,
  normalizeGeltung,
} from "../../services/knowledge-object";

const KONZERN: KoGeltung = { ebene: "konzern" };
const WERK_NORD: KoGeltung = { ebene: "werk", werk: "Werk Nord" };
const WERK_SUED: KoGeltung = { ebene: "werk", werk: "Werk Süd" };
const FRUEH_NORD: KoGeltung = { ebene: "schicht", werk: "Werk Nord", schicht: "Frühschicht" };
const NACHT_NORD: KoGeltung = { ebene: "schicht", werk: "Werk Nord", schicht: "Nachtschicht" };

describe("R-1632 · drei Ebenen, vollständig oder abgewiesen", () => {
  it("G1 · Konzern-Standard, Werks-Praxis und Schicht-spezifisch werden in Normalform geführt", () => {
    expect(normalizeGeltung({ ebene: "konzern" })).toEqual({ ok: true, geltung: KONZERN });
    expect(normalizeGeltung({ ebene: "werk", werk: "  Werk   Nord " })).toEqual({
      ok: true,
      geltung: WERK_NORD,
    });
    expect(
      normalizeGeltung({ ebene: "schicht", werk: "Werk Nord", schicht: "Frühschicht", rolle: "" }),
    ).toEqual({ ok: true, geltung: FRUEH_NORD });
    // Schicht ohne Werk: gilt in dieser Schicht jedes Werks.
    expect(normalizeGeltung({ ebene: "schicht", schicht: "Nachtschicht" })).toEqual({
      ok: true,
      geltung: { ebene: "schicht", schicht: "Nachtschicht" },
    });
    // `null` entfernt die Angabe.
    expect(normalizeGeltung(null)).toEqual({ ok: true, geltung: undefined });
  });

  it("G2 · unvollständige oder widersprüchliche Angaben werden abgewiesen, nichts geraten", () => {
    for (const roh of [
      { ebene: "werk" },
      { ebene: "werk", werk: "Werk Nord", schicht: "Frühschicht" },
      { ebene: "konzern", werk: "Werk Nord" },
      { ebene: "schicht", werk: "Werk Nord" },
      { ebene: "standort" },
      { ebene: "werk", werk: 7 },
      { ebene: "werk", werk: "x".repeat(81) },
      "werk",
    ]) {
      expect(normalizeGeltung(roh).ok, JSON.stringify(roh)).toBe(false);
    }
  });
});

describe("R-1632 / R-1633 · Vererbung beim Fragen", () => {
  const frueh = { werk: "Werk Nord", schicht: "Frühschicht" };

  it("V1 · eigene Schicht vor eigenem Werk vor Konzern, anderswo ganz hinten — nichts fällt heraus", () => {
    expect(geltungFuerFrage(FRUEH_NORD, frueh)).toEqual({ passung: "eigene_schicht", rang: 3 });
    // Die Werks-Praxis wird von allen Schichten dieses Werks geerbt.
    expect(geltungFuerFrage(WERK_NORD, frueh)).toEqual({ passung: "eigenes_werk", rang: 2 });
    // Der Konzern-Standard wird überall geerbt.
    expect(geltungFuerFrage(KONZERN, frueh)).toEqual({ passung: "konzern", rang: 1 });
    expect(geltungFuerFrage(undefined, frueh)).toEqual({ passung: "unbestimmt", rang: 1 });
    expect(geltungFuerFrage(NACHT_NORD, frueh)).toEqual({ passung: "andere", rang: 0 });
    expect(geltungFuerFrage(WERK_SUED, frueh)).toEqual({ passung: "andere", rang: 0 });
  });

  it("V2 · Schreibweise zählt nicht; was der Kontext nicht nennt, ist nicht zuzuordnen", () => {
    expect(
      geltungFuerFrage(FRUEH_NORD, { werk: "werk nord", schicht: "FRÜHSCHICHT" }).passung,
    ).toBe("eigene_schicht");
    expect(geltungFuerFrage(WERK_NORD, { schicht: "Frühschicht" }).passung).toBe("unbestimmt");
    expect(geltungFuerFrage(FRUEH_NORD, { werk: "Werk Nord" }).passung).toBe("unbestimmt");
  });

  it("V3 · die Rolle filtert auf jeder Ebene", () => {
    const instandhaltung: KoGeltung = { ...WERK_NORD, rolle: "Instandhaltung" };
    expect(
      geltungFuerFrage(instandhaltung, { werk: "Werk Nord", rolle: "Bedienung" }).passung,
    ).toBe("andere");
    expect(
      geltungFuerFrage(instandhaltung, { werk: "Werk Nord", rolle: "Instandhaltung" }).passung,
    ).toBe("eigenes_werk");
    // Ein Punkt ohne Rolle gilt für jede Rolle.
    expect(geltungFuerFrage(WERK_NORD, { werk: "Werk Nord", rolle: "Bedienung" }).passung).toBe(
      "eigenes_werk",
    );
  });

  it("V4 · ein leerer Fragekontext ist keiner; ein ungültiger ist null", () => {
    expect(normalizeFragekontext({ werk: " ", schicht: "" })).toBeUndefined();
    expect(normalizeFragekontext(undefined)).toBeUndefined();
    expect(normalizeFragekontext({ schicht: " Frühschicht " })).toEqual({ schicht: "Frühschicht" });
    expect(normalizeFragekontext({ werk: 3 })).toBeNull();
    expect(normalizeFragekontext([])).toBeNull();
  });
});

describe("R-1632 / R-1633 · Kollision → Kontext- oder Rollenkonflikt", () => {
  it("K1 · anderer Ort ist ein Kontextkonflikt und nennt beide Geltungen", () => {
    const k = geltungsKollision(WERK_NORD, KONZERN);
    expect(k?.art).toBe("context");
    expect(k?.vermerk).toContain("Werks-Praxis (Werk Nord)");
    expect(k?.vermerk).toContain("Konzern-Standard");
    expect(geltungsKollision(FRUEH_NORD, NACHT_NORD)?.art).toBe("context");
    expect(geltungsKollision(WERK_NORD, WERK_SUED)?.art).toBe("context");
  });

  it("K2 · gleicher Ort, andere Rolle ist ein Rollenkonflikt", () => {
    expect(
      geltungsKollision(
        { ...WERK_NORD, rolle: "Instandhaltung" },
        { ...WERK_NORD, rolle: "Bedienung" },
      )?.art,
    ).toBe("role");
    expect(geltungsKollision({ ...WERK_NORD, rolle: "Instandhaltung" }, WERK_NORD)?.art).toBe(
      "role",
    );
  });

  it("K3 · gleicher Ort und gleiche Rolle, oder eine Seite ohne Angabe: keine Umdeutung", () => {
    expect(geltungsKollision(WERK_NORD, { ebene: "werk", werk: "werk nord" })).toBeNull();
    expect(geltungsKollision(WERK_NORD, undefined)).toBeNull();
    expect(geltungsKollision(undefined, undefined)).toBeNull();
  });
});
