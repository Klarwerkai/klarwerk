import { afterEach, describe, expect, it } from "vitest";
import i18n from "../i18n";
import { auditActionLabel } from "./auditAction";

// SCRUM-513/487 (WP5): rohe Audit-Codes werden lokalisiert; unbekannte neutral humanisiert (kein Roh-
// Code, kein Deutsch in EN/NL).

afterEach(async () => {
  await i18n.changeLanguage("de");
});

describe("auditActionLabel", () => {
  it("bekannte Aktion → lokalisiert (DE)", () => {
    expect(auditActionLabel("ko.purged", i18n.t)).toBe("Endgültig gelöscht");
    expect(auditActionLabel("ko.created", i18n.t)).toBe("Angelegt");
  });

  it("bekannte Aktion → lokalisiert (EN, kein Deutsch)", async () => {
    await i18n.changeLanguage("en");
    expect(auditActionLabel("ko.purged", i18n.t)).toBe("Permanently deleted");
    expect(auditActionLabel("ko.source-added", i18n.t)).toBe("Source added");
  });

  it("unbekannte Aktion → neutrale Humanisierung (kein roher Code)", () => {
    expect(auditActionLabel("weird.custom-thing", i18n.t)).toBe("weird custom thing");
  });
});
