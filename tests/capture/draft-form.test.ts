import { describe, expect, it } from "vitest";
import type { Draft } from "../../apps/web/src/api/types";
import {
  draftTitle,
  draftToForm,
  formToPayload,
  isDraftFormFillable,
  isPromotable,
} from "../../apps/web/src/lib/draftForm";

const draft = (payload: Draft["payload"]): Draft =>
  ({
    id: "d1",
    payload,
    originalAuthor: "anna",
    lastEditor: "anna",
    createdAt: "t",
    updatedAt: "t",
  }) as Draft;

describe("SCRUM-113 / FE-CAP-07: draftForm", () => {
  it("formToPayload übernimmt nur gesetzte, getrimmte Felder", () => {
    expect(formToPayload({ title: "  Idee  ", statement: "" })).toEqual({ title: "Idee" });
    expect(formToPayload({ title: " ", statement: " Aussage " })).toEqual({ statement: "Aussage" });
    expect(formToPayload({ title: "", statement: "" })).toEqual({});
  });

  it("draftToForm lädt Payload ins Formular (Resume)", () => {
    expect(draftToForm(draft({ title: "T", statement: "S" }))).toEqual({
      title: "T",
      statement: "S",
    });
    expect(draftToForm(draft({}))).toEqual({ title: "", statement: "" });
  });

  it("isDraftFormFillable bei beliebigem Inhalt", () => {
    expect(isDraftFormFillable({ title: "x", statement: "" })).toBe(true);
    expect(isDraftFormFillable({ title: "", statement: "y" })).toBe(true);
    expect(isDraftFormFillable({ title: "  ", statement: "  " })).toBe(false);
  });

  it("draftTitle nimmt Titel, sonst Aussage-Anriss, sonst Fallback", () => {
    expect(draftTitle(draft({ title: "Titel" }), "fb")).toBe("Titel");
    expect(draftTitle(draft({ statement: "Eine lange Aussage" }), "fb")).toBe("Eine lange Aussage");
    expect(draftTitle(draft({}), "fb")).toBe("fb");
  });

  it("isPromotable nur bei vollständigen KO-Pflichtfeldern", () => {
    expect(isPromotable({ title: "T", statement: "S" })).toBe(false);
    expect(
      isPromotable({ title: "T", statement: "S", type: "technik", category: "Anlage 1" }),
    ).toBe(true);
  });
});
