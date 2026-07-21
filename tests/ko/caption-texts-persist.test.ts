// WP-BILD-1g (bens sammel14-ROT, PFLICHT-Tests): die Caption-Suche arbeitet auf DATENQUELLEN-Ebene.
//  - KO-SCHREIBEN (create/revise) extrahiert die Bild-Fußnoten body-sparend und persistiert sie als
//    kleines abgeleitetes captionTexts-Feld.
//  - Die SUCHE liest NUR title/statement/captionTexts über die bodyHtml-FREIE Projektion.
//  - LEGACY-KOs (ohne Feld, von vor der Schreibregel) werden beim ersten Such-Kandidaten EINMALIG
//    gescannt und backgefüllt — danach nie wieder (bewiesen über eine Body-Mutation nach dem
//    Backfill: die Suche folgt dem persistierten Feld, nicht dem Body).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";

const FIGURE = (caption: string): string =>
  `<figure><img src="/api/objects/x/raw" alt="Bild"><figcaption data-image-id="kw-img-1">${caption}</figcaption></figure>`;

// Legacy-KO von VOR der Schreibregel: bodyHtml vorhanden, captionTexts-Feld FEHLT.
function legacyKo(id: string, bodyHtml: string): KnowledgeObject {
  return {
    id,
    title: `Alt ${id}`,
    statement: "Aussage ohne Suchwort.",
    bodyHtml,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 1,
    assignments: [],
    history: [],
  } as unknown as KnowledgeObject;
}

describe("WP-BILD-1g: KO-Schreibgrenze setzt das captionTexts-Suchfeld", () => {
  it("create extrahiert die Fußnoten; ohne Body bleibt ehrlich []", async () => {
    const services = buildServices();
    buildApp(services);
    const withCaption = await services.ko.create({
      title: "Dosierpumpe warten",
      statement: "Regelmäßig entlüften.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: FIGURE("Verschraubung am Pumpenkopf"),
    });
    expect(withCaption.captionTexts).toEqual(["Verschraubung am Pumpenkopf"]);
    const noBody = await services.ko.create({
      title: "Ventil tauschen",
      statement: "Nur drucklos arbeiten.",
      type: "best_practice",
      category: "Wartung",
      author: "bob",
    });
    // Feld IMMER gesetzt (auch leer) — nur Legacy-Bestand hat KEIN Feld.
    expect(noBody.captionTexts).toEqual([]);
  });

  it("eine Caption-Änderung beim Überarbeiten aktualisiert das Feld", async () => {
    const services = buildServices();
    buildApp(services);
    const ko = await services.ko.create({
      title: "Dosierpumpe warten",
      statement: "Regelmäßig entlüften.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: FIGURE("Alte Beschreibung"),
    });
    const revised = await services.ko.revise(
      ko.id,
      { bodyHtml: FIGURE("Neue Verschraubungs-Beschreibung") },
      "anna",
    );
    expect(revised.captionTexts).toEqual(["Neue Verschraubungs-Beschreibung"]);
    // Und die Suche folgt dem neuen Stand.
    const hits = await services.library.search("Verschraubungs-Beschreibung");
    expect(hits.map((k) => k.id)).toEqual([ko.id]);
    expect(await services.library.search("Alte Beschreibung")).toEqual([]);
  });
});

describe("WP-BILD-1g: Suchpfad ist bodyHtml-frei (Projektion)", () => {
  it("listForSearch liefert KOs OHNE bodyHtml, aber MIT captionTexts", async () => {
    const services = buildServices();
    buildApp(services);
    await services.ko.create({
      title: "Dosierpumpe warten",
      statement: "Regelmäßig entlüften.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: FIGURE("Verschraubung am Pumpenkopf"),
    });
    const projected = await services.ko.listForSearch();
    expect(projected.length).toBe(1);
    expect(projected[0]?.bodyHtml).toBeUndefined();
    expect(projected[0]?.captionTexts).toEqual(["Verschraubung am Pumpenkopf"]);
    // Die reguläre Voll-Sicht trägt den Body weiterhin (Detailansichten unverändert).
    expect((await services.ko.list())[0]?.bodyHtml).toContain("figcaption");
  });
});

describe("WP-BILD-1g: Legacy-KOs — finden, EINMAL scannen, backfillen", () => {
  function buildStack() {
    const repo = new InMemoryKoRepo();
    const koService = new KoService({ repo });
    const library = new LibraryService({ koService });
    return { repo, koService, library };
  }

  it("ein Legacy-KO ohne Feld wird über die Fußnote gefunden und dabei backgefüllt", async () => {
    const { repo, library } = buildStack();
    await repo.insert(legacyKo("legacy-1", FIGURE("Verschraubung am Pumpenkopf")));
    const hits = await library.search("Verschraubung");
    expect(hits.map((k) => k.id)).toEqual(["legacy-1"]);
    // Der Treffer trägt das Feld — und es ist PERSISTIERT (Backfill, kein Einmal-Ergebnis).
    expect(hits[0]?.captionTexts).toEqual(["Verschraubung am Pumpenkopf"]);
    expect((await repo.findById("legacy-1"))?.captionTexts).toEqual([
      "Verschraubung am Pumpenkopf",
    ]);
  });

  it("nach dem Backfill wird NIE wieder gescannt: die Suche folgt dem Feld, nicht dem Body", async () => {
    const { repo, library } = buildStack();
    await repo.insert(legacyKo("legacy-1", FIGURE("Verschraubung am Pumpenkopf")));
    await library.search("Verschraubung"); // erster Kandidat → einmaliger Scan + Backfill

    // Body direkt mutieren, das backgefüllte Feld aber unangetastet lassen: ein erneuter Scan
    // würde jetzt „Flanschdichtung" sehen — die Suche darf den Body aber nie wieder anfassen.
    const stored = await repo.findById("legacy-1");
    if (!stored) {
      throw new Error("Legacy-KO fehlt");
    }
    await repo.insert({ ...stored, bodyHtml: FIGURE("Flanschdichtung") });

    expect((await library.search("Verschraubung")).map((k) => k.id)).toEqual(["legacy-1"]);
    expect(await library.search("Flanschdichtung")).toEqual([]);
  });

  it("der Backfill ist ein reiner Cache-Write: Version/Status/History bleiben unverändert", async () => {
    const { repo, library } = buildStack();
    await repo.insert(legacyKo("legacy-1", FIGURE("Verschraubung am Pumpenkopf")));
    await library.search("Verschraubung");
    const stored = await repo.findById("legacy-1");
    expect(stored?.version).toBe(1);
    expect(stored?.status).toBe("offen");
    expect(stored?.history).toEqual([]);
  });
});
