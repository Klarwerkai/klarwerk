// ================================================================================================
// R-0507 — „DER EIGENTÜMER KANN ES ZURÜCKGEBEN."
// ================================================================================================
//
// Die Rückgabe ist der Gegenweg zu `setOwnership`: nur die benannte Eigentümerin selbst gibt ab;
// die Spur (`reviewers`, `validators`) bleibt; danach gilt wieder der benannte Rückfall auf den
// Autor (`responsibleOf`). Jeder Schritt hinterlässt einen Beleg.
import { beforeEach, describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import { responsibleKindOf, responsibleOf } from "./ownership";
import { InMemoryKoRepo } from "./repo";
import { KoService } from "./service";
import type { KnowledgeObject } from "./types";

const ERZEUGERIN = "anna-erzeugerin";
const EIGENTUEMERIN = "eva-eigentuemerin";

describe("R-0507 · Verantwortung zurückgeben", () => {
  let audit: AuditService;
  let service: KoService;
  let ko: KnowledgeObject;

  beforeEach(async () => {
    audit = new AuditService({ repo: new InMemoryAuditRepo() });
    service = new KoService({ repo: new InMemoryKoRepo(), audit });
    ko = await service.create({
      title: "Ventil schließen",
      statement: "Bei Überdruck schließen.",
      type: "best_practice",
      category: "Anlage 1",
      author: ERZEUGERIN,
    });
  });

  it("R1 · die benannte Eigentümerin gibt zurück — die Prüf- und Freigabespur bleibt", async () => {
    await service.setOwnership(
      ko.id,
      { owner: EIGENTUEMERIN, reviewers: ["paula"], validators: ["victor"] },
      "admin",
    );
    const nachher = await service.releaseOwnership(ko.id, EIGENTUEMERIN);
    expect(nachher.ownership).toEqual({ reviewers: ["paula"], validators: ["victor"] });
    const gelesen = await service.get(ko.id);
    expect(gelesen?.ownership?.owner).toBeUndefined();
    // Der benannte Rückfall gilt wieder — und ist als Rückfall erkennbar, nicht als Eigentum.
    expect(responsibleOf(gelesen as KnowledgeObject)).toBe(ERZEUGERIN);
    expect(responsibleKindOf(gelesen as KnowledgeObject)).toBe("author-fallback");
    // Urheberschaft und Autor bleiben unberührt.
    expect(gelesen?.author).toBe(ERZEUGERIN);
    expect(gelesen?.originalAuthor).toBe(ERZEUGERIN);
  });

  it("R2 · ohne Spur bleibt KEIN leeres Aggregat stehen", async () => {
    await service.setOwnership(ko.id, { owner: EIGENTUEMERIN }, "admin");
    await service.releaseOwnership(ko.id, EIGENTUEMERIN);
    const gelesen = await service.get(ko.id);
    expect(gelesen && "ownership" in gelesen).toBe(false);
  });

  it("R3 · wer nicht Eigentümer ist, gibt nichts zurück — auch kein Admin, nicht der Autor", async () => {
    await service.setOwnership(ko.id, { owner: EIGENTUEMERIN }, "admin");
    for (const fremd of ["admin", ERZEUGERIN, "jemand"]) {
      await expect(service.releaseOwnership(ko.id, fremd), fremd).rejects.toMatchObject({
        code: "NOT_OWNER",
      });
    }
    expect((await service.get(ko.id))?.ownership?.owner).toBe(EIGENTUEMERIN);
  });

  it("R4 · ohne benannten Eigentümer nichts zurückzugeben (Autor ist nur Rückfall)", async () => {
    await expect(service.releaseOwnership(ko.id, ERZEUGERIN)).rejects.toMatchObject({
      code: "NOT_OWNER",
    });
  });

  it("R5 · die Rückgabe steht im Prüfprotokoll — mit der vorherigen Eigentümerin", async () => {
    await service.setOwnership(ko.id, { owner: EIGENTUEMERIN }, "admin");
    await service.releaseOwnership(ko.id, EIGENTUEMERIN);
    const eintraege = await audit.list();
    const rueckgabe = eintraege.find((e) => e.action === "ko.ownership-released");
    expect(rueckgabe).toMatchObject({
      actor: EIGENTUEMERIN,
      target: ko.id,
      payload: { previousOwner: EIGENTUEMERIN },
    });
    expect(await audit.verify()).toBe(true);
  });
});
