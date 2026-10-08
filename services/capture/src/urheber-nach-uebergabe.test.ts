// ================================================================================================
// R-0554 — EIN ÜBERGEBENER ENTWURF TRÄGT SEINE URSPRÜNGLICHE URHEBERIN BIS INS WISSENSOBJEKT.
// ================================================================================================
//
// Die Wissensübergabe (`services/app/src/wissensuebergabe.ts`) setzt `originalAuthor` des Entwurfs
// auf den Nachfolger (Sichtbarkeit, „meine Entwürfe") und hält die Urheberin in `urheber` fest.
// Reicht der Nachfolger ein, ist er Autor des Objekts — die Urheberin bleibt `originalAuthor`.
import { describe, expect, it } from "vitest";
import { InMemoryDraftRepo } from "./repo";
import { CaptureService } from "./service";
import type { Draft } from "./types";

const PAYLOAD = {
  title: "Ventil schließen",
  statement: "Bei Überdruck schließen.",
  type: "best_practice" as const,
  category: "Anlage 1",
  confidentiality: "intern" as const,
};

describe("R-0554 · Urheberschaft eines übergebenen Entwurfs", () => {
  it("nach der Übergabe: Nachfolger ist Autor, die Urheberin bleibt originalAuthor", async () => {
    const repo = new InMemoryDraftRepo();
    const service = new CaptureService({ repo });
    const draft = await service.createDraft(PAYLOAD, "anna");
    const uebergeben: Draft = { ...draft, originalAuthor: "bert", urheber: "anna" };
    await repo.update(uebergeben);

    const koInput = await service.toKoInput(draft.id);
    expect(koInput.author).toBe("bert");
    expect(koInput.originalAuthor).toBe("anna");
  });

  it("ohne Übergabe bleibt alles wie bisher: kein originalAuthor-Feld am Eingang", async () => {
    const service = new CaptureService({ repo: new InMemoryDraftRepo() });
    const draft = await service.createDraft(PAYLOAD, "anna");
    const koInput = await service.toKoInput(draft.id);
    expect(koInput.author).toBe("anna");
    expect("originalAuthor" in koInput).toBe(false);
  });
});
