// AUFTRAG-mega7 Block A (bens Ship-Blocker): die Leerwert-Semantik des Bodys an den beiden
// Vertragsgrenzen, an denen sie entschieden wird — im Vordertür-Payload (Client) und im partiellen
// Merge des CaptureService (Server). Kein DOM, kein Netz.
//
// Der Vertrag (unverändert aus mega6, jetzt AUCH für bodyHtml):
//   Schlüssel NICHT mitgeschickt ⇒ Altwert bleibt  (Mobil-Speichern mit nur Titel/Aussage)
//   Schlüssel mitgeschickt mit LEERWERT ⇒ Altwert geht  (bewusst geleerter Body)
import { describe, expect, it } from "vitest";
import type { DraftPayload } from "../../apps/web/src/api/types";
import {
  buildFrontDoorPayload,
  submitFrontDoorDraft,
} from "../../apps/web/src/lib/captureFrontDoor";
import { CLEARED_DRAFT_BODY_HTML, draftBodyPatch } from "../../apps/web/src/lib/draftBody";
import { formToPayload } from "../../apps/web/src/lib/draftForm";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import { CaptureService } from "../../services/capture/src/service";
import { InMemoryKoRepo } from "../../services/knowledge-object/src/repo";
import { KoService } from "../../services/knowledge-object/src/service";

const OLD_BODY = "<p>Alter Absatz</p>";

function service(): CaptureService {
  return new CaptureService({ repo: new InMemoryDraftRepo() });
}

describe("mega7 Block A: Leerwert-Semantik des Bodys", () => {
  it("draftBodyPatch trennt „nicht gemeint“ von „ausdrücklich geleert“", () => {
    expect(draftBodyPatch("<p>x</p>", true)).toEqual({ bodyHtml: "<p>x</p>" });
    expect(draftBodyPatch("<p>x</p>", false)).toEqual({ bodyHtml: "<p>x</p>" });
    // Aktualisieren: Löschmarker mit ausdrücklichem Schlüssel.
    expect(draftBodyPatch("   ", true)).toEqual({ bodyHtml: CLEARED_DRAFT_BODY_HTML });
    expect("bodyHtml" in draftBodyPatch("", true)).toBe(true);
    // Anlegen: kein Altwert, also gar kein Feld.
    expect("bodyHtml" in draftBodyPatch("", false)).toBe(false);
  });

  it("Vordertür: geleerter Body reist beim Aktualisieren als ausdrücklicher Leerwert", () => {
    const update = buildFrontDoorPayload({
      title: "Dichtung",
      bodyHtml: "",
      activeDraftId: "d1",
    });
    expect("bodyHtml" in update).toBe(true);
    expect(update.bodyHtml).toBe("");

    const create = buildFrontDoorPayload({ title: "Dichtung", bodyHtml: "" });
    expect("bodyHtml" in create).toBe(false);
  });

  it("Vordertür: submitFrontDoorDraft schickt den Löschmarker vor dem Promote mit", async () => {
    const updated: DraftPayload[] = [];
    await submitFrontDoorDraft(
      { title: "Dichtung", bodyHtml: "", activeDraftId: "d1" },
      {
        createDraft: async () => ({ id: "neu" }),
        updateDraft: async (id, payload) => {
          updated.push(payload);
          return { id };
        },
        promoteDraft: async (id) => ({ id }),
      },
    );
    expect(updated).toHaveLength(1);
    expect(updated[0]).toHaveProperty("bodyHtml");
    expect(updated[0]?.bodyHtml).toBe("");
  });

  it("Server: ein ausdrücklicher Leerwert entfernt den alten Body — auch für das spätere KO", async () => {
    const svc = service();
    const draft = await svc.createDraft(
      {
        title: "Dichtung",
        statement: "Vor Anlauf prüfen.",
        type: "best_practice",
        category: "Instandhaltung",
        bodyHtml: OLD_BODY,
      },
      "u1",
    );

    const cleared = await svc.continueDraft(draft.id, { bodyHtml: "" }, "u1");
    expect(cleared.payload.bodyHtml ?? "").toBe("");

    const ko = await new KoService({ repo: new InMemoryKoRepo() }).create(
      await svc.toKoInput(draft.id),
    );
    expect(ko.bodyHtml ?? "").toBe("");
    expect(JSON.stringify(ko)).not.toContain("Alter Absatz");
  });

  it("Gegenprobe Mobil: ein Speichern mit nur Titel und Aussage behält den vorhandenen Body", async () => {
    const svc = service();
    const draft = await svc.createDraft(
      { title: "Dichtung", statement: "Alt", bodyHtml: OLD_BODY },
      "u1",
    );

    // Genau der Payload, den Mobile.tsx (und die Offline-Queue) sendet — kein bodyHtml-Schlüssel.
    const payload = formToPayload({ title: "Dichtung neu", statement: "Neu" });
    expect("bodyHtml" in payload).toBe(false);

    const merged = await svc.continueDraft(draft.id, payload, "u1");
    expect(merged.payload.bodyHtml).toBe(OLD_BODY);
    expect(merged.payload.title).toBe("Dichtung neu");
  });
});
