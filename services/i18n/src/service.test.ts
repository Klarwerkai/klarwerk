import { beforeEach, describe, expect, it } from "vitest";
import { I18nService } from "./service";

describe("I18nService", () => {
  let i18n: I18nService;

  beforeEach(() => {
    i18n = new I18nService({ fallbackLocale: "de" });
    i18n.register("de", { "ko.submit": "Einreichen", "nav.library": "Bibliothek" });
    i18n.register("en", { "ko.submit": "Submit", "nav.library": "Library" });
  });

  it("FR-I18N-01: liefert DE und EN je nach Locale", () => {
    expect(i18n.translate("ko.submit", "de")).toBe("Einreichen");
    expect(i18n.translate("ko.submit", "en")).toBe("Submit");
    expect(i18n.locales()).toEqual(["de", "en"]);
  });

  it("FR-I18N-01: fehlender Key fällt auf die Standardsprache zurück, sonst auf den Key", () => {
    i18n.register("en", { only: "english-only" });
    // 'nav.library' fehlt nicht; teste einen nur in DE vorhandenen Key:
    i18n.register("de", { "de.only": "nur Deutsch" });
    expect(i18n.translate("de.only", "en")).toBe("nur Deutsch"); // Fallback DE
    expect(i18n.translate("unbekannt", "en")).toBe("unbekannt"); // Key selbst
  });

  it("FR-I18N-02: neue Sprache ohne Code-Umbau ergänzbar", () => {
    i18n.register("fr", { "ko.submit": "Soumettre" });
    expect(i18n.has("fr")).toBe(true);
    expect(i18n.translate("ko.submit", "fr")).toBe("Soumettre");
    expect(i18n.translate("nav.library", "fr")).toBe("Bibliothek"); // Fallback DE
  });
});
