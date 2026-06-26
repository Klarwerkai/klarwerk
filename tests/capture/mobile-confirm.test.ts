import { describe, expect, it } from "vitest";
import {
  NO_CONFIRM,
  clearConfirm,
  confirmsDelete,
  isPending,
  needsConfirmation,
  requestConfirm,
} from "../../apps/web/src/lib/mobileConfirm";

describe("SCRUM-87 / FR-MOB-03: mobileConfirm", () => {
  it("erster Klick markiert genau diesen Eintrag als pending", () => {
    const s = requestConfirm("d1");
    expect(isPending(s, "d1")).toBe(true);
    expect(isPending(s, "d2")).toBe(false);
    expect(needsConfirmation(NO_CONFIRM, "d1")).toBe(true);
    expect(needsConfirmation(s, "d1")).toBe(false);
  });

  it("cancel löscht pending", () => {
    const cleared = clearConfirm();
    expect(cleared.pendingId).toBeNull();
    expect(isPending(cleared, "d1")).toBe(false);
  });

  it("confirm erkennt den finalen Löschschritt nur für den pending-Eintrag", () => {
    const s = requestConfirm("d1");
    expect(confirmsDelete(s, "d1")).toBe(true);
    expect(confirmsDelete(s, "d2")).toBe(false);
    expect(confirmsDelete(NO_CONFIRM, "d1")).toBe(false);
  });

  it("ein anderer Eintrag ersetzt pending sauber (nur einer aktiv)", () => {
    let s = requestConfirm("d1");
    s = requestConfirm("d2");
    expect(isPending(s, "d2")).toBe(true);
    expect(isPending(s, "d1")).toBe(false);
  });
});
