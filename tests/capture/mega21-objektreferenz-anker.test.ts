import { describe, expect, it } from "vitest";
import { findObjectReferences, isObjectReferenced } from "../../services/app/src/object-references";
import type { Draft } from "../../services/capture";
import type {
  EvidenceRecord,
  KnowledgeObject,
  KoVersionSnapshot,
} from "../../services/knowledge-object";

// ==============================================================================================
// AUFTRAG-mega21 Block E — `anchorDocuments` GEHÖRT IN DEN REFERENZSCAN.
// ==============================================================================================
//
// ben stuft das als Nach-VIP-2 ein, weil es heute keinen Waisen-Sweep gibt — es kann also aktuell
// niemand daran ein Original verlieren. Der Kopf zieht es vor, weil es billig ist und weil ein
// Referenzscan, der eine Referenzart nicht kennt, eine tickende Falle ist: er ist erst dann
// gefährlich, wenn jemand ihm vertraut, und dann bemerkt es niemand mehr.
//
// DER BEFUND, genau: `findObjectReferences` kannte `draft.payload.pendingSources[].objectId`, aber
// nicht `draft.payload.anchorDocuments[].objectId` — obwohl die Entwurfs-Ankerprüfung
// (`verifyDraftAnchors`, capture/src/service.ts) genau diese Kennungen als Referenzen behandelt UND
// obwohl ein Entwurf ein Ankerdokument OHNE parallelen `pendingSources`-Eintrag tragen darf.
//
// Genau dieser Fall — Anker ohne Belegstelle — ist der einzige, in dem die Lücke sichtbar wird. Er
// steht deshalb zuerst.

function entwurf(id: string, payload: Partial<Draft["payload"]>): Draft {
  return {
    id,
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
    payload: {
      title: "T",
      statement: "S",
      ...payload,
    },
  } as Draft;
}

const KEINE = {
  kos: async (): Promise<readonly KnowledgeObject[]> => [],
  versions: async (): Promise<readonly KoVersionSnapshot[]> => [],
  evidence: async (): Promise<readonly EvidenceRecord[]> => [],
};

describe("mega21 E: der Referenzscan kennt die Ankerdokumente des Entwurfs", () => {
  it("ANKER OHNE BELEGSTELLE — genau der Fall, in dem die Lücke ein Original gekostet hätte", async () => {
    // Ein Entwurf DARF ein gesichertes Original tragen, zu dem (noch) keine Belegstelle gehört.
    // Bis mega20 fand der Scan hier NICHTS und hätte das Original für eine Waise gehalten.
    const drafts = [
      entwurf("d1", {
        anchorDocuments: [
          { key: "k1", objectId: "obj-anker", name: "Pruefbericht.pdf", mime: "application/pdf" },
        ],
      }),
    ];
    const treffer = await findObjectReferences("obj-anker", {
      ...KEINE,
      drafts: async () => drafts,
    });
    expect(treffer).toEqual([{ kind: "draft-anchor", holderId: "d1" }]);
    expect(await isObjectReferenced("obj-anker", { ...KEINE, drafts: async () => drafts })).toBe(
      true,
    );
  });

  it("EIGENE ART, nicht unter `draft-source` mitgezählt — beide werden getrennt gemeldet", async () => {
    // „referenziert" allein sagt dem Aufrufer nicht, ob er einem Fund trauen soll. Wer beide Arten
    // zusammenwirft, verliert genau die Auskunft, die den Fall oben von einem normalen unterscheidet.
    const drafts = [
      entwurf("d2", {
        pendingSources: [{ label: "P", objectId: "obj-beides", anchorKey: "k1" }],
        anchorDocuments: [
          { key: "k1", objectId: "obj-beides", name: "Pruefbericht.pdf", mime: "application/pdf" },
        ],
      }),
    ];
    const treffer = await findObjectReferences("obj-beides", {
      ...KEINE,
      drafts: async () => drafts,
    });
    expect(treffer).toEqual([
      { kind: "draft-source", holderId: "d2" },
      { kind: "draft-anchor", holderId: "d2" },
    ]);
  });

  it("VOLLSTÄNDIG über mehrere Entwürfe — der Scan bricht nicht beim ersten Treffer ab", async () => {
    const drafts = [
      entwurf("d3", {
        anchorDocuments: [{ key: "k", objectId: "obj-x", name: "A.pdf", mime: "application/pdf" }],
      }),
      entwurf("d4", {
        anchorDocuments: [{ key: "k", objectId: "obj-x", name: "A.pdf", mime: "application/pdf" }],
      }),
    ];
    const treffer = await findObjectReferences("obj-x", { ...KEINE, drafts: async () => drafts });
    expect(treffer).toHaveLength(2);
    expect(treffer.map((t) => t.holderId).sort()).toEqual(["d3", "d4"]);
  });

  it("DIE GEGENPROBE — eine fremde Kennung wird NICHT als Referenz gemeldet", async () => {
    const drafts = [
      entwurf("d5", {
        anchorDocuments: [{ key: "k", objectId: "obj-a", name: "A.pdf", mime: "application/pdf" }],
      }),
    ];
    expect(
      await findObjectReferences("obj-b", { ...KEINE, drafts: async () => drafts }),
    ).toHaveLength(0);
    expect(await isObjectReferenced("obj-b", { ...KEINE, drafts: async () => drafts })).toBe(false);
  });

  it("KEIN SWEEP: dieser Block liefert den Datenvertrag und entscheidet nichts", async () => {
    // Ausdrücklich festgehalten, damit es niemand später für eine Auslassung hält: der Scan löscht
    // nichts, markiert nichts und läuft von selbst nicht los. Er beantwortet EINE Frage.
    const treffer = await findObjectReferences("  ", { ...KEINE, drafts: async () => [] });
    expect(treffer).toEqual([]);
  });
});
