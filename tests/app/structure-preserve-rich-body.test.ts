// WP-D6 (Pedi-LIVE-BEFUND): Der KI-Struktur-Vorschlag darf beim Dokument-Import Bilder/Formatierung
// NICHT zerstören. „Original ist heilig" gilt auch für den Vorschlag: ist der Body reich (Bilder,
// Überschriften, Listen, Tabellen, Quelle-Blockquote), wird beim Übernehmen NUR der Titel gesetzt und
// das bodyHtml UNANGETASTET gelassen; ein reiner Text-Body darf wie bisher strukturiert werden. Reine,
// DOM-freie Helfer-Tests plus Source-Inspektion der Verdrahtung in CaptureFrontDoor.tsx.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { StructureResult } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { shouldPreserveRichBody } from "../../apps/web/src/lib/bodyAiAssist";
import { frontDoorStructuredBodyHtml } from "../../apps/web/src/lib/captureFrontDoor";

const PROPOSAL: StructureResult = {
  title: "Kalibrierung der Dosierpumpe",
  statement: "Nach jedem Schichtwechsel neu kalibrieren.",
  conditions: ["Vor Schichtbeginn"],
  measures: ["Dosierwert prüfen"],
  tags: ["Wartung"],
  confidence: 0,
  demo: false,
};

// Spiegelt acceptStructureProposal (CaptureFrontDoor.tsx) 1:1: reicher Body ⇒ nur Titel, Body bleibt;
// sonst wird der Body durch die strukturierte Fassung ersetzt.
function simulateAccept(
  bodyHtml: string,
  proposal: StructureResult,
  currentTitle: string,
): { title: string; bodyHtml: string; preserved: boolean } {
  const preserved = shouldPreserveRichBody(bodyHtml);
  const title = currentTitle.trim() ? currentTitle : proposal.title;
  return {
    title,
    bodyHtml: preserved ? bodyHtml : frontDoorStructuredBodyHtml(proposal),
    preserved,
  };
}

describe("WP-D6: shouldPreserveRichBody erkennt reiche Bodies", () => {
  it("erkennt Bilder, Überschriften, Listen, Tabellen und Quelle-Blockquote als reich", () => {
    expect(shouldPreserveRichBody('<p>Text</p><img src="/api/objects/x/raw">')).toBe(true);
    expect(shouldPreserveRichBody("<h2>Titel</h2><p>x</p>")).toBe(true);
    expect(shouldPreserveRichBody("<ul><li>a</li></ul>")).toBe(true);
    expect(shouldPreserveRichBody("<ol><li>a</li></ol>")).toBe(true);
    expect(shouldPreserveRichBody("<table><tr><td>a</td></tr></table>")).toBe(true);
    expect(shouldPreserveRichBody("<blockquote><p>Quelle: x</p></blockquote>")).toBe(true);
  });

  it("reiner Absatz-/Inline-Text ist NICHT reich (darf strukturiert werden)", () => {
    expect(shouldPreserveRichBody("<p>Nur ein Absatz.</p>")).toBe(false);
    expect(shouldPreserveRichBody("<p>Fett: <strong>x</strong> und <em>y</em>.</p>")).toBe(false);
    expect(shouldPreserveRichBody("")).toBe(false);
    expect(shouldPreserveRichBody(null)).toBe(false);
    expect(shouldPreserveRichBody(undefined)).toBe(false);
  });
});

describe("WP-D6: Übernahme des Struktur-Vorschlags lässt reichen Body unversehrt", () => {
  it("Body mit Bild + h2 + Liste ⇒ Body UNVERÄNDERT, nur Titel übernommen", () => {
    const rich =
      '<blockquote><p>Quelle: baader.docx, gesamtes Dokument</p></blockquote><h2>Zeichnung 1</h2><p>Beschreibung</p><ul><li>Punkt</li></ul><img src="/api/objects/abc/raw" alt="Zeichnung">';
    const result = simulateAccept(rich, PROPOSAL, "");
    expect(result.preserved).toBe(true);
    // Der reiche Body bleibt Byte-für-Byte erhalten — kein Bild-/Formatverlust.
    expect(result.bodyHtml).toBe(rich);
    // Titel wird übernommen, weil das Titelfeld leer war.
    expect(result.title).toBe(PROPOSAL.title);
    // Insbesondere bleiben Bild und Struktur enthalten.
    expect(result.bodyHtml).toContain("<img");
    expect(result.bodyHtml).toContain("<h2>");
    expect(result.bodyHtml).toContain("<ul>");
  });

  it("vorhandener Titel bleibt erhalten (Vorschlag überschreibt ihn nicht)", () => {
    const rich = "<h2>A</h2><p>x</p>";
    const result = simulateAccept(rich, PROPOSAL, "Mein Titel");
    expect(result.title).toBe("Mein Titel");
    expect(result.bodyHtml).toBe(rich);
  });

  it("reiner Text-Body ⇒ Vorschlag darf wie bisher strukturieren", () => {
    const plain = "<p>Ein einfacher Fließtext ohne Struktur.</p>";
    const result = simulateAccept(plain, PROPOSAL, "");
    expect(result.preserved).toBe(false);
    expect(result.bodyHtml).toBe(frontDoorStructuredBodyHtml(PROPOSAL));
    expect(result.bodyHtml).toContain("<h2>");
  });

  it("Fallback-Vorschlag (demo=true) zerstört einen reichen Body genauso wenig", () => {
    const fallback: StructureResult = { ...PROPOSAL, demo: true };
    const rich = '<h2>T</h2><img src="/api/objects/z/raw"><ul><li>a</li></ul>';
    const result = simulateAccept(rich, fallback, "");
    // Die Entscheidung hängt am Body, nicht an der Herkunft (Fallback vs. echte KI).
    expect(result.preserved).toBe(true);
    expect(result.bodyHtml).toBe(rich);
  });
});

describe("WP-D6: CaptureFrontDoor verdrahtet den Schutz + ehrliche Meldung", () => {
  const source = readFileSync(
    resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
    "utf8",
  );

  it("acceptStructureProposal prüft shouldPreserveRichBody VOR dem Ersetzen des Body", () => {
    const decide = source.indexOf("shouldPreserveRichBody(bodyHtml)");
    const replace = source.indexOf("setBodyHtml(frontDoorStructuredBodyHtml(structureProposal))");
    expect(decide).toBeGreaterThan(-1);
    expect(replace).toBeGreaterThan(-1);
    // Die Preserve-Entscheidung steht VOR dem (nun bedingten) Body-Ersetzen.
    expect(decide).toBeLessThan(replace);
    // Das Ersetzen ist an "nicht erhalten" gebunden (kein bedingungsloses setBodyHtml mehr).
    expect(source).toContain("if (!preserveBody) {");
  });

  it("zeigt die ehrliche Meldung, dass nur der Titel uebernommen wird und der Inhalt bleibt", () => {
    expect(source).toContain('t("fd.structureKeptRichBody")');
    for (const lng of ["de", "en", "nl"]) {
      const msg = String(i18n.getResource(lng, "translation", "fd.structureKeptRichBody"));
      expect(msg.length, `${lng}`).toBeGreaterThan(0);
    }
    // DE nennt Bilder UND Formatierung als erhalten und verspricht keinen Ersatz.
    const de = String(i18n.getResource("de", "translation", "fd.structureKeptRichBody"));
    expect(de).toMatch(/Bilder/);
    expect(de).toMatch(/unverändert/);
  });
});
