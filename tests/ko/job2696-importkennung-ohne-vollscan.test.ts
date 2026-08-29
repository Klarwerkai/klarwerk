// ================================================================================================
// JOB 2696 D1 — DIE IMPORT-KENNUNG LAEDT EINEN DATENSATZ, NICHT DEN BESTAND
// ================================================================================================
//
// Der Befund R2-34, woertlich: *„`findByImportCandidateId` =
// `(await this.repo.list({})).find(k => k.importCandidateId === candidateId)` — Vollscan mit
// bodyHtml, obwohl `import_candidate_id` als Generated-Spalte mit Unique-Index existiert; pro
// Import-Annahme bis 4x aufgerufen."*
//
// Gemessen wird, WAS DIE ABLAGE HERAUSGIBT — Datensaetze und Bytes. Und die Zusage, die dabei
// nicht kippen darf: die Anker-Suche ist BEWUSST papierkorb-durchlaessig
// (WP-SHIP8-CLOSE-4). Faende sie ein getrashtes Objekt nicht, legte der Wiederholversuch ein
// zweites an — genau der Doppel-KO, den der Recovery-Vertrag ausschliesst.

import { describe, expect, it } from "vitest";
import { InMemoryKoRepo } from "../../services/knowledge-object/src/repo";
import type { KoRepo } from "../../services/knowledge-object/src/repo";
import { KoService } from "../../services/knowledge-object/src/service";
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";

const SCHWER = "y".repeat(20_000);

/** Zaehlt, was die Ablage herausgibt — je Weg getrennt. */
function messendeAblage(inner: InMemoryKoRepo) {
  const gelesen = { ueberList: 0, ueberSpalte: 0, bytes: 0, wege: [] as string[] };
  const repo: KoRepo = {
    ...inner,
    insert: (ko) => inner.insert(ko),
    update: (ko) => inner.update(ko),
    delete: (id, tx) => inner.delete(id, tx),
    bumpTrust: (id, s, m, tx) => inner.bumpTrust(id, s, m, tx),
    findById: (id) => inner.findById(id),
    findByCreateOperation: (op, actor) => inner.findByCreateOperation(op, actor),
    listForSearch: (f, trim) => inner.listForSearch(f, trim),
    listByIds: (ids) => inner.listByIds(ids),
    async list(filter, trim) {
      const alle = await inner.list(filter, trim);
      gelesen.ueberList += alle.length;
      gelesen.bytes += alle.reduce((s, k) => s + JSON.stringify(k).length, 0);
      gelesen.wege.push("list()");
      return alle;
    },
    async findByImportCandidateId(candidateId) {
      const treffer = await inner.findByImportCandidateId(candidateId);
      gelesen.ueberSpalte += treffer ? 1 : 0;
      gelesen.bytes += treffer ? JSON.stringify(treffer).length : 0;
      gelesen.wege.push("findByImportCandidateId()");
      return treffer;
    },
  } as KoRepo;
  return { repo, gelesen };
}

function ko(id: string, over: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id,
    title: `Objekt ${id}`,
    statement: "Aussage",
    bodyHtml: SCHWER,
    type: "best_practice",
    category: "Anlage 1",
    author: "pedi",
    originalAuthor: "pedi",
    status: "offen",
    trust: 0,
    version: 1,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    history: [],
    comments: [],
    assignments: [],
    sources: [],
    ...over,
  } as unknown as KnowledgeObject;
}

async function bestand(): Promise<InMemoryKoRepo> {
  const inner = new InMemoryKoRepo();
  for (let i = 1; i <= 8; i += 1) {
    await inner.insert(ko(`k-${i}`));
  }
  await inner.insert(ko("k-ziel", { importCandidateId: "kandidat-42" }));
  return inner;
}

// ================================================================================================
describe("JOB 2696 · R2-34 — die Import-Kennung geht ueber die Spalte", () => {
  it("MESSUNG: es wird EIN Datensatz geladen, nicht der Bestand", async () => {
    const { repo, gelesen } = messendeAblage(await bestand());
    const dienst = new KoService({ repo });

    const treffer = await dienst.findByImportCandidateId("kandidat-42");

    expect(treffer?.id).toBe("k-ziel");
    expect(gelesen.ueberSpalte).toBe(1);
    expect(gelesen.ueberList).toBe(0);
    expect(gelesen.wege).toEqual(["findByImportCandidateId()"]);
    // Neun schwere Objekte liegen im Bestand; herausgegeben wurde eines.
    expect(gelesen.bytes).toBeLessThan(2 * SCHWER.length);
  });

  it("GEGENPROBE: derselbe Nachschlag ueber den alten Weg — die Zahl, die vorher galt", async () => {
    // Der alte Weg stand woertlich so im Dienst:
    //     (await this.repo.list({})).find((k) => k.importCandidateId === candidateId)
    // Er wird hier NACHGESTELLT statt am Produkt zurueckgebaut — die Zahl entsteht damit ohne
    // Produktaenderung, und der Vergleich steht in derselben gruenen Datei wie das Ergebnis.
    const { repo, gelesen } = messendeAblage(await bestand());

    const alterWeg = (await repo.list({})).find((k) => k.importCandidateId === "kandidat-42");

    expect(alterWeg?.id).toBe("k-ziel");
    // VORHER: neun Datensaetze, jeder mit vollem bodyHtml.
    expect(gelesen.ueberList).toBe(9);
    expect(gelesen.bytes).toBeGreaterThan(9 * SCHWER.length);
    // NACHHER steht im Fall darueber: ein Datensatz, unter zwei bodyHtml an Bytes.
  });

  it("eine unbekannte Kennung laedt gar nichts", async () => {
    const { repo, gelesen } = messendeAblage(await bestand());
    const dienst = new KoService({ repo });

    expect(await dienst.findByImportCandidateId("gibt-es-nicht")).toBeUndefined();
    expect(gelesen.ueberList).toBe(0);
    expect(gelesen.bytes).toBe(0);
  });

  it("DIE ZUSAGE BLEIBT: ein getrashtes Objekt wird weiterhin gefunden", async () => {
    // WP-SHIP8-CLOSE-4: die Anker-Suche ist die einzige trash-durchlaessige Lesefläche neben den
    // Trash-Views. Waere sie es nicht mehr, entstuende beim Wiederholen ein Doppel-KO.
    const inner = await bestand();
    const getrasht = await inner.findById("k-ziel");
    await inner.update({
      ...(getrasht as KnowledgeObject),
      deletedAt: new Date(0).toISOString(),
    } as KnowledgeObject);

    const dienst = new KoService({ repo: inner });
    const treffer = await dienst.findByImportCandidateId("kandidat-42");

    expect(treffer?.id).toBe("k-ziel");
    expect((treffer as { deletedAt?: string }).deletedAt).toBeDefined();
  });
});
