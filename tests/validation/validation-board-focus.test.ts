import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  applyBoardFocusParams,
  boardEmptyKind,
  boardFocusActive,
  resetBoardFocusParams,
} from "../../apps/web/src/lib/validationBoardFocus";

// SCRUM-328: DOM-freie Helfer für URL-Sync, aktive Filter und Empty-State des Validation Boards.
describe("SCRUM-328: validationBoardFocus", () => {
  it("boardFocusActive: nur aktiv, wenn ein Filter vom Standard abweicht", () => {
    expect(boardFocusActive({ origin: "all", review: "all" })).toBe(false);
    expect(boardFocusActive({ origin: "demo", review: "all" })).toBe(true);
    expect(boardFocusActive({ origin: "all", review: "revision" })).toBe(true);
    expect(boardFocusActive({ origin: "non-demo", review: "new" })).toBe(true);
  });

  it("applyBoardFocusParams: Standard 'all' entfernt, Werte gesetzt", () => {
    const out = applyBoardFocusParams(new URLSearchParams(""), {
      origin: "demo",
      review: "revision",
    });
    expect(out.get("origin")).toBe("demo");
    expect(out.get("review")).toBe("revision");

    const reset = applyBoardFocusParams(new URLSearchParams("origin=demo&review=new"), {
      origin: "all",
      review: "all",
    });
    expect(reset.has("origin")).toBe(false);
    expect(reset.has("review")).toBe(false);
  });

  it("applyBoardFocusParams: übrige Query-Parameter bleiben erhalten (z. B. demo=stage1)", () => {
    const out = applyBoardFocusParams(new URLSearchParams("demo=stage1&origin=non-demo"), {
      origin: "demo",
      review: "new",
    });
    expect(out.get("demo")).toBe("stage1");
    expect(out.get("origin")).toBe("demo");
    expect(out.get("review")).toBe("new");
  });

  it("resetBoardFocusParams: entfernt origin/review, erhält Rest", () => {
    const out = resetBoardFocusParams(
      new URLSearchParams("demo=stage1&origin=demo&review=revision"),
    );
    expect(out.has("origin")).toBe(false);
    expect(out.has("review")).toBe(false);
    expect(out.get("demo")).toBe("stage1");
  });

  it("boardEmptyKind: not-empty / none / filtered", () => {
    expect(boardEmptyKind({ totalItems: 5, visibleCount: 3 })).toBe("not-empty");
    expect(boardEmptyKind({ totalItems: 0, visibleCount: 0 })).toBe("none");
    expect(boardEmptyKind({ totalItems: 5, visibleCount: 0 })).toBe("filtered");
  });

  it("i18n-Keys für aktive Filter / Reset / Empty sind DE+EN vorhanden", () => {
    const keys = [
      "val.focusActive.label",
      "val.focusReset",
      "val.focusEmpty.filtered",
      "val.focusEmpty.otherFilters",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });
});
