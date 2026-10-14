/**
 * Auftrag aufnahme:20260922:gesamt-pruefdienst — die offenen Härtungen der EINEN Leseregel für
 * Prüfurteile (`tools/urteilslage.ts`, weitergereicht durch `tools/schon-eingebaut.ts`).
 *
 * Je Fall ist der Originalpunkt genannt. Die Vorlagen sind aus dem Wortlaut dieser Punkte gebaut,
 * nicht aus dem Postfach kopiert: Das Postfach liegt außerhalb dieses Arbeitsbaums. Wörtlich
 * übernommen ist der Satz aus R-1486 („PRODUKTWRITES: 0 ist hier ausdruecklich das Versagen").
 */

import { describe, expect, it } from "vitest";
import { echteWrites, erklaertNullWrites, urteilVon } from "../../tools/schon-eingebaut";
import {
  gesamturteil,
  hatSachurteil,
  hatZustellsperre,
  istTeilurteil,
  ohneCodebloecke,
  sperrzeilen,
} from "../../tools/urteilslage";

const ALT = "a".repeat(64);
const NEU = "b".repeat(64);

describe("R-1231 (a) — eine Dimensionszeile ersetzt kein fehlendes Gesamturteil", () => {
  it("PRODUKT und FORM ohne GESAMTURTEIL-Zeile sind kein Urteil", () => {
    const text = ["PRODUKT: ROT — Der Stand trägt die Änderung nicht.", "FORM: GRÜN"].join("\n");
    expect(gesamturteil(text)).toBeNull();
    expect(hatSachurteil("BEN-PRUEFUNG-JOB-1-D1.md", text)).toBe(false);
    expect(urteilVon("BEN-PRUEFUNG-JOB-1-D1.md", text)).toEqual({
      sachurteil: false,
      spruch: null,
      produkt: null,
    });
  });

  it("das Wort GESAMTURTEIL in der Prosa ist kein Urteil", () => {
    const text = [
      "Das GESAMTURTEIL: GRÜN des Vorgängers gilt hier nicht.",
      "GESAMTURTEIL fehlt, weil das Paket unvollständig ist.",
      "PRODUKT: GRÜN",
    ].join("\n");
    expect(gesamturteil(text)).toBeNull();
    expect(hatSachurteil("BEN-PRUEFUNG-JOB-2-D1.md", text)).toBe(false);
  });
});

