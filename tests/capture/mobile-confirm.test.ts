import { describe, expect, it } from "vitest";
import {
  NO_CONFIRM,
  clearConfirm,
  isPending,
  requestConfirm,
} from "../../apps/web/src/lib/mobileConfirm";

// R-1349 (Aufnahme gesamt-aufruferwaechter): `needsConfirmation` und `confirmsDelete` sind entfernt —
// zwei Zweitnamen für `isPending` ohne Produktleser. Ihre Zusagen gelten für `isPending`, das Mobil
// fragt, und werden dort gemessen.
describe("SCRUM-87 / FR-MOB-03: mobileConfirm", () => {
  it("erster Klick markiert genau diesen Eintrag als pending", () => {
    const s = requestConfirm("d1");
    expect(isPending(s, "d1")).toBe(true);
    expect(isPending(s, "d2")).toBe(false);
    // Vor dem ersten Klick braucht der Eintrag noch eine Bestätigung (nicht pending).
    expect(isPending(NO_CONFIRM, "d1")).toBe(false);
  });

  it("cancel löscht pending", () => {
    const cleared = clearConfirm();
    expect(cleared.pendingId).toBeNull();
    expect(isPending(cleared, "d1")).toBe(false);
  });

  it("confirm erkennt den finalen Löschschritt nur für den pending-Eintrag", () => {
    const s = requestConfirm("d1");
    expect(isPending(s, "d1")).toBe(true);
    expect(isPending(s, "d2")).toBe(false);
    expect(isPending(NO_CONFIRM, "d1")).toBe(false);
  });

  it("ein anderer Eintrag ersetzt pending sauber (nur einer aktiv)", () => {
    let s = requestConfirm("d1");
    s = requestConfirm("d2");
    expect(isPending(s, "d2")).toBe(true);
    expect(isPending(s, "d1")).toBe(false);
  });
});
