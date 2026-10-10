// ================================================================================================
// produkt:20261010:fragen-pruefen-einstieg — DIE REINEN ABLEITUNGEN (K1, K2, K4, K5).
// ================================================================================================
//
//   E1  Der Einstieg steht nur auf der LEEREN Fläche — jede Antwort, jeder Abruf, jeder Fehler, ein
//       Gesprächsfaden oder aufgenommene Arbeit nimmt ihn weg (dann trägt der Antwortvertrag den
//       einen nächsten Schritt).
//   E2  Fiktiv sind genau die festen Beispiele; Bestandsvorschläge nicht.
//   P1  Warum der Eintrag hier liegt: mir zugewiesen / anderen zugewiesen / offen.
//   P2  Was zu prüfen ist: Überarbeitung und Autor-Übertragung nutzen den vorhandenen Fokussatz.
//   P3  Wirkung mit den tatsächlichen Stimmen; seltsame Werte fallen defensiv aus.
//   T1  Alle neuen Texte stehen in DE, EN und NL; keiner beginnt mit „Nächster Schritt:".
import { describe, expect, it } from "vitest";
import { type AskExampleChip, buildAskExampleChips } from "../../apps/web/src/lib/askExampleChips";
import {
  FRAGEN_EINSTIEG_KEYS,
  beispielIstFiktiv,
  hatFiktiveBeispiele,
  zeigeFragenEinstieg,
} from "../../apps/web/src/lib/fragenEinstieg";
import { pruefGrund } from "../../apps/web/src/lib/pruefGrund";
import { sprachbestand } from "../support/i18nBestand";

const LEER = {
  hatErgebnis: false,
  wartet: false,
  fehler: false,
  fadenLaenge: 0,
  wiederaufnahme: false,
};

describe("E1 · der Einstieg steht nur auf der leeren Fläche", () => {
  it("leer → sichtbar", () => {
    expect(zeigeFragenEinstieg(LEER)).toBe(true);
  });
  const faelle: Array<[string, Partial<typeof LEER>]> = [
    ["Ergebnis", { hatErgebnis: true }],
    ["Abruf", { wartet: true }],
    ["Fehler", { fehler: true }],
    ["Faden", { fadenLaenge: 1 }],
    ["Wiederaufnahme", { wiederaufnahme: true }],
  ];
  it.each(faelle)("%s → kein Einstieg", (_name, aenderung) => {
    expect(zeigeFragenEinstieg({ ...LEER, ...aenderung })).toBe(false);
  });
});

describe("E2 · fiktiv sind genau die festen Beispiele", () => {
  it("ohne validierten Bestand: alle Chips sind feste Beispiele und fiktiv", () => {
    const chips = buildAskExampleChips([]);
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.every(beispielIstFiktiv)).toBe(true);
    expect(hatFiktiveBeispiele(chips)).toBe(true);
  });
  it("Bestandsvorschläge sind nicht fiktiv, die Lücken-Frage schon", () => {
    const ko: AskExampleChip = { kind: "ko", title: "Druck am Ventil prüfen" };
    const luecke: AskExampleChip = {
      kind: "example",
      questionKey: "beispielfragen.pflege",
      expectation: "gap",
    };
    expect(beispielIstFiktiv(ko)).toBe(false);
    expect(beispielIstFiktiv(luecke)).toBe(true);
    expect(hatFiktiveBeispiele([ko])).toBe(false);
  });
});

const BASIS = {
  kind: "new" as const,
  version: 1,
  authorTransferred: false,
  zugewiesen: [] as string[],
  ich: "u1",
  greenVotes: 0,
  needed: 2,
};

