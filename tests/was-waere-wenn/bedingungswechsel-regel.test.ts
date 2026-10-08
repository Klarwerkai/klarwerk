// ================================================================================================
// R-1628 — „WENN ICH STATT 5083-H111 JETZT 6082-T6 VERWENDE — WELCHE BESTEHENDEN ERFAHRUNGSWERTE
// GELTEN DANN NOCH, WELCHE NICHT?" — DIE REGEL.
// ================================================================================================
//
// Geprüft wird die eine Regel in `apps/web/src/lib/bedingungswechsel.ts` mit dem Beispiel der Quelle.
//
//   W1  Der Wechsel der Quelle: gebunden (nur bisher), beide, nur neu — je mit Fundort und Wortlaut;
//       was keine nennt, wird ohne Thema nur gezählt.
//   W2  Mit Thema: eingegrenzt, und „nennt keine" steht einzeln da — ausdrücklich nicht „übertragbar".
//   W3  Wortgrenze, Gross-/Kleinschreibung und Leerraum: „5083" trifft nicht „50830".
//   W4  Unvollständig oder gleich: nichts wird verglichen, nichts geraten.
//   W5  Lange Aussage: der Ausschnitt trägt den Treffer.
//   W6  Vorschläge: die Bedingungen des Bestands, ohne Doppel, sortiert.
//
// Nacharbeit 1 (Ben: „Gilt für 5083-H111, nicht für 6082-T6" landete unter „übertragbar belegt"):
//   W7  Bens Fall und weitere Ausschlussformen → `neu_ausgeschlossen`, nie `beide`.
//   W8  Verneinte HANDLUNG ist kein Ausschluss: „Bei 5083-H111 nicht überhitzen" bleibt gebunden.
//   W9  Genannt, aber nicht tragfähig gemeinsam belegt → `ungeklaert`: getrennte Sätze, Gegensatz,
//       nur Titel/Schlagwort, Einschränkung „nur"; bisherige ausgeschlossen ohne neue.
//   W10 `beide` nur mit gemeinsamem Beleg: beide als Bedingung oder im selben Satzteil ohne Vorbehalt.
//   W11 Die Frage für das Durchspielen mit der KI trägt den Wechsel (und das Thema) wörtlich.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import {
  type BedingungsLage,
  bedingungsFrage,
  bedingungsVorschlaege,
  fundstelle,
  vergleicheBedingungen,
} from "../../apps/web/src/lib/bedingungswechsel";

function ko(over: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Titel",
    statement: "",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Schweißen",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    history: [],
    sources: [],
    ...over,
  } as KnowledgeObject;
}

const BESTAND: KnowledgeObject[] = [
  ko({
    id: "gebunden",
    title: "Vorwärmen vor dem Schweißen",
    statement: "Vor dem Schweißen auf 80 Grad vorwärmen.",
    conditions: ["Werkstoff 5083-H111"],
  }),
  ko({
    id: "beide",
    title: "Schutzgas Argon",
    statement: "Als Schutzgas reines Argon verwenden.",
    conditions: ["5083-H111", "6082-T6"],
  }),
  ko({
    id: "neu",
    title: "Nahtvorbereitung",
    statement: "Bei 6082-T6 die Kanten vor dem Schweißen entgraten.",
  }),
  ko({
    id: "ohne",
    title: "Schweißnaht reinigen",
    statement: "Nach dem Schweißen die Naht bürsten.",
  }),
  ko({
    id: "fremd",
    title: "Kaffeeküche",
    statement: "Milch nachfüllen.",
    category: "Allgemein",
  }),
];

