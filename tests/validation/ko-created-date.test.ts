// WP-D10 (Fix 4, Pedis Live-Befund): Karten auf /validierung zeigten kein Erstellungsdatum —
// gleichnamige Beiträge waren nicht unterscheidbar. Jetzt wird das VORHANDENE KO-Feld createdAt
// lokalisiert angezeigt (Karte + KO-Detail); fehlt das Feld bei Altdaten oder ist es unparsebar,
// wird die Zeile EHRLICH weggelassen (kein Platzhalter-Datum). Keine neue Persistenz.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { formatKoTimestamp } from "../../apps/web/src/lib/koDates";

describe("WP-D10 Fix 4: formatKoTimestamp", () => {
  it("formatiert ISO-Zeitstempel lokalisiert als Datum + Uhrzeit (DE: 20.07.2026 19:41)", () => {
    // Fester UTC-Zeitpunkt; das Format wird über die Bestandteile geprüft (Zeitzone des Runners egal).
    const out = formatKoTimestamp("2026-07-20T19:41:00.000Z", "de");
    expect(out).toMatch(/^\d{2}\.\d{2}\.2026 \d{2}:\d{2}$/);
    const en = formatKoTimestamp("2026-07-20T19:41:00.000Z", "en");
    expect(en).toMatch(/2026/);
    expect(en).toMatch(/\d{1,2}:\d{2}/);
  });

  it("Altdaten ohne/mit kaputtem Feld → null (ehrlich weglassen, KEIN Platzhalter-Datum)", () => {
    expect(formatKoTimestamp(undefined, "de")).toBeNull();
    expect(formatKoTimestamp(null, "de")).toBeNull();
    expect(formatKoTimestamp("", "de")).toBeNull();
    expect(formatKoTimestamp("   ", "de")).toBeNull();
    expect(formatKoTimestamp("kein-datum", "de")).toBeNull();
  });
});

describe("WP-D10 Fix 4: Verdrahtung Karte + Detail, i18n", () => {
  it("Validierungs-Karte rendert das Datum aus dem KO-Feld (mit ehrlichem Weglassen)", () => {
    const src = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Validation.tsx"), "utf8");
    expect(src).toContain("formatKoTimestamp(k.createdAt, i18n.language)");
    // Bedingtes Rendern: ohne parsebares Datum erscheint nichts.
    expect(src).toContain("createdLabel ? (");
    expect(src).toContain('t("ko.createdAt")');
  });

  it("KO-Detail zeigt das Erstellungsdatum ebenfalls (Signale-/Kopfzeile)", () => {
    const src = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/KnowledgeDetail.tsx"),
      "utf8",
    );
    expect(src).toContain("formatKoTimestamp(ko.createdAt, i18n.language)");
  });

  it("Label existiert DE/EN/NL", () => {
    for (const lng of ["de", "en", "nl"]) {
      expect(
        String(i18n.getResource(lng, "translation", "ko.createdAt")).length,
        lng,
      ).toBeGreaterThan(0);
    }
    expect(String(i18n.getResource("de", "translation", "ko.createdAt"))).toBe("Erstellt am");
  });
});
