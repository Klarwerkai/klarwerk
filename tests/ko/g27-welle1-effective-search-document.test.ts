// ================================================================================================
// G27 WELLE 1 — DAS EFFECTIVE SEARCH DOCUMENT
// ================================================================================================
//
// Belegt: Akzeptanzkriterium 7 — das Suchdokument entsteht AUSSCHLIESSLICH aus Immutable Content
// Projection plus Mutable Metadata Projection, ohne Join oder Fallback auf operative KO-,
// Kategorie- oder Tag-Tabellen, und ohne zweiten öffentlichen Suchvertrag.
//
// DER PRÜFTRICK: der autoritative KO-Zustand und die Metadatenprojektion werden absichtlich
// AUSEINANDERGEFAHREN. Liefe irgendwo ein Fallback auf die operative Tabelle, würde die Suche den
// KO-Wert finden — und genau das darf sie nicht.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EFFECTIVE_SEARCH_DOCUMENT_FIELDS,
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
  METADATA_REVISION_NONE,
  composeEffectiveSearchDocument,
  matchEffectiveSearchDocument,
} from "../../services/knowledge-object";

// G27 R1: EINE FRISCHE INSTANZ IST NICHT SUCHBEREIT (Entscheidung 05 §1). Sie steht persistent auf
// `UNINITIALIZED`, und die Standardsuche wirft dort — sie liefert kein stilles `[]`. Der Stapel
// fährt deshalb einmal die vorgeschriebene Folge `UNINITIALIZED → V2_BUILDING → V2_READY →
// V2_ACTIVE`: derselbe vollständige Gate-Lauf wie jede spätere Fassung, nur über einem leeren
// Bestand trivial erfüllt. Das ist KEINE Abkürzung um das Gate herum — die fünf Prüfungen laufen
// wirklich —, sondern die Inbetriebnahme, die eine echte Installation ebenso braucht.
async function stack() {
  const repo = new InMemoryKoRepo();
  const projections = new InMemoryKoSearchProjectionRepo(repo);
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: projections,
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
  return { repo, projections, ko };
}

const EINGABE = {
  title: "Spezialpresse SPX9",
  statement: "Kurzfassung.",
  type: "best_practice" as const,
  author: "anna",
};

