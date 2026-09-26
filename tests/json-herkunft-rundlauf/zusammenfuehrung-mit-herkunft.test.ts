// ================================================================================================
// UX-20b-R · BENS BEFUND R-0150/R-1731 (Runde 2) — ZUSAMMENFÜHRUNG MIT HERKUNFT, SELBST BELEGT.
// ================================================================================================
//
// DER BEFUND: Urheberschaft und Dublettenvermeidung waren belegt, die „vollständige Zusammenführung
// mit Herkunft" nicht — und sie darf nicht aus einem Dublettentreffer abgeleitet werden. Diese Datei
// misst sie direkt, an einem ZIELBESTAND, DER SCHON ETWAS HAT: der eigene Export einer Quelle wird
// in eine Instanz eingespielt, in der einer der Einträge bereits liegt und ein fremder daneben.
//
// WAS „VOLLSTÄNDIG" HIER HEISST — UND WAS NICHT. Die Austauschzusage ist begrenzt, und genau diese
// Grenze wird festgenagelt statt ein Vollbackup zu behaupten (Auftragsquelle
// P-C-JSON-VOLLTEXT-RUNDLAUF: „Neue Kennungen, Version 1 und offener Status sind KEIN Defekt und kein
// Wiederherstellungsversprechen … Anhänge/Referenzen nur soweit tatsächlich mittransportiert — sonst
// eine erkennbare Grenze"):
//
//   MIT:    Titel, Kernaussage, Art, Kategorie, Schlagworte, Volltext, Urheberschaft.
//   HERKUNFT am Ziel: `importCandidateId` (der Kandidat, aus dem das Objekt entstand; über ihn die
//           eingereichte Datei und die Prüfentscheidung mit Wer/Wann), `originalAuthor`, und der
//           annehmende Nutzer als `author`.
//   NICHT:  Kennung, Version, Status, Bewertungen, Quellen (`sources`), Anhänge, Einstufung — die
//           Einstufung wird beim Import nie gelockert: ohne Signal gilt „vertraulich".
//
// WAS DIESE DATEI NICHT MISST: den sichtbaren Bedienweg (Smoke L3/L3-T, `tests-smoke/ui-smoke.spec.ts`)
// und die Volltextkette über Socket/Browser/PostgreSQL (JOB 4293, `tests/json-volltext-nutzerweg/**`).
import { describe, expect, it } from "vitest";
import { parseImportItems } from "../../apps/web/src/lib/importReview";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import type { KnowledgeObject } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";
import type { DublettenPruefung } from "../../services/library-analytics";

/** Nur der exakte Pass soll entscheiden — so ist die erwartete Dublette unabhängig von einer Schwelle. */
const OHNE_AEHNLICHKEIT: DublettenPruefung = () => ({ dublette: false });

const URHEBERIN = "Urspruengliche Autorin";
const ZIEL_REVIEWER = "Ziel-Reviewer";
const VOLLTEXT = "<h2>Ablauf</h2><p>Erst <strong>entlüften</strong>, dann prüfen.</p>";

const NEU = {
  title: "Pumpe entlüften vor Inbetriebnahme",
  statement: "Vor dem ersten Start die Pumpe vollständig entlüften.",
  type: "best_practice" as const,
  category: "Wartung",
  tags: ["pumpe", "inbetriebnahme"],
};
const SCHON_DA = {
  title: "Ventil X bei Überdruck schließen",
  statement: "Bei Überdruck Ventil X manuell schließen.",
  type: "technik" as const,
  category: "Sicherheit",
  tags: ["ventil"],
};

async function instanz() {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  return { koService, library: new LibraryService({ koService }) };
}

async function quelleExport(): Promise<{ datei: string; quellIds: string[] }> {
  const q = await instanz();
  const a = await q.koService.create({
    ...NEU,
    author: "Quell-Reviewer",
    originalAuthor: URHEBERIN,
    bodyHtml: VOLLTEXT,
    confidentiality: "intern",
  });
  const b = await q.koService.create({ ...SCHON_DA, author: "Quell-Bert" });
  for (const ko of [a, b]) {
    await q.koService.setValidationState(ko.id, { trust: 80, status: "validiert" });
  }
  return { datei: JSON.stringify(await q.library.exportJson()), quellIds: [a.id, b.id] };
}

