// WP-BILD-1f (Pedis Befund): die Karten auf /validierung zeigen neben dem Erstellungsdatum jetzt
// auch den ERSTELLER — aus dem VORHANDENEN KO-Vertrag (author ist Pflichtfeld, über das
// Nutzer-Verzeichnis zum Namen aufgelöst). Nichts wird erfunden: fehlt ein Feld bei Altdaten,
// bleibt es ehrlich weg (leerer author → keine Anzeige).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Validation.tsx"), "utf8");
const i18n = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");

describe("WP-BILD-1f: Ersteller auf den Validierungs-Karten", () => {
  it("die Karte zeigt den Ersteller aus dem KO-Vertrag (author → Verzeichnis-Name) neben dem Datum", () => {
    // Ersteller aus dem VORHANDENEN Feld, nie erfunden; leere Altdaten → leerer String → weggelassen.
    expect(src).toContain('const createdByName = k.author ? nameOf(k.author).trim() : ""');
    // Anzeige haengt an Datum ODER Ersteller — beides fehlend (Altdaten) → ehrlich nichts.
    expect(src).toContain("createdLabel || createdByName ?");
    expect(src).toContain('t("ko.createdByName", { name: createdByName })');
  });

  it("das von-Label existiert in DE, EN und NL und traegt den Namens-Platzhalter", () => {
    expect(i18n.split('"ko.createdByName":').length - 1).toBe(3);
    expect(i18n).toContain('"ko.createdByName": "von {{name}}"');
    expect(i18n).toContain('"ko.createdByName": "by {{name}}"');
    expect(i18n).toContain('"ko.createdByName": "door {{name}}"');
  });
});