describe("P1 · warum der Eintrag hier liegt", () => {
  it("mir zugewiesen", () => {
    expect(pruefGrund({ ...BASIS, zugewiesen: ["u2", "u1"] }).warum).toEqual({
      key: "pruefgrund.warum.mir",
      params: {},
    });
  });
  it("anderen zugewiesen — mit Anzahl, leere Kennungen zählen nicht", () => {
    expect(pruefGrund({ ...BASIS, zugewiesen: ["u2", " ", "u3"] }).warum).toEqual({
      key: "pruefgrund.warum.andere",
      params: { anzahl: 2 },
    });
  });
  it("niemandem zugewiesen — offen; ohne bekannte Kennung nie „mir“", () => {
    expect(pruefGrund(BASIS).warum.key).toBe("pruefgrund.warum.offen");
    expect(pruefGrund({ ...BASIS, ich: null, zugewiesen: ["u1"] }).warum.key).toBe(
      "pruefgrund.warum.andere",
    );
  });
});

describe("P2 · was zu prüfen ist", () => {
  it("neu: die Erstbewertungs-Zeile", () => {
    const g = pruefGrund(BASIS);
    expect(g.anlassKey).toBe("pruefgrund.anlass.new");
    expect(g.wasKey).toBe("val.reviewContext.hint.new");
  });
  it("überarbeitet: Fokus auf die Änderung, mit Fassung", () => {
    const g = pruefGrund({ ...BASIS, kind: "revision", version: 3, authorTransferred: true });
    expect(g.anlassKey).toBe("pruefgrund.anlass.revision");
    expect(g.version).toBe(3);
    expect(g.wasKey).toBe("val.guide.focus.revision");
  });
  it("Autor übertragen: genauer Blick auf Aussage und Belege", () => {
    expect(pruefGrund({ ...BASIS, authorTransferred: true }).wasKey).toBe(
      "val.guide.focus.transfer",
    );
  });
});

describe("P3 · Wirkung mit den tatsächlichen Stimmen", () => {
  it("nennt vorhandene und nötige Stimmen", () => {
    expect(pruefGrund({ ...BASIS, greenVotes: 1, needed: 3 }).wirkung).toEqual({
      key: "pruefgrund.wirkung",
      params: { have: 1, need: 3 },
    });
  });
  it("seltsame Werte fallen defensiv aus", () => {
    const g = pruefGrund({ ...BASIS, version: Number.NaN, greenVotes: -2, needed: 0 });
    expect(g.version).toBe(1);
    expect(g.wirkung.params).toEqual({ have: 0, need: 1 });
  });
});

describe("T1 · Texte in DE, EN und NL", () => {
  const neu = [
    ...Object.values(FRAGEN_EINSTIEG_KEYS),
    "pruefgrund.label.warum",
    "pruefgrund.label.was",
    "pruefgrund.label.wirkung",
    "pruefgrund.label.sichtbar",
    "pruefgrund.anlass.new",
    "pruefgrund.anlass.revision",
    "pruefgrund.warum.mir",
    "pruefgrund.warum.andere",
    "pruefgrund.warum.offen",
    "pruefgrund.wirkung",
  ];
  it.each(["de", "en", "nl"] as const)("%s: jeder neue Schlüssel hat einen Text", (sprache) => {
    const dict = sprachbestand(sprache);
    const fehlend = neu.filter((k) => (dict[k] ?? "").trim().length === 0);
    expect(fehlend).toEqual([]);
  });
  it("kein neuer Text beginnt mit „Nächster Schritt:“ (mega54)", () => {
    const de = sprachbestand("de");
    expect(neu.filter((k) => /^Nächster Schritt:/.test(de[k] ?? ""))).toEqual([]);
  });
  it("die Wirkungszeile nennt beide Stimmenwerte in jeder Sprache", () => {
    for (const sprache of ["de", "en", "nl"] as const) {
      const text = sprachbestand(sprache)["pruefgrund.wirkung"] ?? "";
      const traegt = text.includes("{{have}}") && text.includes("{{need}}");
      expect({ sprache, traegt }).toEqual({ sprache, traegt: true });
    }
  });
});
