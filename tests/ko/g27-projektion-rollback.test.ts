// ================================================================================================
// G27 — DIE ROLLBACK-KARTEILEICHEN DER DOKUMENTWEGE
// ================================================================================================
//
// DER BEFUND (PLAN-BASIC-G27, D7). Zwei Schreibwege schrieben ihre Suchprojektion INNERHALB einer
// Kompensationsklammer, nahmen sie im Fehlerfall aber NICHT zurück:
//
//   1. `createWithDocuments` — nach dem Projektionsschreiben scheitert Evidence oder Audit, das
//      Wissensobjekt wird HART gelöscht, die Projektionszeile bleibt. Danach ist sie unerreichbar:
//      die Standardsuche liefert sie nicht (der JOIN auf das Objekt fällt weg), `missingActive`
//      findet sie nicht, der Rebuild läuft über den Bestand, `removeByKo` wird nie mehr gerufen.
//      Sie bleibt für immer.
//   2. `appendDocumentExtract` mit Inhaltsrevision — der Commit wird auf Version N zurückgerollt,
//      die Projektion für N+1 bleibt. Wird derselbe Vorgang später ERFOLGREICH wiederholt, greift
//      die Append-only-Regel: `insert` ist ein No-op, und der VERWORFENE Text wird zur Projektion
//      der dann gültigen Version. Suchbarer Inhalt, den es in dieser Fassung nie gab.
//
// Diese Datei nagelt beide Reparaturen fest — und die Gegenprobe, die verhindert, dass daraus ein
// pauschales `remove` wird: der Weg OHNE Inhaltsrevision darf die gültige Zeile der bestehenden
// Version nicht anfassen, denn geschrieben hat sie ein anderer Vorgang.
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
  const auditRepo = new InMemoryAuditRepo();
  const audit = new AuditService({ repo: auditRepo });
  const ko = new KoService({ repo, versions, evidence, audit, searchProjections: projections });
  await ko.activateSearchProjectionV2();
  return { repo, projections, versions, evidence, auditRepo, ko };
}

