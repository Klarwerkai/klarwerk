// ================================================================================================
// R-0628 · OB ETWAS VERTRAULICH IST, ENTSCHEIDET EINE LESART — HIER NACHGEZÄHLT.
// ================================================================================================
//
// Die Anforderung: „Ob etwas vertraulich ist, entscheidet genau eine Stelle im System — nicht
// mehrere, die zu verschiedenen Ergebnissen kommen können." Die Stufengrenze wohnt im Server in
// `services/knowledge-object/src/confidentiality.ts`. Der Browser kann dieses Modul nicht laden und
// führt deshalb eine Abschrift (`apps/web/src/lib/confidentiality.ts`); dazu kommen zwei Wege, die
// eine Stufe von AUSSEN bekommen (Word-Markierung `markierungVertraulich`, Medienobjekt
// `mediaIsConfidential`).
//
// GEMESSEN WIRD:
//   E1  Abschrift und Server antworten auf JEDEN Wert gleich — auch auf Unfug.
//   E2  Für jede gültige Stufe kommen alle vier Wege zum selben Ergebnis.
//   E3  Die Lesart „keine Stufe" ist je Rolle bewusst VERSCHIEDEN — Zugriff/Anzeige: intern;
//       Ausleitung von aussen gemeldeter Stufen: vertraulich (im Zweifel gesperrt). Das ist der Rest,
//       den R-0628 selbst benennt; er steht hier als Tabelle fest, damit er sich nicht still ändert.
import { describe, expect, it } from "vitest";
import * as web from "../../apps/web/src/lib/confidentiality";
import { markierungVertraulich } from "../../services/app/src/routes/ask-routes";
import {
  CONFIDENTIALITY_LEVELS,
  isConfidential,
  normalizeConfidentiality,
} from "../../services/knowledge-object";
import type { Confidentiality } from "../../services/knowledge-object/src/types";
import { mediaIsConfidential } from "../../services/media/src/service";

/** Alles, was an einer Stufe ankommen kann — gültig, fehlend, falsch geschrieben, falscher Typ. */
const WERTE: readonly unknown[] = [
  "intern",
  "vertraulich",
  "streng_vertraulich",
  undefined,
  null,
  "",
  "Vertraulich",
  "öffentlich",
  "geheim",
  42,
  {},
];

describe("R-0628 · eine Lesart der Vertraulichkeit", () => {
  it("E1 · die Abschrift im Browser antwortet auf jeden Wert wie der Server", () => {
    expect(web.CONFIDENTIALITY_LEVELS).toEqual(CONFIDENTIALITY_LEVELS);
    for (const wert of WERTE) {
      const stufe = wert as Confidentiality | undefined;
      expect([wert, web.isConfidential(stufe)]).toEqual([wert, isConfidential(stufe)]);
      expect([wert, web.confidentialityOf(stufe)]).toEqual([wert, normalizeConfidentiality(wert)]);
    }
  });

  it("E2 · für jede gültige Stufe kommen alle vier Wege zum selben Ergebnis", () => {
    for (const stufe of CONFIDENTIALITY_LEVELS) {
      const server = isConfidential(stufe);
      expect([stufe, web.isConfidential(stufe)]).toEqual([stufe, server]);
      expect([stufe, !web.isKnownNonConfidential(stufe)]).toEqual([stufe, server]);
      expect([stufe, markierungVertraulich(stufe)]).toEqual([stufe, server]);
      expect([stufe, mediaIsConfidential(stufe)]).toEqual([stufe, server]);
    }
  });

  it("E3 · „keine Stufe“: Zugriff liest intern, Ausleitung von aussen liest vertraulich", () => {
    // Zugriff und Anzeige-Filter (Server und Abschrift): fehlend = intern (SCRUM-415).
    expect(isConfidential(undefined)).toBe(false);
    expect(web.isConfidential(undefined)).toBe(false);
    // Automatik-Flächen im Browser: fehlend gilt als bekannt-intern, Unbekanntes als vertraulich.
    expect(web.isKnownNonConfidential(undefined)).toBe(true);
    expect(web.isKnownNonConfidential("geheim")).toBe(false);
    // Word-Markierung: nur fehlend oder `intern` ist nicht vertraulich, jeder andere Wert sperrt.
    expect(markierungVertraulich(undefined)).toBe(false);
    expect(markierungVertraulich("geheim")).toBe(true);
    expect(markierungVertraulich("Vertraulich")).toBe(true);
    // Medienobjekt ohne gespeicherte Stufe: im Zweifel vertraulich, keine Transkription.
    expect(mediaIsConfidential(undefined)).toBe(true);
    expect(mediaIsConfidential("geheim")).toBe(true);
  });
});
