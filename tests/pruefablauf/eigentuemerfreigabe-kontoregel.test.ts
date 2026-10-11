// ================================================================================================
// INTEGRATION (Nacharbeit 5) — DIE EIGENTÜMERFREIGABE AUS MAIN (R-0507) UND DIESER AUFTRAG.
// ================================================================================================
//
// Main hat mit `ValidationService.ownerValidate` einen weiteren Annahmeweg mitgebracht. Zwei
// Zusagen dieses Auftrags müssen auch für ihn gelten:
//   E1 · AW06-K02: der Beleg `ko.owner-validated` nennt seine Kontoregel.
//   E2 · R-0256: die Freigabe behält die Vertrauensgrundlage; ein schon eingerechneter
//        Wahrheitskonflikt geht danach nicht ein zweites Mal in den Wert ein.
import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  InMemoryAssignmentRepo,
  InMemoryRatingRepo,
  type KonfliktArt,
  ValidationService,
} from "../../services/validation";

const EIGENTUEMERIN = "eva-eigentuemerin";

async function buehne(offen: KonfliktArt[]) {
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const koService = new KoService({ repo: new InMemoryKoRepo(), audit });
  const service = new ValidationService({
    koService,
    ratings: new InMemoryRatingRepo(),
    assignments: new InMemoryAssignmentRepo(),
    audit,
    offeneKonfliktArten: async () => [...offen],
  });
  const ko = await koService.create({
    title: "Ventil schließen",
    statement: "Bei Überdruck schließen.",
    type: "best_practice",
    category: "Anlage 1",
    author: "anna-autorin",
    neededValidations: 3,
  });
  await koService.setOwnership(ko.id, { owner: EIGENTUEMERIN }, "admin");
  return { audit, koService, service, koId: ko.id };
}

describe("Integration R-0507 × gesamt-peer-validierung", () => {
  it("E1 · die Eigentümerfreigabe nennt im Beleg ihre Kontoregel", async () => {
    const b = await buehne([]);
    await b.service.ownerValidate(b.koId, EIGENTUEMERIN);
    const beleg = (await b.audit.list()).find((e) => e.action === "ko.owner-validated");
    expect(beleg?.payload).toMatchObject({ kontoregel: "eigentuemerfreigabe" });
  });

  it("E2 · nach der Eigentümerfreigabe zählt ein schon eingerechneter Wahrheitskonflikt einmal", async () => {
    const b = await buehne(["truth"]);
    // 1 von 3 grün → 33 aus den Stimmen, mit offenem Wahrheitskonflikt 21 (Untergrenze 15).
    expect((await b.service.rate(b.koId, "p1", "up")).trust).toBe(21);
    await b.service.ownerValidate(b.koId, EIGENTUEMERIN);
    const frei = await b.koService.get(b.koId);
    expect(frei?.status).toBe("validiert");
    expect(frei?.trust).toBe(21);

    await b.service.wahrheitskonfliktFolge(b.koId, "controller");
    const danach = await b.koService.get(b.koId);
    expect(danach?.status).toBe("offen");
    // Ohne durchgereichte Grundlage wäre es 15 (21 − 12, auf die Untergrenze gehoben).
    expect(danach?.trust).toBe(21);
  });
});