const EINGABE = {
  title: "Spezialpresse SPX9",
  statement: "Kurzfassung.",
  type: "best_practice" as const,
  category: "Wartung",
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

function übernahme(operationId: string, changes?: { bodyHtml: string }) {
  return {
    operationId,
    anchor: { objectId: "obj-1", name: "Pruefbericht.pdf", mime: "application/pdf" },
    sources: [{ label: "Pruefbericht.pdf", excerpt: "Seite 3" }],
    ...(changes ? { changes } : {}),
  };
}

// ------------------------------------------------------------------------------------------------
// 1. ERSTANLAGE AUS DOKUMENTEN — kein Objekt, also auch keine Projektion.
// ------------------------------------------------------------------------------------------------
describe("G27 · Rücknahme der Dokument-Erstanlage", () => {
  it("scheitert die Anlage NACH dem Projektionsschreiben, bleibt weder Objekt noch Projektion", async () => {
    const { repo, projections, evidence, ko } = await stack();
    vi.spyOn(evidence, "append").mockRejectedValue(new Error("Evidence-Speicher nicht erreichbar"));

    const fehler = await ko
      .createWithDocuments({ ...EINGABE, bodyHtml: "<p>VERWORFENERSTWORT</p>" }, bündel(), {
        id: "vorgang-rollback-1",
        actor: "anna",
        fingerprint: "fp-1",
      })
      .then(
        () => null,
        (e: unknown) => e,
      );

    expect(fehler).toBeInstanceOf(Error);
    expect(await repo.list({})).toHaveLength(0);
    // DIE ZUSAGE: die Zeile, die dieser Vorgang geschrieben hat, ist mit ihm verschwunden.
    expect(await projections.count()).toBe(0);
    expect(await ko.findSearchHits({ terms: ["verworfenerstwort"] })).toEqual([]);
  });

  it("gelingt die Anlage, bleibt die Projektion selbstverständlich stehen (Gegenprobe)", async () => {
    const { projections, ko } = await stack();
    const erstellt = await ko.createWithDocuments(
      { ...EINGABE, bodyHtml: "<p>GUELTIGERSTWORT</p>" },
      bündel(),
      { id: "vorgang-rollback-ok", actor: "anna", fingerprint: "fp-ok" },
    );
    expect(await projections.count()).toBe(1);
    expect((await ko.findSearchHits({ terms: ["gueltigerstwort"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);
  });

  it("scheitert auch das Entfernen der Projektion, wird das NICHT als saubere Rücknahme ausgegeben", async () => {
    // EHRLICHKEIT DER KOMPENSATION: das Objekt ist weg, die Zeile nicht. Genau dieser Rest wird
    // benannt — im geworfenen Fehler und im Audit —, statt ihn als gelungenen Rollback zu
    // verschweigen. Ein Vermerk am Objekt ist hier nicht möglich: es gibt kein Objekt mehr.
    const { repo, projections, evidence, auditRepo, ko } = await stack();
    vi.spyOn(evidence, "append").mockRejectedValue(new Error("Evidence-Speicher nicht erreichbar"));
    vi.spyOn(projections, "remove").mockRejectedValue(
      new Error("Projektionsspeicher unerreichbar"),
    );

    const fehler = await ko
      .createWithDocuments({ ...EINGABE, bodyHtml: "<p>RESTWORT</p>" }, bündel(), {
        id: "vorgang-rollback-rest",
        actor: "anna",
        fingerprint: "fp-rest",
      })
      .then(
        () => null,
        (e: unknown) => e,
      );

    expect(fehler).toMatchObject({ code: "CREATE_ROLLBACK_FAILED" });
    expect(await repo.list({})).toHaveLength(0); // das Objekt IST zurückgenommen …
    expect(await projections.count()).toBe(1); // … die Zeile blieb liegen, und das wird gesagt.
    const beleg = (await auditRepo.all()).find((e) => e.action === "ko.create-rollback-failed");
    expect(beleg?.payload).toMatchObject({
      koRemoved: true,
      searchProjectionLeftBehind: true,
      marked: false,
    });
  });
});

// ------------------------------------------------------------------------------------------------
// 2. DOKUMENTÜBERNAHME MIT INHALTSREVISION — der schwerste Einzelbefund.
// ------------------------------------------------------------------------------------------------
describe("G27 · Rücknahme der Dokumentübernahme mit Inhaltsrevision", () => {
  it("scheitert die Übernahme NACH dem Projektionsschreiben, ist die Projektion der verworfenen Version entfernt", async () => {
    const { projections, evidence, ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: "<p>BESTANDSWORT</p>" });
    vi.spyOn(evidence, "append").mockRejectedValue(new Error("Evidence-Speicher nicht erreichbar"));

    await expect(
      ko.appendDocumentExtract(
        erstellt.id,
        "anna",
        übernahme("uebernahme-1", { bodyHtml: "<p>VERWORFENWORT</p>" }),
      ),
    ).rejects.toThrow(/Evidence-Speicher/);

    // Der Inhalt steht wieder auf Version 1 …
    const nachher = await ko.get(erstellt.id);
    expect(nachher?.version).toBe(1);
    expect(nachher?.bodyHtml).toContain("BESTANDSWORT");
    // … und die Projektion der verworfenen Version 2 existiert nicht mehr.
    expect((await ko.searchProjectionsOf(erstellt.id)).map((p) => p.koVersion)).toEqual([1]);
    expect(await projections.count()).toBe(1);
    expect(await ko.findSearchHits({ terms: ["verworfenwort"] })).toEqual([]);
    expect((await ko.findSearchHits({ terms: ["bestandswort"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);
  });

  it("die erfolgreiche Wiederholung projiziert den NEUEN Inhalt — kein Text des verworfenen Versuchs bleibt suchbar", async () => {
    // OHNE die Kompensation wäre die Zeile für Version 2 belegt; `insert` wäre beim zweiten,
    // gelungenen Anlauf ein No-op, und der verworfene Text würde zur Projektion der Version, die
    // dann WIRKLICH gilt.
    const { evidence, ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: "<p>BESTANDSWORT</p>" });
    const kaputt = vi
      .spyOn(evidence, "append")
      .mockRejectedValue(new Error("Evidence-Speicher nicht erreichbar"));

    await expect(
      ko.appendDocumentExtract(
        erstellt.id,
        "anna",
        übernahme("uebernahme-2", { bodyHtml: "<p>VERWORFENWORT</p>" }),
      ),
    ).rejects.toThrow(/Evidence-Speicher/);

    // Die Störung ist vorbei, der Nutzer wiederholt denselben Vorgang mit der korrigierten Fassung.
    kaputt.mockRestore();
    const commit = await ko.appendDocumentExtract(
      erstellt.id,
      "anna",
      übernahme("uebernahme-2", { bodyHtml: "<p>GUELTIGWORT</p>" }),
    );
    expect(commit.koVersion).toBe(2);

    const v2 = await ko.searchProjectionOf(erstellt.id, 2);
    expect(v2?.searchText).toContain("GUELTIGWORT");
    expect(v2?.searchText).not.toContain("VERWORFENWORT");
    expect((await ko.findSearchHits({ terms: ["gueltigwort"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);
    expect(await ko.findSearchHits({ terms: ["verworfenwort"] })).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
// 3. DIE GEGENPROBE — kein pauschales Entfernen.
// ------------------------------------------------------------------------------------------------
describe("G27 · der Weg OHNE Inhaltsrevision fasst die gültige Projektion nicht an", () => {
  it("scheitert eine Übernahme ohne `changes`, bleibt die bestehende Projektion unverändert bestehen", async () => {
    // Ohne Inhaltsrevision bleibt die Version dieselbe; `persistSearchProjection` meldet ehrlich
    // „nicht ich" (Append-only), und genau daran hängt die Kompensation. Ein pauschales `remove`
    // würde hier die GÜLTIGE Zeile der bestehenden Version löschen und das Objekt unauffindbar
    // machen — ein zweiter Defekt an der Stelle des ersten.
    const { projections, evidence, ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: "<p>UNBERUEHRTWORT</p>" });
    const vorher = await ko.searchProjectionOf(erstellt.id, 1);
    vi.spyOn(evidence, "append").mockRejectedValue(new Error("Evidence-Speicher nicht erreichbar"));

    await expect(
      ko.appendDocumentExtract(erstellt.id, "anna", übernahme("uebernahme-3")),
    ).rejects.toThrow(/Evidence-Speicher/);

    const nachher = await ko.searchProjectionOf(erstellt.id, 1);
    expect(nachher).toEqual(vorher);
    expect(await projections.count()).toBe(1);
    expect((await ko.findSearchHits({ terms: ["unberuehrtwort"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);
  });
});