describe("R-1628 · Bedingungswechsel — die Regel", () => {
  it("W1 · statt 5083-H111 jetzt 6082-T6: gebunden, beide, nur neu — mit Fundstelle", () => {
    const r = vergleicheBedingungen(BESTAND, { bisher: "5083-H111", neu: "6082-T6" });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    const v = r.vergleich;
    expect(v.gruppen.nur_bisher.map((e) => e.id)).toEqual(["gebunden"]);
    expect(v.gruppen.nur_bisher[0]?.bisher).toEqual({
      fundort: "bedingung",
      text: "Werkstoff 5083-H111",
      bewertung: "gilt",
    });
    expect(v.gruppen.nur_bisher[0]?.neu).toBeNull();
    expect(v.gruppen.beide.map((e) => e.id)).toEqual(["beide"]);
    expect(v.gruppen.nur_neu.map((e) => e.id)).toEqual(["neu"]);
    expect(v.gruppen.nur_neu[0]?.neu?.fundort).toBe("aussage");
    // Ohne Thema: „nennt keine" wird gezählt, nicht gelistet.
    expect(v.gruppen.keine).toEqual([]);
    expect(v.ohneNennungAnzahl).toBe(2);
  });

  it("W2 · mit Thema: was keine nennt, steht einzeln — nicht als „übertragbar“", () => {
    const r = vergleicheBedingungen(BESTAND, {
      bisher: "5083-H111",
      neu: "6082-T6",
      thema: "schweiß",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    const v = r.vergleich;
    expect(v.thema).toBe("schweiß");
    expect(v.gruppen.keine.map((e) => e.id)).toEqual(["ohne"]);
    expect(v.gruppen.keine[0]?.lage).toBe("keine");
    expect(v.gruppen.keine[0]?.bisher).toBeNull();
    expect(v.gruppen.keine[0]?.neu).toBeNull();
    // Die Kaffeeküche gehört nicht zum Thema und wird auch nicht gezählt.
    expect(v.ohneNennungAnzahl).toBe(1);
    const alle = Object.values(v.gruppen).flatMap((g) => g.map((e) => e.id));
    expect(alle).not.toContain("fremd");
  });

  it("W3 · Wortgrenze, Gross-/Kleinschreibung und Leerraum", () => {
    const k = ko({ conditions: ["Legierung 50830"], statement: "Gilt für  6082-t6 ebenso." });
    expect(fundstelle(k, "5083")).toBeNull();
    expect(fundstelle(k, " 6082-T6 ")).toEqual({
      fundort: "aussage",
      text: "Gilt für 6082-t6 ebenso.",
      bewertung: "gilt",
    });
    expect(fundstelle(ko({ tags: ["AlMg4,5Mn"] }), "almg4,5mn")?.fundort).toBe("schlagwort");
    expect(fundstelle(ko({ title: "Werkstoff 5083" }), "5083")?.fundort).toBe("titel");
  });

  it("W4 · unvollständig oder gleich: kein Vergleich", () => {
    expect(vergleicheBedingungen(BESTAND, { bisher: "5083-H111", neu: "  " })).toEqual({
      ok: false,
      grund: "unvollstaendig",
    });
    expect(vergleicheBedingungen(BESTAND, { bisher: "", neu: "6082-T6" })).toEqual({
      ok: false,
      grund: "unvollstaendig",
    });
    expect(vergleicheBedingungen(BESTAND, { bisher: "6082-t6", neu: " 6082-T6" })).toEqual({
      ok: false,
      grund: "gleich",
    });
  });

  it("W5 · lange Aussage: der Ausschnitt trägt den Treffer", () => {
    const lang = `${"Vorlauf ".repeat(40)}bei 6082-T6 gilt das ebenso ${"Nachlauf ".repeat(40)}`;
    const f = fundstelle(ko({ statement: lang }), "6082-T6");
    expect(f?.fundort).toBe("aussage");
    expect(f?.text).toContain("6082-T6");
    expect(f?.text.startsWith("…")).toBe(true);
    expect(f?.text.endsWith("…")).toBe(true);
    expect((f?.text.length ?? 0) <= 162).toBe(true);
  });

  it("W6 · Vorschläge aus den Bedingungen des Bestands", () => {
    const vorschlaege = bedingungsVorschlaege([
      ...BESTAND,
      ko({ conditions: ["5083-h111", "  Werkstoff   5083-H111 "] }),
    ]);
    expect(vorschlaege).toEqual(["5083-H111", "6082-T6", "Werkstoff 5083-H111"]);
  });
});

/** Die Lage eines einzelnen Objekts für den Wechsel der Quelle. */
const WECHSEL = { bisher: "5083-H111", neu: "6082-T6" };

function lage(over: Partial<KnowledgeObject>): BedingungsLage | undefined {
  const r = vergleicheBedingungen([ko({ id: "x", ...over })], WECHSEL);
  if (!r.ok) {
    return undefined;
  }
  const treffer = Object.values(r.vergleich.gruppen).flat();
  return treffer[0]?.lage ?? (r.vergleich.ohneNennungAnzahl === 1 ? "keine" : undefined);
}

describe("R-1628 · Nacharbeit 1 — Fund ist nicht Geltung", () => {
  it("W7 · Bens Fall „nicht für 6082-T6“: ausgeschlossen, nie übertragbar", () => {
    const ben = ko({ id: "ben", statement: "Gilt für 5083-H111, nicht für 6082-T6." });
    const r = vergleicheBedingungen([ben], WECHSEL);
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.vergleich.gruppen.beide).toEqual([]);
    const e = r.vergleich.gruppen.neu_ausgeschlossen[0];
    expect(e?.id).toBe("ben");
    expect(e?.neu).toEqual({
      fundort: "aussage",
      text: "Gilt für 5083-H111, nicht für 6082-T6.",
      bewertung: "ausgeschlossen",
    });
    expect(e?.bisher?.bewertung).toBe("gilt");

    // Weitere Ausschlussformen — vor und nach dem Begriff, auch als Bedingung, auch Englisch.
    for (const statement of [
      "Gilt für 5083-H111 und nicht für 6082-T6.",
      "Bewährt bei 5083-H111; außer bei 6082-T6.",
      "Für 5083-H111 erprobt. 6082-T6 ist ungeeignet.",
      "Für 5083-H111 erprobt. 6082-T6 nicht verwenden.",
      "Für 5083-H111 erprobt, für 6082-T6 nicht.",
      "Proven for 5083-H111, not for 6082-T6.",
    ]) {
      expect(lage({ statement }), statement).toBe("neu_ausgeschlossen");
    }
    expect(lage({ conditions: ["5083-H111", "nicht für 6082-T6"] })).toBe("neu_ausgeschlossen");
    expect(lage({ conditions: ["ohne 6082-T6"] })).toBe("neu_ausgeschlossen");
  });

  it("W8 · eine verneinte Handlung schließt die Bedingung nicht aus", () => {
    expect(lage({ statement: "Bei 5083-H111 nicht überhitzen." })).toBe("nur_bisher");
    const handlung = ko({ statement: "Bei 5083-H111 nicht überhitzen." });
    expect(fundstelle(handlung, "5083-H111")).toEqual({
      fundort: "aussage",
      text: "Bei 5083-H111 nicht überhitzen.",
      bewertung: "vorbehalt",
    });
    expect(lage({ statement: "Bei 6082-T6 nicht überhitzen." })).toBe("nur_neu");
  });

  it("W9 · genannt, aber nicht gemeinsam tragfähig belegt → ungeklärt", () => {
    for (const statement of [
      // Getrennte Sätze mit verschiedenen Werten — das ist keine Übertragbarkeit.
      "Für 5083-H111 auf 80 Grad vorwärmen. Für 6082-T6 auf 120 Grad vorwärmen.",
      // Gegensatz im selben Satzteil.
      "Anders als bei 5083-H111 gilt für 6082-T6 eine längere Haltezeit.",
      // Einschränkung.
      "Nur für 5083-H111 und 6082-T6 im Versuch erprobt.",
      // Ersetzung.
      "6082-T6 statt 5083-H111 verwenden.",
    ]) {
      expect(lage({ statement }), statement).toBe("ungeklaert");
    }
    // Nur im Titel oder Schlagwort genannt: erwähnt, nicht festgehalten.
    expect(lage({ title: "5083-H111 und 6082-T6" })).toBe("ungeklaert");
    expect(lage({ tags: ["5083-H111", "6082-T6"] })).toBe("ungeklaert");
    // Bisherige ausgeschlossen, neue nicht genannt: über die neue sagt das Objekt nichts.
    expect(lage({ statement: "Nicht für 5083-H111 geeignet." })).toBe("ungeklaert");
    // Bisherige ausgeschlossen, neue genannt: festgehalten für die neue.
    expect(lage({ statement: "Gilt für 6082-T6, nicht für 5083-H111." })).toBe("nur_neu");
  });

  it("W10 · übertragbar belegt nur mit gemeinsamem Beleg ohne Vorbehalt", () => {
    expect(lage({ conditions: ["5083-H111", "6082-T6"] })).toBe("beide");
    expect(lage({ statement: "Gilt für 5083-H111 und 6082-T6 gleichermaßen." })).toBe("beide");
    expect(lage({ conditions: ["Werkstoff 5083-H111 oder 6082-T6"] })).toBe("beide");
    // Eine Bedingung und ein getrennter Aussagesatz genügen nicht.
    const getrennt = { conditions: ["5083-H111"], statement: "Bei 6082-T6 ebenso." };
    expect(lage(getrennt)).toBe("ungeklaert");
  });

  it("W11 · die Frage für die KI trägt den Wechsel wörtlich", () => {
    const aufrufe: [string, Record<string, unknown>][] = [];
    const t = (key: string, opts?: Record<string, unknown>): string => {
      aufrufe.push([key, opts ?? {}]);
      return key;
    };
    expect(bedingungsFrage({ bisher: "5083-H111", neu: "6082-T6", thema: "" }, t)).toBe(
      "bedingungswechsel.ki.frage",
    );
    expect(bedingungsFrage({ bisher: "5083-H111", neu: "6082-T6", thema: "Naht" }, t)).toBe(
      "bedingungswechsel.ki.frageThema",
    );
    expect(aufrufe).toEqual([
      ["bedingungswechsel.ki.frage", { bisher: "5083-H111", neu: "6082-T6" }],
      ["bedingungswechsel.ki.frageThema", { bisher: "5083-H111", neu: "6082-T6", thema: "Naht" }],
    ]);
  });
});
