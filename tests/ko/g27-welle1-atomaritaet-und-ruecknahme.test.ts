// ================================================================================================
// G27 WELLE 1 — BEIDE PROJEKTIONSARTEN WERDEN GEMEINSAM WIRKSAM UND GEMEINSAM ZURÜCKGENOMMEN
// ================================================================================================
//
// Belegt: Akzeptanzkriterium 10 (die bestehende G27-Rollback-Kompensation bleibt grün) — erweitert
// um die zweite Projektionsart, die es zum Zeitpunkt jener Kompensation noch nicht gab.
//
// DIE FRAGE, die diese Datei stellt: was passiert mit der VERÄNDERLICHEN Metadatenzeile, wenn ein
// Vorgang scheitert? Sie ist nicht append-only und nicht versionsgebunden — sie kann also nicht
// einfach „stehen bleiben, ohne zu schaden". Bleibt sie nach einer zurückgenommenen Erstanlage
// liegen, wäre die Kategorie eines nie entstandenen Objekts im abgeleiteten Datenraum. Bricht eine
// Metadatenänderung mittendrin ab, dürfte die Suche keinesfalls auf dem verworfenen Wert stehen
// bleiben.
import { describe, expect, it, vi } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";

// G27 R1 / Entscheidung 06 §4 — MECHANISCHE INITIALISIERUNG ÜBER DEN PRODUKTPFAD.
//
// Seit R1 ist die Standardsuche fail-closed: eine Instanz, deren Control-State auf `UNINITIALIZED`
// steht, beantwortet KEINE Suchanfrage. Ein direkter Testaufbau wie dieser ist eine solche
// Instanz — er baut den Dienst, aber niemand nimmt ihn in Betrieb. Genau das tut in der echten App
// die Startorchestrierung in `services/app/src/build-app.ts`.
//
// Deshalb läuft hier DERSELBE Aktivierungsweg und keine Testabkürzung: kein direktes Setzen des
// Control-States, kein abgeschwächtes Assert, kein Sonderpfad im Produktcode (06 §4/§6). Der
// Bestand ist zum Zeitpunkt der Aktivierung leer — exakt wie bei einer frisch gestarteten App;
// was danach angelegt wird, trägt die aktive Generation und ist reguläre Suchwahrheit.
async function stack() {
  const repo = new InMemoryKoRepo();
  const projections = new InMemoryKoSearchProjectionRepo(repo);
  const versions = new InMemoryKoVersionRepo();
  const evidence = new InMemoryEvidenceRepo();
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const ko = new KoService({ repo, versions, evidence, audit, searchProjections: projections });
  await ko.activateSearchProjectionV2();
  return { repo, projections, versions, evidence, audit, ko };
}

const EINGABE = {
  title: "Spezialpresse SPX9",
  statement: "Kurzfassung.",
  type: "best_practice" as const,
  category: "Ruecknahmekategorie",
  author: "anna",
};

function bündel(objectId = "obj-1") {
  return [
    {
      anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
      sources: [{ label: "Pruefbericht.pdf", excerpt: "Seite 3" }],
    },
  ];
}

