import { describe, expect, it } from "vitest";
import {
  EMPTY_DRAFT_FORM,
  draftToForm,
  isDraftFormChanged,
} from "../../apps/web/src/lib/draftForm";

const draft = {
  id: "draft-review26-3463",
  payload: {
    title: "Schichtwechsel",
    statement: "Dosierwert kontrollieren.",
    bodyHtml: "<p>Vor dem Start die Pumpe prüfen.</p>",
  },
};
const baseline = draftToForm(draft);

describe("Mobil: reiner Standvergleich", () => {
  it("gleicher Stand ist nicht verändert", () => {
    expect(isDraftFormChanged({ ...baseline }, baseline)).toBe(false);
  });

  it.each(["title", "statement", "body"] as const)("ein Zeichen in %s ist verändert", (field) => {
    expect(isDraftFormChanged({ ...baseline, [field]: `${baseline[field]}!` }, baseline)).toBe(
      true,
    );
  });

  it("nur äußere Leerzeichen sind keine Änderung", () => {
    expect(
      isDraftFormChanged(
        {
          ...baseline,
          title: ` ${baseline.title}\n`,
          statement: `\t${baseline.statement} `,
          body: `\n${baseline.body}\n`,
        },
        baseline,
      ),
    ).toBe(false);
  });

  it("gleicher Text mit neu erzeugten Segmenten ist keine Änderung", () => {
    const resumedAgain = draftToForm(draft);
    expect(resumedAgain.segments).not.toBe(baseline.segments);
    expect(resumedAgain.segments).toEqual(baseline.segments);
    expect(isDraftFormChanged(resumedAgain, baseline)).toBe(false);
  });

  it.each(["title", "statement", "body"] as const)(
    "neues Formular mit %s ist verändert",
    (field) => {
      expect(isDraftFormChanged({ ...EMPTY_DRAFT_FORM, [field]: "Neu" }, EMPTY_DRAFT_FORM)).toBe(
        true,
      );
    },
  );

  it("fehlender und leerer Body sind derselbe Stand", () => {
    expect(isDraftFormChanged({ ...EMPTY_DRAFT_FORM, body: " " }, EMPTY_DRAFT_FORM)).toBe(false);
  });

  it("vollständig gelöschter gespeicherter Inhalt bleibt eine Änderung", () => {
    expect(isDraftFormChanged(EMPTY_DRAFT_FORM, baseline)).toBe(true);
  });
});
