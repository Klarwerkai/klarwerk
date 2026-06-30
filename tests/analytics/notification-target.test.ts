import { describe, expect, it } from "vitest";
import { notificationTarget } from "../../apps/web/src/lib/notificationTarget";

describe("SCRUM-220: notificationTarget", () => {
  it("Konflikt → /konflikte", () => {
    expect(notificationTarget({ kind: "conflict" })).toBe("/konflikte");
  });

  it("Wissenslücke → /risiko", () => {
    expect(notificationTarget({ kind: "gap" })).toBe("/risiko");
  });

  it("SCRUM-364: Review-Zuweisung fuehrt in die fokussierte Mir-zugewiesen-Linse", () => {
    expect(notificationTarget({ kind: "assignment" })).toBe("/validierung?mine=1");
  });

  it("unbekanntes Kind → null (kein Fake-Ziel)", () => {
    expect(notificationTarget({ kind: "other" as never })).toBeNull();
  });
});
