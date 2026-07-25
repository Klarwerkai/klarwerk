// AUFTRAG-mega1 Block D2 (E2E-004): leere/Whitespace-only Entwürfe werden serverseitig abgelehnt —
// ein Entwurf braucht mindestens Titel ODER Aussage. Harte Kante (auch für direkte API-Aufrufe),
// zusätzlich zur clientseitigen Knopf-Sperre.
import { describe, expect, it } from "vitest";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import { CaptureService } from "../../services/capture/src/service";
import { CaptureError } from "../../services/capture/src/types";

function service(): CaptureService {
  return new CaptureService({ repo: new InMemoryDraftRepo() });
}

describe("Block D2: createDraft lehnt leere Entwürfe ab", () => {
  it("leeres Payload → EMPTY_DRAFT, kein Eintrag im Pool", async () => {
    const svc = service();
    await expect(svc.createDraft({}, "anna")).rejects.toMatchObject({ code: "EMPTY_DRAFT" });
    await expect(svc.createDraft({}, "anna")).rejects.toBeInstanceOf(CaptureError);
    expect(await svc.listDrafts()).toHaveLength(0);
  });

  it("Whitespace-only Titel UND Aussage → EMPTY_DRAFT", async () => {
    const svc = service();
    await expect(
      svc.createDraft({ title: "   ", statement: "\n\t " }, "anna"),
    ).rejects.toMatchObject({ code: "EMPTY_DRAFT" });
    expect(await svc.listDrafts()).toHaveLength(0);
  });

  it("mind. Aussage ODER Titel → Entwurf wird angelegt", async () => {
    const svc = service();
    await svc.createDraft({ title: "Nur Titel" }, "anna");
    await svc.createDraft({ statement: "Nur Aussage" }, "bob");
    expect(await svc.listDrafts()).toHaveLength(2);
  });
});