describe("G27 Welle 1 · AK10 · die Rücknahme erfasst BEIDE Projektionsarten", () => {
  it("scheitert die Dokument-Erstanlage, bleibt weder Inhalts- noch Metadatenzeile", async () => {
    const { repo, projections, evidence, ko } = await stack();
    vi.spyOn(evidence, "append").mockRejectedValue(new Error("Evidence-Speicher nicht erreichbar"));

    await expect(
      ko.createWithDocuments({ ...EINGABE, bodyHtml: "<p>VERWORFENWORT</p>" }, bündel(), {
        id: "welle1-rollback-1",
        actor: "anna",
        fingerprint: "fp-1",
      }),
    ).rejects.toBeInstanceOf(Error);

    expect(await repo.list({})).toHaveLength(0);
    expect(await projections.count()).toBe(0);
    expect(await projections.metadata.count()).toBe(0);
    // Und die Suche kennt weder Inhalt noch Kategorie des nie entstandenen Objekts.
    expect(await ko.findSearchHits({ terms: ["verworfenwort"] })).toEqual([]);
    expect(await ko.findSearchHits({ terms: ["ruecknahmekategorie"] })).toEqual([]);
  });

  it("gelingt die Anlage, stehen selbstverständlich BEIDE Zeilen (Gegenprobe)", async () => {
    const { projections, ko } = await stack();
    const erstellt = await ko.createWithDocuments(
      { ...EINGABE, bodyHtml: "<p>GUELTIGWORT</p>" },
      bündel(),
      { id: "welle1-rollback-ok", actor: "anna", fingerprint: "fp-ok" },
    );
    expect(await projections.count()).toBe(1);
    expect(await projections.metadata.count()).toBe(1);
    expect(
      (await ko.findSearchHits({ terms: ["ruecknahmekategorie"] })).map((h) => h.koId),
    ).toEqual([erstellt.id]);
  });

  it("scheitert die Metadatenprojektion, bleibt der autoritative Stand ZURÜCKGEROLLT und die Suche alt-konsistent", async () => {
    const { projections, ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Altkategoriewort" });
    expect((await ko.findSearchHits({ terms: ["altkategoriewort"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);

    const echt = projections.metadata.upsert.bind(projections.metadata);
    let brich = true;
    vi.spyOn(projections.metadata, "upsert").mockImplementation(async (input) => {
      if (brich) {
        brich = false; // NUR der erste Aufruf scheitert — die Kompensation muss laufen dürfen.
        throw new Error("Metadatenspeicher nicht erreichbar");
      }
      return echt(input);
    });

    await expect(ko.updateCategory(erstellt.id, "Neukategoriewort", "anna")).rejects.toThrow(
      /Metadatenspeicher/,
    );

    // Der autoritative Zustand steht wieder auf dem alten Wert …
    expect((await ko.get(erstellt.id))?.category).toBe("Altkategoriewort");
    // … und die Suche ebenfalls: kein Zustand „Objekt sagt A, Suche sagt B".
    expect((await ko.findSearchHits({ terms: ["altkategoriewort"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);
    expect(await ko.findSearchHits({ terms: ["neukategoriewort"] })).toEqual([]);
  });

  it("scheitert der Beleg, wird die Änderung vollständig zurückgenommen — auch in der Suche", async () => {
    const { projections, audit, ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, tags: ["Altschlagwort"] });
    vi.spyOn(audit, "record").mockRejectedValueOnce(new Error("Audit-Kette nicht erreichbar"));

    await expect(ko.updateTags(erstellt.id, ["Neuschlagwort"], "anna")).rejects.toThrow(/Audit/);

    expect((await ko.get(erstellt.id))?.tags).toEqual(["Altschlagwort"]);
    expect((await ko.findSearchHits({ terms: ["altschlagwort"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);
    expect(await ko.findSearchHits({ terms: ["neuschlagwort"] })).toEqual([]);
    // Die Revision ist dabei nicht gesunken: sie ist monoton, auch über eine Rücknahme hinweg.
    const revision = (await projections.metadata.find(erstellt.id))?.metadataRevision ?? 0;
    expect(revision).toBeGreaterThanOrEqual(1);
  });

  it("die Endlöschung räumt BEIDE Zeilen ab — kein Rest im abgeleiteten Datenraum", async () => {
    const { projections, ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: "<p>Endloeschwort</p>" });
    expect(await projections.count()).toBe(1);
    expect(await projections.metadata.count()).toBe(1);

    await ko.delete(erstellt.id, "admin", { hard: true });

    expect(await projections.count()).toBe(0);
    expect(await projections.metadata.count()).toBe(0);
    expect(await ko.findSearchHits({ terms: ["endloeschwort"] })).toEqual([]);
    expect(await ko.findSearchHits({ terms: ["ruecknahmekategorie"] })).toEqual([]);
  });

  it("eine Inhaltsrevision lässt die versionslose Metadatenzeile in Ruhe — und die Kategoriesuche überlebt den Versionswechsel", async () => {
    // DER GRUND, WARUM DIE METADATENPROJEKTION AN `ko_id` HÄNGT: bei einem Versions-Bump muss sie
    // gar nicht mitwandern. Läge sie an (ko_id, ko_version), bräuchte JEDE Revision eine neue
    // Metadatenkopie — und jede vergessene Kopie wäre ein verschwundener Kategorietreffer.
    const { projections, ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Bestandskategoriewort" });
    const vorher = await projections.metadata.find(erstellt.id);

    const revidiert = await ko.revise(erstellt.id, { bodyHtml: "<p>Revisionswort</p>" }, "anna");
    expect(revidiert.version).toBe(2);

    // Die Metadatenzeile ist unberührt geblieben (keine wirksame Metadatenänderung, kein Bump) …
    expect(await projections.metadata.find(erstellt.id)).toEqual(vorher);
    // … und beide Hälften des Suchdokuments treffen weiterhin, jetzt auf Version 2.
    const kategorie = await ko.findSearchHits({ terms: ["bestandskategoriewort"] });
    expect(kategorie.map((h) => h.koId)).toEqual([erstellt.id]);
    expect(kategorie[0]?.koVersion).toBe(2);
    expect((await ko.findSearchHits({ terms: ["revisionswort"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);
  });

  it("wandert die Kategorie NACH einer Revision, verschwindet der alte Wert sofort", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Altkategoriewort" });
    await ko.revise(erstellt.id, { bodyHtml: "<p>Revisionswort</p>" }, "anna");
    await ko.updateCategory(erstellt.id, "Neukategoriewort", "anna");

    expect(await ko.findSearchHits({ terms: ["altkategoriewort"] })).toEqual([]);
    const treffer = await ko.findSearchHits({ terms: ["neukategoriewort"] });
    expect(treffer.map((h) => h.koId)).toEqual([erstellt.id]);
    expect(treffer[0]?.koVersion).toBe(2);
    // Die Inhaltsprojektionen beider Versionen sind davon unberührt geblieben.
    expect((await ko.searchProjectionsOf(erstellt.id)).map((p) => p.koVersion)).toEqual([1, 2]);
  });
});

// ================================================================================================
// DIE LÜCKE ZWISCHEN DEN BEIDEN HÄLFTEN — der Fehler MITTEN im gemeinsamen Schreibhelfer
// ================================================================================================
//
// DER BEFUND (Kopfprüfung zu Welle 1). `persistSearchProjection` schreibt ZUERST die unveränderliche
// Inhaltszeile und DANACH die veränderliche Metadatenzeile. Scheitert der zweite Schritt, kommt der
// Rückgabewert des Helfers NIE beim Aufrufer an: die Zuweisung `projectionWritten = await …` wird
// nicht mehr ausgeführt, die Variable bleibt auf `false` stehen. Die Rücknahmeklammer des Aufrufers
// hält die soeben von DIESEM Vorgang geschriebene Inhaltszeile daraufhin für eine fremde und lässt
// sie liegen — als Karteileiche an einer Version, die es nach dem Rollback nicht mehr gibt. Kein
// Rebuild fasst sie je an (sie gehört zu keiner aktiven Version), und eine spätere ERFOLGREICHE
// Wiederholung träfe unter der Append-only-Regel auf eine belegte Zeile mit dem verworfenen Text.
//
// Die Welle-1-Tests oben prüfen den Metadatenfehler am Weg `updateCategory` — der hat gar keine
// Inhaltszeile im Spiel. Genau der Zwischenfehler im Erstellungs-/Revisionsschreibweg fehlte.
//
// NEGATIVE KONTROLLE: vor der Korrektur ist der jeweils erste `expect` auf die verbliebenen
// Inhaltszeilen ROT und misst den exakten Restzustand (Revisionsweg: `[1, 2]` statt `[1]`;
// Dokument-Erstanlage: `1` statt `0`). Der Gegenprobe-Test am Ende ist VOR und NACH der Korrektur
// grün — er verhindert, dass aus der Reparatur ein pauschales `remove` wird.
describe("G27 Welle 1 · Korrektur · der Metadatenfehler nimmt die eigene Inhaltszeile mit", () => {
  /** Lässt GENAU den nächsten Metadaten-Write scheitern; die Kompensation darf danach laufen. */
  // `Awaited<…>`, weil `stack()` seit der mechanischen Initialisierung (06 §4) asynchron ist:
  // es führt vor der Rückgabe den echten Aktivierungsweg aus.
  function brichNächstenMetadatenWrite(
    projections: Awaited<ReturnType<typeof stack>>["projections"],
  ) {
    return vi
      .spyOn(projections.metadata, "upsert")
      .mockRejectedValueOnce(new Error("Metadatenspeicher nicht erreichbar"));
  }

  it("Inhaltsrevision: scheitert der Metadaten-Write, bleibt keine Inhaltszeile der verworfenen Version", async () => {
    const { projections, ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: "<p>BESTANDSWORT</p>" });
    expect(await projections.count()).toBe(1);
    brichNächstenMetadatenWrite(projections);

    await expect(
      ko.revise(erstellt.id, { bodyHtml: "<p>VERWORFENWORT</p>" }, "anna"),
    ).rejects.toThrow(/Metadatenspeicher/);

    // Der Restzustand, den die Lücke hinterließ: die Inhaltszeile der Version 2 …
    expect((await ko.searchProjectionsOf(erstellt.id)).map((p) => p.koVersion)).toEqual([1]);
    expect(await projections.count()).toBe(1);
    // … obwohl der autoritative Stand vollständig auf Version 1 zurückgerollt ist.
    const nachher = await ko.get(erstellt.id);
    expect(nachher?.version).toBe(1);
    expect(nachher?.bodyHtml).toContain("BESTANDSWORT");
    expect(await ko.searchProjectionOf(erstellt.id, 2)).toBeUndefined();
    // AK2: die VORHER vorhandene, gültige Zeile der Version 1 gehört einem anderen Vorgang —
    // sie bleibt, und das Objekt bleibt auffindbar.
    expect((await ko.findSearchHits({ terms: ["bestandswort"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);
    expect(await ko.findSearchHits({ terms: ["verworfenwort"] })).toEqual([]);
  });

  it("Inhaltsrevision: die erfolgreiche Wiederholung projiziert den NEUEN Text, nicht den verworfenen", async () => {
    // Die Folgeschadensprobe zur Append-only-Regel: bliebe die Zeile der Version 2 liegen, wäre
    // `insert` beim zweiten Anlauf ein No-op und der VERWORFENE Text stünde als Projektion der dann
    // wirklich geltenden Fassung.
    const { projections, ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: "<p>BESTANDSWORT</p>" });
    brichNächstenMetadatenWrite(projections);

    await expect(
      ko.revise(erstellt.id, { bodyHtml: "<p>VERWORFENWORT</p>" }, "anna"),
    ).rejects.toThrow(/Metadatenspeicher/);

    const revidiert = await ko.revise(erstellt.id, { bodyHtml: "<p>GUELTIGWORT</p>" }, "anna");
    expect(revidiert.version).toBe(2);
    const v2 = await ko.searchProjectionOf(erstellt.id, 2);
    expect(v2?.searchText).toContain("GUELTIGWORT");
    expect(v2?.searchText).not.toContain("VERWORFENWORT");
    expect((await ko.findSearchHits({ terms: ["gueltigwort"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);
    expect(await ko.findSearchHits({ terms: ["verworfenwort"] })).toEqual([]);
  });

  it("Erstanlage mit Dokument: scheitert der Metadaten-Write, bleibt weder Objekt noch Inhaltszeile", async () => {
    const { repo, projections, ko } = await stack();
    brichNächstenMetadatenWrite(projections);

    await expect(
      ko.createWithDocuments({ ...EINGABE, bodyHtml: "<p>VERWORFENWORT</p>" }, bündel(), {
        id: "welle1-korrektur-1",
        actor: "anna",
        fingerprint: "fp-k1",
      }),
    ).rejects.toThrow(/Metadatenspeicher/);

    expect(await repo.list({})).toHaveLength(0);
    expect(await projections.count()).toBe(0);
    expect(await projections.metadata.count()).toBe(0);
    expect(await ko.findSearchHits({ terms: ["verworfenwort"] })).toEqual([]);
    expect(await ko.findSearchHits({ terms: ["ruecknahmekategorie"] })).toEqual([]);
  });

  it("Dokumentrevision: scheitert der Metadaten-Write, bleibt keine Inhaltszeile der verworfenen Version", async () => {
    const { projections, ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: "<p>BESTANDSWORT</p>" });
    brichNächstenMetadatenWrite(projections);

    await expect(
      ko.appendDocumentExtract(erstellt.id, "anna", {
        operationId: "welle1-korrektur-uebernahme",
        anchor: { objectId: "obj-1", name: "Pruefbericht.pdf", mime: "application/pdf" },
        sources: [{ label: "Pruefbericht.pdf", excerpt: "Seite 3" }],
        changes: { bodyHtml: "<p>VERWORFENWORT</p>" },
      }),
    ).rejects.toThrow(/Metadatenspeicher/);

    expect((await ko.searchProjectionsOf(erstellt.id)).map((p) => p.koVersion)).toEqual([1]);
    expect(await projections.count()).toBe(1);
    const nachher = await ko.get(erstellt.id);
    expect(nachher?.version).toBe(1);
    expect(nachher?.bodyHtml).toContain("BESTANDSWORT");
    expect((await ko.findSearchHits({ terms: ["bestandswort"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);
  });

  it("Gegenprobe (AK2): ohne Inhaltsrevision bleibt die bestehende, gültige Inhaltszeile unangetastet", async () => {
    // Ohne `changes` bleibt die Version dieselbe, die Zeile ist bereits belegt, `insert` meldet
    // ehrlich „nicht ich". Ein pauschales Entfernen im Metadatenfehlerfall würde hier die GÜLTIGE
    // Zeile eines FREMDEN Vorgangs löschen und das Objekt unauffindbar machen.
    const { projections, ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: "<p>UNBERUEHRTWORT</p>" });
    const vorher = await ko.searchProjectionOf(erstellt.id, 1);
    brichNächstenMetadatenWrite(projections);

    await expect(
      ko.appendDocumentExtract(erstellt.id, "anna", {
        operationId: "welle1-korrektur-ohne-revision",
        anchor: { objectId: "obj-1", name: "Pruefbericht.pdf", mime: "application/pdf" },
        sources: [{ label: "Pruefbericht.pdf", excerpt: "Seite 3" }],
      }),
    ).rejects.toThrow(/Metadatenspeicher/);

    expect(await ko.searchProjectionOf(erstellt.id, 1)).toEqual(vorher);
    expect(await projections.count()).toBe(1);
    expect((await ko.findSearchHits({ terms: ["unberuehrtwort"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);
  });

  it("Benannte Grenze: die einfache Erstanlage hat keine Rücknahmeklammer — der Nachzug heilt sie", async () => {
    // KEINE stille Ausweitung: `finishCreated` (Version 1 über `create`) bleibt ausdrücklich
    // untransaktional (WP-SHIP8-CLOSE-5). Das Wissensobjekt BLEIBT nach dem Fehler im Bestand —
    // eine Inhaltszeile dazu ist deshalb keine Karteileiche, sondern die Zeile eines existierenden
    // Objekts. Zuständig ist hier der idempotente Nachzug, nicht die Kompensation.
    const { repo, projections, ko } = await stack();
    brichNächstenMetadatenWrite(projections);

    await expect(ko.create({ ...EINGABE, bodyHtml: "<p>NACHZUGSWORT</p>" })).rejects.toThrow(
      /Metadatenspeicher/,
    );

    const angelegt = (await repo.list({}))[0];
    expect(angelegt).toBeDefined();
    // Der Nachzug stellt BEIDE Hälften her — es bleibt kein halbes Suchdokument.
    const nachgezogen = await ko.ensureSearchProjection(angelegt?.id ?? "");
    expect(nachgezogen?.koVersion).toBe(1);
    expect(await projections.metadata.count()).toBe(1);
    expect((await ko.findSearchHits({ terms: ["nachzugswort"] })).map((h) => h.koId)).toEqual([
      angelegt?.id,
    ]);
  });
});