describe("R-1231 (b) — Urteilswörter in Markdown-Codeblöcken zählen nicht", () => {
  it("ein Urteil nur im Codeblock ist kein Urteil", () => {
    const text = ["Vorlage:", "```", "GESAMTURTEIL: GRÜN", "PRODUKT: GRÜN", "```"].join("\n");
    expect(gesamturteil(text)).toBeNull();
    expect(urteilVon("BEN-PRUEFUNG-JOB-3-D1.md", text).sachurteil).toBe(false);
  });

  it("ein zitiertes ROT im Codeblock verdrängt das eigene GRÜN dahinter nicht", () => {
    const text = [
      "```text",
      "GESAMTURTEIL: ROT",
      "```",
      "GESAMTURTEIL: GRÜN",
      "PRODUKT: GRÜN — trägt die Änderung.",
    ].join("\n");
    const u = urteilVon("BEN-PRUEFUNG-JOB-4-D2.md", text);
    expect(u).toEqual({ sachurteil: true, spruch: "GRÜN", produkt: "GRÜN" });
  });

  it("eine zitierte Sperre im Codeblock sperrt nicht", () => {
    const text = [
      "GESAMTURTEIL: ROT",
      "PRODUKT: ROT — Der Fehler besteht fort.",
      "~~~",
      "PRODUKT: ROT — KEIN SACHURTEIL: Paket fehlt.",
      "~~~",
    ].join("\n");
    expect(sperrzeilen(text)).toEqual([]);
    expect(hatZustellsperre(text)).toBe(false);
    expect(urteilVon("BEN-PRUEFUNG-JOB-5-D1.md", text)).toEqual({
      sachurteil: true,
      spruch: "ROT",
      produkt: "ROT",
    });
  });

  it("ein nicht geschlossener Codeblock reicht bis zum Textende", () => {
    expect(ohneCodebloecke("vor\n```\nGESAMTURTEIL: ROT\n")).toBe("vor\n");
  });

  // Nacharbeit 1 (Ben, tools/urteilslage.ts:54): eingerückte Blöcke und längere Schlusszäune.
  it.each([
    ["nach Leerzeile, vier Leerzeichen", "Vorlage:\n\n    GESAMTURTEIL: GRÜN\n    PRODUKT: GRÜN"],
    ["am Textanfang", "    GESAMTURTEIL: GRÜN"],
    ["mit Tab", "\tGESAMTURTEIL: ROT"],
    ["als Absatzfortsetzung", "Zitat aus dem Vorbericht:\n    GESAMTURTEIL: GRÜN"],
  ])("ein eingerücktes Urteil (%s) ist kein Urteil", (_fall, text) => {
    expect(gesamturteil(text)).toBeNull();
    expect(urteilVon("BEN-PRUEFUNG-JOB-8-D1.md", text).sachurteil).toBe(false);
  });

  it("ein eingerückt zitiertes ROT verdrängt das eigene GRÜN dahinter nicht", () => {
    const text = "Vorlage:\n\n    GESAMTURTEIL: ROT\n\nGESAMTURTEIL: GRÜN\nPRODUKT: GRÜN";
    expect(urteilVon("BEN-PRUEFUNG-JOB-8-D2.md", text)).toEqual({
      sachurteil: true,
      spruch: "GRÜN",
      produkt: "GRÜN",
    });
  });

  it("bis drei Leerzeichen Einzug bleibt die Zeile ein Urteilsfeld", () => {
    expect(gesamturteil("   GESAMTURTEIL: ROT")).toBe("ROT");
  });

  it("eine eingerückt zitierte Sperre sperrt nicht", () => {
    const text = [
      "GESAMTURTEIL: ROT",
      "PRODUKT: ROT — Der Fehler besteht fort.",
      "",
      "    PRODUKT: ROT — KEIN SACHURTEIL: Paket fehlt.",
    ].join("\n");
    expect(sperrzeilen(text)).toEqual([]);
    expect(urteilVon("BEN-PRUEFUNG-JOB-8-D3.md", text).sachurteil).toBe(true);
  });

  it("ein längerer Schlusszaun schließt — das echte Urteil danach bleibt erhalten", () => {
    const zeilen = ["```", "GESAMTURTEIL: ROT", "`````", "GESAMTURTEIL: GRÜN", "PRODUKT: GRÜN"];
    const text = zeilen.join("\n");
    expect(gesamturteil(text)).toBe("GRÜN");
    expect(urteilVon("BEN-PRUEFUNG-JOB-9-D1.md", text)).toEqual({
      sachurteil: true,
      spruch: "GRÜN",
      produkt: "GRÜN",
    });
  });

  it("ein kürzerer oder andersartiger Zaun schließt nicht", () => {
    const kuerzer = ["````", "```", "GESAMTURTEIL: GRÜN", "````", "GESAMTURTEIL: ROT"].join("\n");
    const andersartig = ["~~~", "```", "GESAMTURTEIL: GRÜN", "~~~", "GESAMTURTEIL: ROT"].join("\n");
    expect(gesamturteil(kuerzer)).toBe("ROT");
    expect(gesamturteil(andersartig)).toBe("ROT");
  });
});

describe("R-1362 — ein Urteil, das sich selbst als Zustellsperre bezeichnet, zählt nicht", () => {
  it.each([
    "GESAMTURTEIL: KEIN SACHURTEIL — maschineller Teil noch nicht fertig.",
    "GESAMTURTEIL: NICHT ERTEILT",
    "**GESAMTURTEIL:** KEIN Urteil, Paket fehlt",
  ])("%s", (zeile) => {
    expect(gesamturteil(zeile)).toBeNull();
    expect(hatSachurteil("BEN-PRUEFUNG-JOB-6-D1.md", zeile)).toBe(false);
  });

  it("ein echtes ROT bleibt ein Urteil — die Selbstkennzeichnung entwertet keine gültigen ROTs", () => {
    expect(gesamturteil("GESAMTURTEIL: ROT — Kernmangel nicht behoben.")).toBe("ROT");
  });
});

