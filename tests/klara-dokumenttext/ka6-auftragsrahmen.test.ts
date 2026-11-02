import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decktAlleFragebegriffe, undVerknuepfteFragebegriffe } from "../../services/reasoner";

const fenster = readFileSync(
  resolve(process.cwd(), "apps/web/public/word-addin/taskpane.js"),
  "utf8",
);
const katalog = fenster.slice(
  fenster.indexOf("var KA6_TEXTE = {"),
  fenster.indexOf("\n    };", fenster.indexOf("var KA6_TEXTE = {")),
);
const auftraege = ["de", "en", "nl"].flatMap((sprache) => {
  const block = katalog.match(new RegExp(`\\b${sprache}: \\{([\\s\\S]*?)\\n\\s*\\}`))?.[1];
  if (!block) throw new Error(`KA6-Produktkatalog fehlt: ${sprache}`);
  return ["ka6AuftragErstellen", "ka6AuftragVervollstaendigen", "ka6AuftragUmformulieren"].map(
    (schluessel) => {
      const literal = block.match(new RegExp(`${schluessel}:\\s*("(?:\\\\.|[^"\\\\])*")`))?.[1];
      if (!literal) throw new Error(`KA6-Produktauftrag fehlt: ${schluessel}`);
      return JSON.parse(literal) as string;
    },
  );
});
const FRAGE = "Welche Temperatur gilt für das Ventil F3?";
const VOLL = "Die Temperatur am Ventil F3 liegt bei 80 Grad.";
const ANKER = "Welcher Druck gilt für die Pumpe P8?";
const MIT_ANKER = `${VOLL} Der Druck an der Pumpe P8 liegt bei 5 bar.`;

describe("B3 · feste KA6-Auftragspräfixe", () => {
  it("B3a · alle neun echten Katalogaufträge binden genau den vollständigen Sachrest", () => {
    expect(auftraege).toHaveLength(9);
    expect(new Set(auftraege).size).toBe(9);
    for (const auftrag of auftraege) {
      expect(auftrag.endsWith(":"), auftrag).toBe(true);
      expect(undVerknuepfteFragebegriffe(`${auftrag} ${FRAGE}`), auftrag).toEqual(
        undVerknuepfteFragebegriffe(FRAGE),
      );
      expect(decktAlleFragebegriffe(`${auftrag} ${FRAGE}`, VOLL), auftrag).toBe(true);
    }
  });

  it("B3b · Sachbegriff, Objektkennung und eigenständiger Anker bleiben hinter jedem Auftrag gebunden", () => {
    for (const auftrag of auftraege) {
      const frage = `${auftrag} ${FRAGE}`;
      expect(decktAlleFragebegriffe(frage, VOLL), auftrag).toBe(true);
      expect(decktAlleFragebegriffe(frage, "Das Ventil F3 wird jährlich gewartet."), auftrag).toBe(
        false,
      );
      expect(
        decktAlleFragebegriffe(frage, "Die Temperatur am Ventil F4 ist 80 Grad."),
        auftrag,
      ).toBe(false);
      expect(
        decktAlleFragebegriffe(frage, VOLL) && decktAlleFragebegriffe(ANKER, VOLL),
        auftrag,
      ).toBe(false);
      expect(
        decktAlleFragebegriffe(frage, MIT_ANKER) &&
          decktAlleFragebegriffe(`${auftrag} ${ANKER}`, MIT_ANKER),
        auftrag,
      ).toBe(true);
      expect(decktAlleFragebegriffe(`${auftrag} ${ANKER}`, `${VOLL} Druck Pumpe P9`), auftrag).toBe(
        false,
      );
    }
  });

  it("B3c · gewöhnliche, zitierte, mittige und nur ähnliche Auftragswörter bleiben Sachinhalt", () => {
    for (const auftrag of auftraege) {
      for (const frage of [
        `"${auftrag}" ${FRAGE}`,
        `${FRAGE.slice(0, -1)} ${auftrag}`,
        `${auftrag.slice(0, -1)} ${FRAGE}`,
        `${auftrag.slice(0, -1)} jetzt: ${FRAGE}`,
        `${auftrag.toLowerCase()} ${FRAGE}`,
      ]) {
        expect(decktAlleFragebegriffe(frage, VOLL), frage).toBe(false);
        expect(undVerknuepfteFragebegriffe(frage), frage).not.toEqual(
          undVerknuepfteFragebegriffe(FRAGE),
        );
      }
    }
  });

  it("B3d · leerer oder verschachtelter Auftrag erzeugt keine sachlich ungebundene Freigabe", () => {
    for (const auftrag of auftraege) {
      for (const rest of ["", " \t\n", "?", "..."]) {
        const frage = auftrag + rest;
        expect(undVerknuepfteFragebegriffe(frage).length, frage).toBeGreaterThan(0);
        expect(decktAlleFragebegriffe(frage, ""), frage).toBe(false);
        expect(decktAlleFragebegriffe(frage, VOLL), frage).toBe(false);
      }
      for (const zweiter of auftraege) {
        const frage = `${auftrag} ${zweiter} ${FRAGE}`;
        expect(decktAlleFragebegriffe(frage, VOLL), frage).toBe(false);
      }
    }
  });
});
