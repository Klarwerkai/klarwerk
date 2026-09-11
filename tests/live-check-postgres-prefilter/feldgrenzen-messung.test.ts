// ================================================================================================
// JOB 3583 · LIEFERUNG 5 — DIE FELDGRENZEN-ABWEICHUNG: GEMESSEN UND BENANNT, NICHT GEÄNDERT.
// ================================================================================================
//
// DIE ABWEICHUNG. `koCandidateText` (services/knowledge-object/src/repo.ts:274-276) fügt Titel,
// Aussage, Schlagworte, Kategorie und Bildfussnoten mit LEERZEICHEN zu EINEM Text zusammen und sucht
// den Term als Teilzeichenkette darin. Postgres prüft dieselben Felder EINZELN — fünf `ILIKE`
// (repo-pg.ts:33-41). Ein Term, der über eine Feldgrenze reicht, trifft deshalb nur im
// Speicherbestand. Dass das WIRKLICH so ist, misst der Fall „BEKANNTE ABWEICHUNG" in
// services/knowledge-object/src/repo-pg-kandidaten.integration.test.ts an einer echten Datenbank.
//
// HIER STEHT DIE ZWEITE HÄLFTE DER FRAGE: kann dieser Fall im Alltag der zwölf Suchwörter überhaupt
// AUFTRETEN? Ein Term kann eine Feldgrenze nur überschreiten, wenn er das verbindende LEERZEICHEN
// enthält. Gemessen wird deshalb am PRODUKTPFAD, welche Wörter `checkKnowledge` wirklich an
// `findCandidates` übergibt (Mitschrift am Dienst, tests/live-check-suchwoerter/messstand.ts) —
// nicht die Regel nachgebaut, sondern die Übergabe mitgelesen.
//
// NICHTS WIRD GEÄNDERT. Weder `repo.ts` noch `KO_CANDIDATE_SEARCH` werden angefasst (Auftrag §10);
// diese Datei hält den gemessenen Befund fest, damit er nicht wieder verloren geht.
import { describe, expect, it } from "vitest";
import { koCandidateScore } from "../../services/knowledge-object/src/repo";
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";
import { bestand, miss } from "../live-check-suchwoerter/messstand";

const ENTWURF_MIT_KOPFZEILE = [
  "Quelle: Intranet Redaktion · Kategorie: Anweisung · Freigabe Bereich Werk 2 · Stand 09/2026",
  "Das Rueckhaltebecken muss vor Frostgefahr vollstaendig entleert werden,",
  "sonst friert die Leitung ein.",
].join("\n");

const ENTWURF_SCHLICHT =
  "Bei Ueberdruck das Ventil schliessen und den Druck am Messgeraet ablesen.";

describe("JOB 3583 · Lieferung 5: kann ein Suchwort eine Feldgrenze überschreiten?", () => {
  it("die Wortliste des Live-Checks trägt keinen Term mit Leerraum — der Fall kann nicht auftreten", async () => {
    const dienst = await bestand([
      { title: "Rueckhaltebecken", statement: "Vor Frostgefahr vollstaendig entleeren." },
      { title: "Ventil", statement: "Bei Ueberdruck schliessen." },
    ]);
    for (const text of [ENTWURF_MIT_KOPFZEILE, ENTWURF_SCHLICHT]) {
      const messung = await miss(dienst, text);
      expect(messung.terme.length).toBeGreaterThan(0);
      for (const term of messung.terme) {
        // Kein Leerraum → der Term kann das verbindende Leerzeichen zwischen zwei Feldern nicht
        // enthalten und damit keine Feldgrenze überschreiten.
        expect(term).toMatch(/^[a-z0-9äöüß]+$/);
      }
    }
  });

  it("die Abweichung ist echt: ein Term MIT Leerraum trifft im zusammengefügten Text, nicht im Feld", () => {
    const ko = {
      title: "Rueckhaltebecken und Leitung im Winter",
      statement: "Frostgefahr: vollstaendig entleeren.",
      tags: [],
      category: "Anlage 1",
    } as unknown as KnowledgeObject;
    // Der Term steht über der Grenze Titel → Aussage. Der Speicherbestand zählt ihn …
    expect(koCandidateScore(ko, ["winter frostgefahr"])).toBe(1);
    // … und in KEINEM Einzelfeld steht er. Was Postgres daraus macht, misst V1 an einer echten
    // Datenbank (dort: leere Kandidatenliste) — hier wird nichts über Postgres behauptet.
    for (const feld of [ko.title, ko.statement, ko.category, ko.tags.join(" ")]) {
      expect(feld.toLowerCase()).not.toContain("winter frostgefahr");
    }
  });
});
