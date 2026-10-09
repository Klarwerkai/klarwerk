// ================================================================================================
// R-0507 · BEN (Nacharbeit 3) — DIE EIGENTÜMERFREIGABE URTEILT AM FRISCHEN STAND.
// ================================================================================================
//
// Eine Eigentumsänderung erhöht die Inhaltsfassung nicht; der Compare-and-Set auf `version` sieht
// sie also nicht. Zwischen dem Vorab-Lesen in `ownerValidate` und der Schreibklammer darf deshalb
// weder ein Eigentümerwechsel noch eine Vertrauensänderung verloren gehen. Der Wettlauf wird hier
// gestellt, indem das Vorab-Lesen (`koService.get`) den Stand NACH seiner Antwort verändert.
import { beforeEach, describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../knowledge-object";
import { InMemoryAssignmentRepo, InMemoryRatingRepo } from "./repo";
import { ValidationService } from "./service";

const AUTORIN = "anna-autorin";
const EIGENTUEMERIN = "eva-eigentuemerin";
const NACHFOLGER = "bert-nachfolger";

describe("R-0507 · Eigentümerfreigabe am frischen Stand", () => {
  let audit: AuditService;
  let koService: KoService;
  let service: ValidationService;
  let ko: KnowledgeObject;

  beforeEach(async () => {
    audit = new AuditService({ repo: new InMemoryAuditRepo() });
    koService = new KoService({ repo: new InMemoryKoRepo(), audit });
    service = new ValidationService({
      koService,
      ratings: new InMemoryRatingRepo(),
      assignments: new InMemoryAssignmentRepo(),
      audit,
    });
    ko = await koService.create({
      title: "Ventil schließen",
      statement: "Bei Überdruck schließen.",
      type: "best_practice",
      category: "Anlage 1",
      author: AUTORIN,
      neededValidations: 3,
    });
    await koService.setOwnership(ko.id, { owner: EIGENTUEMERIN }, "admin");
  });

  /** Lässt das NÄCHSTE Vorab-Lesen den Stand danach verändern — genau einmal. */
  function nachDemLesen(aenderung: () => Promise<unknown>): void {
    const original = koService.get.bind(koService);
    let einmal = true;
    koService.get = (async (id: string) => {
      const gelesen = await original(id);
      if (einmal) {
        einmal = false;
        await aenderung();
      }
      return gelesen;
    }) as typeof koService.get;
  }

  it("F1 · wechselt das Eigentum nach dem Vorab-Lesen, gibt die frühere Eigentümerin NICHT frei", async () => {
    nachDemLesen(() => koService.setOwnership(ko.id, { owner: NACHFOLGER }, "admin"));
    await expect(service.ownerValidate(ko.id, EIGENTUEMERIN)).rejects.toMatchObject({
      code: "NOT_OWNER",
    });
    const danach = await koService.get(ko.id);
    expect(danach?.status).toBe("offen");
    expect(danach?.ownership?.owner).toBe(NACHFOLGER);
    expect(danach?.ownership?.validators ?? []).toEqual([]);
    expect((await audit.list()).some((e) => e.action === "ko.owner-validated")).toBe(false);
  });

  it("F2 · gibt die Eigentümerin nach dem Vorab-Lesen zurück, wird nicht freigegeben", async () => {
    nachDemLesen(() => koService.releaseOwnership(ko.id, EIGENTUEMERIN));
    await expect(service.ownerValidate(ko.id, EIGENTUEMERIN)).rejects.toMatchObject({
      code: "NOT_OWNER",
    });
    expect((await koService.get(ko.id))?.status).toBe("offen");
  });

  it("F3 · eine zwischenzeitliche Vertrauensänderung wird übernommen, nicht überschrieben", async () => {
    const vorher = ko.trust;
    nachDemLesen(() => koService.bumpTrust(ko.id, 7, 99));
    const ergebnis = await service.ownerValidate(ko.id, EIGENTUEMERIN);
    const gespeichert = await koService.get(ko.id);
    expect(gespeichert?.trust).toBe(vorher + 7);
    expect(gespeichert?.status).toBe("validiert");
    // Die Antwort nennt den gespeicherten Stand.
    expect(ergebnis.trust).toBe(gespeichert?.trust);
    expect(ergebnis.status).toBe("validiert");
    expect(gespeichert?.ownership?.validators).toEqual([EIGENTUEMERIN]);
  });

  it("F4 · ohne Wettlauf: Freigabe mit Beleg und Freigabespur", async () => {
    const ergebnis = await service.ownerValidate(ko.id, EIGENTUEMERIN);
    expect(ergebnis.status).toBe("validiert");
    expect(ergebnis.validationDecisionRef).not.toBeNull();
    const eintrag = (await audit.list()).find((e) => e.action === "ko.owner-validated");
    expect(eintrag).toMatchObject({ actor: EIGENTUEMERIN, target: ko.id });
    expect(await audit.verify()).toBe(true);
  });
});