describe("R-1379 — nur die Zeile GESAMTURTEIL: GRUEN|ROT belegt ein Urteil", () => {
  const faelle: Array<[string, ReturnType<typeof gesamturteil>]> = [
    ["GESAMTURTEIL: GRÜN", "GRÜN"],
    ["GESAMTURTEIL: GRUEN", "GRÜN"],
    ["**GESAMTURTEIL:** ROT", "ROT"],
    ["## GESAMTURTEIL: ROT", "ROT"],
    ["GESAMTURTEIL: offen", null],
    ["", null],
  ];
  it.each(faelle)("%j → %j", (text, erwartet) => {
    expect(gesamturteil(text)).toBe(erwartet);
  });
});

describe("R-1440 — Maschinenurteile sind nie ein inhaltliches Urteil, auch unter neuem Namen", () => {
  it("alter Name -CODE.md und Zielname CODE-PRUEFUNG-… sind Teilurteile", () => {
    const text = "GESAMTURTEIL: GRÜN\nPRODUKT: GRÜN";
    for (const name of ["BEN-PRUEFUNG-JOB-7-D1-CODE.md", "CODE-PRUEFUNG-JOB-7-D1.md"]) {
      expect(istTeilurteil(name)).toBe(true);
      expect(hatSachurteil(name, text)).toBe(false);
      expect(urteilVon(name, text).sachurteil).toBe(false);
    }
    expect(istTeilurteil("BEN-PRUEFUNG-JOB-7-D1.md")).toBe(false);
    expect(hatSachurteil("BEN-PRUEFUNG-JOB-7-D1.md", text)).toBe(true);
  });
});

describe("R-1486 / R-1248 — die Auftragsart nur aus einer ausdrücklichen Zeile", () => {
  const write = `tools/beispiel.ts ${ALT} ${NEU}`;

  it("der Satz aus R-1486 im Fließtext macht die Rückgabe nicht lesend", () => {
    const text = [
      "PRODUKTWRITES: 0 ist hier ausdruecklich das Versagen.",
      "Laut Auftrag gilt PRODUKTWRITES: 0 als Fehlschlag.",
      write,
    ].join("\n");
    expect(erklaertNullWrites(text)).toBe(false);
    expect(echteWrites(text)).toEqual([
      { pfad: "tools/beispiel.ts", art: "GEAENDERT", endhash: NEU },
    ]);
  });

  it("fehlt die Zeile, gilt die Rückgabe als bauend", () => {
    expect(erklaertNullWrites(write)).toBe(false);
    expect(echteWrites(write)).toHaveLength(1);
  });

  it.each([
    "PRODUKTWRITES: 0",
    "**PRODUKTWRITES:** 0",
    "- PRODUKTWRITES: **0** — reine Analyse",
    "PRODUKTWRITES 0 (Nulldiff-Beleg)",
  ])("ausdrückliche Zeile %j erklärt null Writes", (zeile) => {
    const text = [zeile, write].join("\n");
    expect(erklaertNullWrites(text)).toBe(true);
    expect(echteWrites(text)).toEqual([]);
  });

  it("eine eigene Zahl größer null wird von einer zitierten Null nicht verdeckt", () => {
    expect(erklaertNullWrites("PRODUKTWRITES: 0\nPRODUKTWRITES: 2")).toBe(false);
  });

  it("eine Nullzeile nur im Codeblock erklärt nichts", () => {
    const text = ["```", "PRODUKTWRITES: 0", "```", write].join("\n");
    expect(erklaertNullWrites(text)).toBe(false);
    expect(echteWrites(text)).toHaveLength(1);
  });
});
