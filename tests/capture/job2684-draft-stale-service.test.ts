// JOB 2684 D1 (Review R2-17) — ZWEI TABS, UND EIN ENTWURF IST WEG: der Dienst.
//
// `continueDraft` vergleicht den vom Aufrufer gesehenen Stand (`expectedUpdatedAt`) mit dem
// gespeicherten. Ohne Stand: alter Weg (letzter Schreiber gewinnt). Mit Stand: nur der, der den
// aktuellen kennt, darf schreiben — der andere bekommt `DRAFT_STALE`, und nichts wird überschrieben.
import { describe, expect, it } from "vitest";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import { CaptureService, DraftStaleError } from "../../services/capture/src/service";

function dienst(start = 1_700_000_000_000): { service: CaptureService; uhr: { t: number } } {
  const uhr = { t: start };
  return { service: new CaptureService({ repo: new InMemoryDraftRepo(), now: () => uhr.t }), uhr };
}

describe("JOB 2684 D1 · continueDraft mit gesehenem Stand", () => {
  it("GEGENPROBE (vorher / ohne Stand): Tab B überschreibt Tab A still — letzter Schreiber gewinnt", async () => {
    const { service, uhr } = dienst();
    const draft = await service.createDraft({ title: "T", statement: "Ursprung" }, "anna");
    uhr.t += 1000;
    await service.continueDraft(draft.id, { statement: "Fassung A" }, "anna");
    uhr.t += 1000;
    await service.continueDraft(draft.id, { statement: "Fassung B" }, "bob"); // kein Stand mitgeschickt
    expect((await service.listDrafts()).find((d) => d.id === draft.id)?.payload.statement).toBe(
      "Fassung B",
    ); // A ist weg
  });

  it("mit dem aktuellen Stand schreibt Tab A — und bekommt einen NEUEN Stand zurück", async () => {
    const { service, uhr } = dienst();
    const draft = await service.createDraft({ title: "T", statement: "Ursprung" }, "anna");
    uhr.t += 1000;
    const a = await service.continueDraft(draft.id, { statement: "Fassung A" }, "anna", {
      expectedUpdatedAt: draft.updatedAt,
    });
    expect(a.payload.statement).toBe("Fassung A");
    expect(a.updatedAt).not.toBe(draft.updatedAt);
  });

  it("mit einem ALTEN Stand schreibt Tab B NICHT: DRAFT_STALE, der Entwurf bleibt Fassung A", async () => {
    const { service, uhr } = dienst();
    const draft = await service.createDraft({ title: "T", statement: "Ursprung" }, "anna");
    const gesehenVonB = draft.updatedAt; // Tab B hat den Ursprung geladen …
    uhr.t += 1000;
    await service.continueDraft(draft.id, { statement: "Fassung A" }, "anna", {
      expectedUpdatedAt: draft.updatedAt,
    }); // … Tab A hat inzwischen gespeichert.
    uhr.t += 1000;
    const versuch = service.continueDraft(draft.id, { statement: "Fassung B" }, "bob", {
      expectedUpdatedAt: gesehenVonB,
    });
    await expect(versuch).rejects.toBeInstanceOf(DraftStaleError);
    await expect(versuch).rejects.toMatchObject({ code: "DRAFT_STALE" });
    const stand = (await service.listDrafts()).find((d) => d.id === draft.id);
    expect(stand?.payload.statement).toBe("Fassung A"); // nichts überschrieben
    expect(stand?.lastEditor).toBe("anna");
  });

  it("der Konflikt nennt den gespeicherten Stand, gegen den nach dem Neuladen geschrieben wird", async () => {
    const { service, uhr } = dienst();
    const draft = await service.createDraft({ title: "T", statement: "U" }, "anna");
    uhr.t += 1000;
    const a = await service.continueDraft(draft.id, { statement: "A" }, "anna");
    try {
      await service.continueDraft(draft.id, { statement: "B" }, "bob", {
        expectedUpdatedAt: draft.updatedAt,
      });
      throw new Error("kein Konflikt");
    } catch (e) {
      expect(e).toBeInstanceOf(DraftStaleError);
      expect((e as DraftStaleError).currentUpdatedAt).toBe(a.updatedAt);
      expect((e as DraftStaleError).message).toContain("neu laden");
    }
  });

  it("requireFresh: derselbe Vergleich für Wege, die nicht über continueDraft schreiben (Promote ohne Stand)", async () => {
    const { service, uhr } = dienst();
    const draft = await service.createDraft({ title: "T", statement: "U" }, "anna");
    await expect(service.requireFresh(draft.id, draft.updatedAt)).resolves.toBeUndefined();
    uhr.t += 1000;
    await service.continueDraft(draft.id, { statement: "A" }, "anna");
    await expect(service.requireFresh(draft.id, draft.updatedAt)).rejects.toMatchObject({
      code: "DRAFT_STALE",
    });
  });

  it("updatedAt steigt STRENG — zwei Schreibvorgänge in derselben Millisekunde tragen nie denselben Stand", async () => {
    const { service } = dienst(); // die Uhr steht still
    const draft = await service.createDraft({ title: "T", statement: "U" }, "anna");
    const a = await service.continueDraft(draft.id, { statement: "A" }, "anna", {
      expectedUpdatedAt: draft.updatedAt,
    });
    expect(a.updatedAt).not.toBe(draft.updatedAt);
    // Der alte Stand (des zweiten Tabs) kommt auch bei stehender Uhr nicht mehr durch.
    await expect(
      service.continueDraft(draft.id, { statement: "B" }, "bob", {
        expectedUpdatedAt: draft.updatedAt,
      }),
    ).rejects.toMatchObject({ code: "DRAFT_STALE" });
  });
});