describe("G27 Welle 1 · AK7 · das Suchdokument entsteht aus genau zwei Projektionen", () => {
  it("es trägt beide Hälften und benennt ihre Herkunft im Feldvertrag", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({
      ...EINGABE,
      category: "Kategoriewort",
      tags: ["Schlagwort"],
      bodyHtml: "<p>Dokumentwort</p>",
    });
    const doc = await ko.effectiveSearchDocumentOf(erstellt.id);
    expect(Object.keys(doc as object).sort()).toEqual([...EFFECTIVE_SEARCH_DOCUMENT_FIELDS].sort());
    // Inhaltsseite (revisionsgebunden) …
    expect(doc?.bodyText).toBe("Dokumentwort");
    expect(doc?.koVersion).toBe(1);
    expect(doc?.classificationSnapshot.value).toBe("none");
    // … Metadatenseite (versionslos).
    expect(doc?.categoryText).toBe("Kategoriewort");
    expect(doc?.tagText).toBe("Schlagwort");
    expect(doc?.metadataRevision).toBe(1);
  });

  it("KEIN FALLBACK: nimmt man die Metadatenzeile weg, verschwindet die Kategoriesuche — der KO-Wert rettet sie NICHT", async () => {
    const { projections, ko } = await stack();
    const erstellt = await ko.create({
      ...EINGABE,
      category: "Kategoriewortbeta",
      bodyHtml: "<p>Inhaltswortbeta</p>",
    });
    expect((await ko.findSearchHits({ terms: ["kategoriewortbeta"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);

    await projections.metadata.remove(erstellt.id);

    // Das Objekt trägt die Kategorie weiterhin autoritativ …
    expect((await ko.get(erstellt.id))?.category).toBe("Kategoriewortbeta");
    // … die Suche findet sie aber nicht mehr: sie liest ausschließlich die Projektion.
    expect(await ko.findSearchHits({ terms: ["kategoriewortbeta"] })).toEqual([]);
    // Der Inhalt bleibt unabhängig davon auffindbar (die andere Hälfte steht ja).
    expect((await ko.findSearchHits({ terms: ["inhaltswortbeta"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);
  });

  it("der Nachzug stellt die fehlende Hälfte wieder her (konvergiert, idempotent)", async () => {
    const { projections, ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Kategoriewortbeta" });
    await projections.metadata.remove(erstellt.id);
    expect(await ko.findSearchHits({ terms: ["kategoriewortbeta"] })).toEqual([]);

    await ko.backfillSearchProjections({ limit: 10 });

    expect((await ko.findSearchHits({ terms: ["kategoriewortbeta"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);
  });

  it("fehlt die Metadatenzeile, ist das Dokument ehrlich leer statt geraten", () => {
    const doc = composeEffectiveSearchDocument(
      {
        koId: "k1",
        koVersion: 1,
        projectionVersion: 2,
        searchText: "Inhalt",
        titleText: "Inhalt",
        statementText: "",
        captionText: "",
        bodyText: "",
        language: "und",
        contentHash: "h",
        status: "vollstaendig",
        classificationSnapshot: {
          value: "none",
          source: "knowledge_object.confidentiality",
          koVersion: 1,
          capturedAt: null,
          capturedAtSource: "unknown",
          provenance: "reconstructed_from_current_ko",
          historicalConfidence: "unknown",
        },
        createdAt: "x",
        updatedAt: "x",
      },
      undefined,
    );
    expect(doc.categoryText).toBe("");
    expect(doc.tagText).toBe("");
    expect(doc.metadataRevision).toBe(METADATA_REVISION_NONE);
    // Und die Suche trifft dann eben nicht — statt still den operativen Wert zu borgen.
    expect(matchEffectiveSearchDocument(doc, ["wartung"])).toBeUndefined();
    expect(matchEffectiveSearchDocument(doc, ["inhalt"])?.koId).toBe("k1");
  });

  it("KEIN operativer Join im Suchweg — weder in Postgres noch im Speicher", () => {
    const pg = readFileSync("services/knowledge-object/src/search-projection-repo-pg.ts", "utf8");
    const sqlTeil = pg.slice(pg.indexOf("async findActive"), pg.indexOf("async missingActive"));
    // Der JOIN auf `kos` bleibt — er entscheidet über die AKTIVE Version und den Papierkorb, nicht
    // über Textinhalte. Kategorie/Schlagwörter dürfen dort aber nirgends herkommen.
    expect(sqlTeil).toContain("JOIN kos k");
    expect(sqlTeil).not.toContain("k.data->>'category'");
    expect(sqlTeil).not.toContain("k.data->>'tags'");
    expect(sqlTeil).toContain("LEFT JOIN ko_metadata_projections");

    const speicher = readFileSync(
      "services/knowledge-object/src/search-projection-repo.ts",
      "utf8",
    );
    const findActive = speicher.slice(
      speicher.indexOf("async findActive"),
      speicher.indexOf("async missingActive"),
    );
    expect(findActive).toContain("composeEffectiveSearchDocument");
    expect(findActive).not.toContain("ko.category");
    expect(findActive).not.toContain("ko.tags");
  });

  it("es gibt GENAU EINEN öffentlichen Sucheinstieg — keinen zweiten temporären Vertrag", () => {
    const bibliothek = readFileSync("services/library-analytics/src/service.ts", "utf8");
    const dienst = readFileSync("services/knowledge-object/src/service.ts", "utf8");
    // Bibliothek und Ask-Kandidatenweg laufen beide über `findSearchHits`.
    expect(bibliothek).toContain("findSearchHits");
    expect(dienst).toMatch(/async findCandidates\([\s\S]*?findSearchHits/);
    // Der Read-Zugriff auf EIN Dokument ist kein Suchweg: er filtert und rankt nichts.
    const einblick = dienst.slice(
      dienst.indexOf("async effectiveSearchDocumentOf"),
      dienst.indexOf("async effectiveSearchDocumentOf") + 600,
    );
    expect(einblick).not.toContain("findActive");
    expect(einblick).not.toContain("terms");
  });
});
