// ================================================================================================
// UX-20b-R · BENS BEFUND R-0150/R-1731 — DIE URHEBERIN ÜBERLEBT DEN EIGENEN JSON-AUSTAUSCH.
// ================================================================================================
//
// DER BEFUND (Ben, Runde 1, selbst reproduziert): zwei frische Bestände, KoService.create →
// Validierung → LibraryService.exportJson → parseImportItems → createImportCandidates →
// reviewImportCandidate(accept) → KoService.get. Export: originalAuthor „Urspruengliche Autorin",
// author „Quell-Reviewer". Ziel: originalAuthor „Quell-Reviewer". Die Urheberin war weg — und kein
// vorhandener Test sah es: der 4293-Rundlauf prüft Volltext, Titel, Kernaussage und Tags, die
// Smoke-Fälle prüfen Zähler und Dublettentreffer. Keiner liest `originalAuthor`.
//
// DIE URSACHE lag an zwei Stellen: der Parser (`apps/web/src/lib/importReview.ts`) übernahm nur
// `author`, und beide Anlagewege im Dienst (`acceptToKo` und `importJson`) machten `item.author`
// zum Wissensträger. Diese Datei misst beide Wege mit DERSELBEN Kette, die Ben gefahren ist —
// echter Produktparser, echte Dienste, keine Abschrift.
//
// WAS SIE NICHT MISST: Volltext und Dublettenvermeidung. Die stehen in
// `tests/json-volltext-nutzerweg/**` (JOB 4293) bzw. `tests/re-import-dubletten/**` und
// `tests-smoke/ui-smoke.spec.ts` (L3). Drei Zusagen, drei Belege — keine wird aus einer anderen
// abgeleitet.
import { describe, expect, it } from "vitest";
import { parseImportItems } from "../../apps/web/src/lib/importReview";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";
import type { DublettenPruefung, ImportItem } from "../../services/library-analytics";

/** Frische Zielinstanz: nichts im Bestand, also trifft auch nichts — die Prüfung darf nie treffen. */
const OHNE_AEHNLICHKEIT: DublettenPruefung = () => ({ dublette: false });

const URHEBERIN = "Urspruengliche Autorin";
const QUELL_REVIEWER = "Quell-Reviewer";
const ZIEL_REVIEWER = "Ziel-Reviewer";

async function instanz() {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  return { koService, library: new LibraryService({ koService }) };
}

/**
 * Die Quelle: ein Objekt, dessen `author` (der Reviewer, der es angelegt hat) NICHT seine
 * Urheberin ist — genau die Lage nach einem ersten Import oder einer Erfassung im Auftrag.
 * Validiert, weil der Export nur Validiertes herausgibt (SCRUM-506).
 */
async function exportDatei(felder: { author: string; originalAuthor?: string }): Promise<string> {
  const quelle = await instanz();
  const ko = await quelle.koService.create({
    title: "Herkunft im Rundlauf",
    statement: "Die Urheberin bleibt beim eigenen JSON-Austausch erhalten.",
    type: "best_practice",
    category: "Austausch",
    tags: ["herkunft"],
    ...felder,
  });
  await quelle.koService.setValidationState(ko.id, { trust: 80, status: "validiert" });
  return JSON.stringify(await quelle.library.exportJson());
}

async function perKandidat(datei: string) {
  const ziel = await instanz();
  const [kandidat] = await ziel.library.createImportCandidates(
    parseImportItems(datei),
    ZIEL_REVIEWER,
    OHNE_AEHNLICHKEIT,
  );
  if (!kandidat) {
    throw new Error("kein Kandidat eingereiht");
  }
  const angenommen = await ziel.library.reviewImportCandidate(kandidat.id, "accept", ZIEL_REVIEWER);
  if (!angenommen.koId) {
    throw new Error(`Annehmen legte kein Wissensobjekt an (Status ${angenommen.status})`);
  }
  return ziel.koService.get(angenommen.koId);
}

async function direkt(datei: string) {
  const ziel = await instanz();
  const ergebnis = await ziel.library.importJson(
    parseImportItems(datei) as ImportItem[],
    ZIEL_REVIEWER,
    OHNE_AEHNLICHKEIT,
  );
  expect(ergebnis.imported, "der direkte Import hat nichts eingespielt").toBe(1);
  const [ko] = await ziel.koService.list();
  return ko;
}

describe("UX-20b-R · Urheberschaft im eigenen JSON-Rundlauf (R-0150/R-1731)", () => {
  it("der Export trägt Urheberin und Reviewer getrennt — die Ausgangslage von Bens Probe", async () => {
    const [eintrag] = JSON.parse(
      await exportDatei({ author: QUELL_REVIEWER, originalAuthor: URHEBERIN }),
    ) as Record<string, unknown>[];
    expect(eintrag?.originalAuthor).toBe(URHEBERIN);
    expect(eintrag?.author).toBe(QUELL_REVIEWER);
  });

  it("der Produktparser reicht originalAuthor durch (leerer Wert zählt nicht)", () => {
    const basis = { title: "t", statement: "s", category: "c", type: "technik" };
    expect(
      parseImportItems(JSON.stringify([{ ...basis, author: "a", originalAuthor: URHEBERIN }]))[0]
        ?.originalAuthor,
    ).toBe(URHEBERIN);
    expect(
      parseImportItems(JSON.stringify([{ ...basis, author: "a", originalAuthor: "  " }]))[0],
    ).not.toHaveProperty("originalAuthor");
  });

  for (const [weg, anlegen] of [
    ["Prüfwarteschlange → Annehmen", perKandidat],
    ["POST /api/library/import (importJson)", direkt],
  ] as const) {
    it(`${weg}: die Urheberin bleibt Wissensträgerin, der Handelnde des Ziels wird Autor`, async () => {
      const ko = await anlegen(
        await exportDatei({ author: QUELL_REVIEWER, originalAuthor: URHEBERIN }),
      );
      expect(ko?.originalAuthor, "die Urheberin ging im Rundlauf verloren").toBe(URHEBERIN);
      // Die Rechteposition bleibt beim Handelnden — nie bei einem Namen aus der Datei.
      expect(ko?.author).toBe(ZIEL_REVIEWER);
    });

    it(`${weg}: ohne abweichende Urheberin bleibt der Quellautor Wissensträger (Bestandsverhalten)`, async () => {
      const ko = await anlegen(await exportDatei({ author: QUELL_REVIEWER }));
      expect(ko?.originalAuthor).toBe(QUELL_REVIEWER);
      expect(ko?.author).toBe(ZIEL_REVIEWER);
    });
  }
});
