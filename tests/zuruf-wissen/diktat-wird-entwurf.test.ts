// ================================================================================================
// AUFNAHME gesamt-sprachassistent · R-0105 — WISSEN AUF ZURUF, OHNE FORMULAR.
// ================================================================================================
//
// Der Satz der Quelle: „Der Anwender ruft zu, was festgehalten werden soll, und das System erstellt
// daraus einen Wissenseintrag - ohne Formular auszufuellen."
//
// DER WEG IM BESTAND (nichts davon ist hier neu gebaut):
//   1. Das Diktat des Erfassungsblatts haengt Gesagtes als Absatz an den Rumpf
//      (`components/erfassen/Blatt.tsx`, `diktatAnhaengen`: `<p>…</p>`, HTML-maskiert). Dass
//      Endgueltiges genau einmal im Editor landet, haelt
//      `tests/cap-p1-fruehe-eingabe/blatt-fruehe-eingabe.test.tsx` L-B1 fest.
//   2. „Sichern" verlangt nur Inhalt (`canSave = hasSavableContent && !busy`) und ruft
//      `createFrontDoorDraft` mit LEEREM Titelfeld.
//   3. DIESE Datei misst Schritt 2: aus nichts als dem diktierten Absatz entsteht genau EIN
//      Anlegeaufruf mit Titel, Kernaussage und Rumpf — kein Feld muss ein Mensch ausfuellen.
//
// WAS SIE AUSDRUECKLICH NICHT BELEGT: die Spracherkennung selbst (Browser-API), das Einreichen als
// validiertes Wissensobjekt (dort bleibt die Vertraulichkeitswahl Pflicht, JOB 3082) und einen
// Lauf mit echtem Mikrofon.
import { describe, expect, it } from "vitest";
import type { DraftPayload } from "../../apps/web/src/api/types";
import { createFrontDoorDraft } from "../../apps/web/src/lib/captureFrontDoor";

/** Derselbe Absatz, den `diktatAnhaengen` im Blatt aus einem erkannten Satz baut. */
function diktierterAbsatz(satz: string): string {
  return `<p>${satz.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
}

async function sichereOhneFormular(bodyHtml: string): Promise<DraftPayload[]> {
  const angelegt: DraftPayload[] = [];
  await createFrontDoorDraft(
    { title: "", bodyHtml, fallbackTitle: "Unbenanntes Wissensobjekt" },
    async (payload) => {
      angelegt.push(payload);
      return { id: "d-zuruf" };
    },
  );
  return angelegt;
}

describe("R-0105 · Gesagtes wird ein Entwurf, ohne dass ein Feld ausgefuellt wird", () => {
  it("Z1 · ein diktierter Satz ergibt GENAU einen Anlegeaufruf mit Titel, Aussage und Rumpf", async () => {
    const satz = "Ventil V3 vor dem Anfahren der Pumpe immer entlueften.";
    const angelegt = await sichereOhneFormular(diktierterAbsatz(satz));

    expect(angelegt).toHaveLength(1);
    const rumpf = angelegt[0] as DraftPayload;
    expect(rumpf.title, "der Titel entsteht aus dem Gesagten, nicht aus einem Feld").toBe(satz);
    expect(rumpf.statement).toBe(satz);
    expect(rumpf.bodyHtml ?? "").toContain("Ventil V3");
    // Die Einordnung, ohne die ein spaeteres Einreichen mit 400 INCOMPLETE endete, setzt das System.
    expect(rumpf.type).toBe("best_practice");
    expect(rumpf.category).toBe("Allgemein");
    expect(rumpf.origin).toBe("frontdoor");
  });

  it("Z2 · eine Vertraulichkeitsstufe wird NICHT erfunden — sie bleibt der Wahl beim Einreichen", async () => {
    const angelegt = await sichereOhneFormular(diktierterAbsatz("Schluessel liegt im Schrank B."));
    expect(Object.hasOwn(angelegt[0] as object, "confidentiality")).toBe(false);
  });

  it("Z3 · mehrere Zurufe: der erste wird Titel, die Aussage traegt alles Gesagte", async () => {
    const erster = "Kesselwartung jeden Montag.";
    const zweiter = "Dichtung bei jeder Wartung tauschen.";
    const angelegt = await sichereOhneFormular(
      `${diktierterAbsatz(erster)}${diktierterAbsatz(zweiter)}`,
    );
    const rumpf = angelegt[0] as DraftPayload;
    expect(rumpf.title).toBe(erster);
    expect(rumpf.statement).toContain(erster);
    expect(rumpf.statement).toContain(zweiter);
  });

  it("Z4 · ein langer Zuruf kuerzt nur den abgeleiteten Titel — die Aussage bleibt vollstaendig", async () => {
    const lang = `Beim Anfahren der Linie zwei ${"wird der Druck schrittweise erhoeht ".repeat(6)}bis Nenndruck.`;
    const angelegt = await sichereOhneFormular(diktierterAbsatz(lang));
    const rumpf = angelegt[0] as DraftPayload;
    expect((rumpf.title ?? "").length).toBeGreaterThan(0);
    expect((rumpf.title ?? "").length).toBeLessThanOrEqual(90);
    expect(rumpf.statement).toBe(lang.replace(/\s+/g, " ").trim());
  });
});