describe("UX-20b-R · eigener Export in einen gefüllten Bestand zusammenführen (R-0150/R-1731)", () => {
  it("der Austauschvertrag: der Parser trägt genau die zugesagten Felder, keine Kennung/Version/Status/Quellen", async () => {
    const { datei } = await quelleExport();
    const erlaubt = new Set([
      "title",
      "statement",
      "type",
      "category",
      "tags",
      "author",
      "originalAuthor",
      "bodyHtml",
    ]);
    for (const item of parseImportItems(datei)) {
      const fremd = Object.keys(item).filter((k) => !erlaubt.has(k));
      expect(fremd, `„${item.title}" trägt Felder über den Austauschvertrag hinaus`).toEqual([]);
    }
  });

  it("zusammengeführt: Neues kommt vollständig und mit Herkunft an, Vorhandenes wird nicht verdoppelt", async () => {
    const { datei, quellIds } = await quelleExport();
    const ziel = await instanz();
    const vorhanden = await ziel.koService.create({ ...SCHON_DA, author: "ziel-anna" });
    const fremd = await ziel.koService.create({
      title: "Filter monatlich tauschen",
      statement: "Den Ansaugfilter jeden Monat tauschen.",
      type: "technik",
      category: "Wartung",
      author: "ziel-anna",
    });

    const kandidaten = await ziel.library.createImportCandidates(
      parseImportItems(datei),
      ZIEL_REVIEWER,
      OHNE_AEHNLICHKEIT,
    );
    expect(kandidaten).toHaveLength(2);
    const entschieden = [];
    for (const k of kandidaten) {
      entschieden.push(await ziel.library.reviewImportCandidate(k.id, "accept", ZIEL_REVIEWER));
    }

    // ── OHNE DUBLETTEN: der schon vorhandene Eintrag legt nichts an, der Bestand wächst um genau 1.
    const nachher = await ziel.koService.list();
    expect(nachher, "der Zielbestand hat nicht genau ein neues Objekt").toHaveLength(3);
    expect(nachher.filter((k) => k.title === SCHON_DA.title)).toHaveLength(1);
    const zumVorhandenen = entschieden.find((k) => k.item.title === SCHON_DA.title);
    expect(zumVorhandenen?.status).toBe("angenommen");
    expect(zumVorhandenen?.koId, "eine Dublette hat ein Objekt angelegt").toBeNull();
    expect(zumVorhandenen?.dublettenbefund).toMatchObject({
      ergebnis: "identisch",
      treffer: { art: "wissensobjekt", koId: vorhanden.id },
    });
    // Das Vorhandene und das Fremde bleiben, wie sie waren.
    expect((await ziel.koService.get(vorhanden.id))?.author).toBe("ziel-anna");
    expect(await ziel.koService.get(fremd.id)).toBeDefined();

    // ── VOLLSTÄNDIG IM ZUGESAGTEN UMFANG: jedes zugesagte Feld, einzeln.
    const zumNeuen = entschieden.find((k) => k.item.title === NEU.title);
    expect(zumNeuen?.status).toBe("angenommen");
    const angelegt = (await ziel.koService.get(zumNeuen?.koId ?? "")) as KnowledgeObject;
    expect(angelegt, "das neue Objekt fehlt im Zielbestand").toBeDefined();
    expect({
      title: angelegt.title,
      statement: angelegt.statement,
      type: angelegt.type,
      category: angelegt.category,
      tags: angelegt.tags,
    }).toEqual(NEU);
    expect(angelegt.bodyHtml, "der Volltext kam nicht an").toContain("entlüften");
    expect(angelegt.bodyHtml).toContain("<strong>");

    // ── HERKUNFT: woher (Kandidat, und über ihn die Prüfentscheidung), von wem (Urheberin), durch wen.
    expect(angelegt.importCandidateId, "kein Herkunftsanker zum Kandidaten").toBe(zumNeuen?.id);
    expect(zumNeuen?.reviewedBy).toBe(ZIEL_REVIEWER);
    expect(zumNeuen?.reviewedAction).toBe("accept");
    expect(angelegt.originalAuthor).toBe(URHEBERIN);
    expect(angelegt.author).toBe(ZIEL_REVIEWER);

    // ── DIE BENANNTE GRENZE, statt eines behaupteten Vollbackups.
    expect(quellIds, "die Quellkennung wurde übernommen").not.toContain(angelegt.id);
    expect(angelegt.version).toBe(1);
    expect(angelegt.status, "die Validierung der Quelle wurde mitübernommen").not.toBe("validiert");
    expect(angelegt.sources).toEqual([]);
    expect(angelegt.attachments).toEqual([]);
    // Nie gelockert: „intern" in der Quelle, ohne Signal in der Datei → konservativ „vertraulich".
    expect(angelegt.confidentiality).toBe("vertraulich");
  });

  it("ein zweites Einspielen derselben Datei ändert den zusammengeführten Bestand nicht", async () => {
    const { datei } = await quelleExport();
    const ziel = await instanz();
    for (const runde of [1, 2]) {
      const kandidaten = await ziel.library.createImportCandidates(
        parseImportItems(datei),
        ZIEL_REVIEWER,
        OHNE_AEHNLICHKEIT,
      );
      for (const k of kandidaten) {
        await ziel.library.reviewImportCandidate(k.id, "accept", ZIEL_REVIEWER);
      }
      expect(
        (await ziel.koService.list()).length,
        `Runde ${runde}: der Bestand ist nicht genau die zwei Einträge der Datei`,
      ).toBe(2);
    }
  });
});
