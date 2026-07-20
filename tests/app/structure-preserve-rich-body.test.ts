// WP-D6/WP-D6b (Pedi-LIVE-BEFUND + bens ROT/GELB-Auflagen): Der KI-Struktur-Vorschlag darf einen Body
// mit Bildern/Struktur/Formatierung NICHT zerstören. Die Preserve-Entscheidung ist konservativ aus dem
// autoritativen Rich-Text-Tag-Vertrag abgeleitet (nur p/br/Text = flach). Die Übernahme läuft über die
// PURE applyStructureProposal — dieselbe Funktion, die der echte Handler nutzt (kein simulateAccept-Klon).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { StructureResult } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import {
  applyStructureProposal,
  shouldPreserveRichBody,
} from "../../apps/web/src/lib/bodyAiAssist";
import { fileLinkHtml } from "../../apps/web/src/lib/bodyFileLink";
import { frontDoorStructuredBodyHtml } from "../../apps/web/src/lib/captureFrontDoor";
import { editorBlockClass } from "../../apps/web/src/lib/editorBlocks";

const PROPOSAL: StructureResult = {
  title: "Kalibrierung der Dosierpumpe",
  statement: "Nach jedem Schichtwechsel neu kalibrieren.",
  conditions: ["Vor Schichtbeginn"],
  measures: ["Dosierwert prüfen"],
  tags: ["Wartung"],
  confidence: 0,
  demo: false,
};

describe("WP-D6b: shouldPreserveRichBody deckt produkteigene Rich-Konstrukte ab", () => {
  it("Editor-Panel (div.panel) ist reich", () => {
    const html = `<div class="${editorBlockClass("info")}"><p>Hinweis</p></div>`;
    expect(shouldPreserveRichBody(html)).toBe(true);
  });

  it("Anhang-Block (div.attachment) mit Link ist reich", () => {
    const html = `<p>Text</p>${fileLinkHtml({ objectId: "abc", name: "datei.pdf" })}`;
    expect(shouldPreserveRichBody(html)).toBe(true);
  });

  it("Inline-Formatierung strong/em/u ist reich", () => {
    expect(
      shouldPreserveRichBody("<p>Text <strong>fett</strong> <em>kursiv</em> <u>unter</u></p>"),
    ).toBe(true);
  });

  it("Link <a href> ist reich", () => {
    expect(shouldPreserveRichBody('<p>Siehe <a href="/x">Link</a></p>')).toBe(true);
  });

  it("isolierte Tabellenfragmente (tr/td, thead/th) sind reich", () => {
    expect(shouldPreserveRichBody("<tr><td>Zelle</td></tr>")).toBe(true);
    expect(shouldPreserveRichBody("<thead><tr><th>Kopf</th></tr></thead>")).toBe(true);
    expect(shouldPreserveRichBody("<tbody><tr><td>x</td></tr></tbody>")).toBe(true);
  });

  it("bisherige Fälle bleiben reich (img/h2/ul/ol/table/blockquote)", () => {
    expect(shouldPreserveRichBody('<img src="/api/objects/x/raw">')).toBe(true);
    expect(shouldPreserveRichBody("<h2>T</h2>")).toBe(true);
    expect(shouldPreserveRichBody("<ul><li>a</li></ul>")).toBe(true);
    expect(shouldPreserveRichBody("<ol><li>a</li></ol>")).toBe(true);
    expect(shouldPreserveRichBody("<table><tr><td>a</td></tr></table>")).toBe(true);
    expect(shouldPreserveRichBody("<blockquote><p>q</p></blockquote>")).toBe(true);
  });

  it("wirklich flacher p/br/Text-Body ist NICHT reich (darf strukturiert werden)", () => {
    expect(shouldPreserveRichBody("<p>Nur ein Absatz.</p>")).toBe(false);
    expect(shouldPreserveRichBody("<p>Zeile eins<br>Zeile zwei</p><p>Zweiter Absatz</p>")).toBe(
      false,
    );
    expect(shouldPreserveRichBody("Reiner Text ohne Tags")).toBe(false);
    expect(shouldPreserveRichBody("")).toBe(false);
    expect(shouldPreserveRichBody(null)).toBe(false);
    expect(shouldPreserveRichBody(undefined)).toBe(false);
  });
});

describe("WP-D6b: applyStructureProposal (pure Übernahme-Entscheidung, Matrix)", () => {
  const RICH = '<h2>Zeichnung</h2><p>x</p><img src="/api/objects/abc/raw">';
  const FLAT = "<p>Ein einfacher Fließtext.</p>";

  it("reich + Titel leer → Body byte-identisch, Titel übernommen, titleAdopted", () => {
    const r = applyStructureProposal({
      currentTitle: "",
      currentBodyHtml: RICH,
      proposal: PROPOSAL,
    });
    expect(r.preserved).toBe(true);
    expect(r.bodyHtml).toBe(RICH); // byte-identisch
    expect(r.title).toBe(PROPOSAL.title);
    expect(r.titleAdopted).toBe(true);
  });

  it("reich + Titel gesetzt → Body byte-identisch, vorhandener Titel bleibt, NICHT adopted", () => {
    const r = applyStructureProposal({
      currentTitle: "Mein Titel",
      currentBodyHtml: RICH,
      proposal: PROPOSAL,
    });
    expect(r.preserved).toBe(true);
    expect(r.bodyHtml).toBe(RICH);
    expect(r.title).toBe("Mein Titel");
    expect(r.titleAdopted).toBe(false);
  });

  it("flach + Titel leer → Body strukturiert, Titel übernommen", () => {
    const r = applyStructureProposal({
      currentTitle: "",
      currentBodyHtml: FLAT,
      proposal: PROPOSAL,
    });
    expect(r.preserved).toBe(false);
    expect(r.bodyHtml).toBe(frontDoorStructuredBodyHtml(PROPOSAL));
    expect(r.title).toBe(PROPOSAL.title);
    expect(r.titleAdopted).toBe(true);
  });

  it("flach + Titel gesetzt → Body strukturiert, vorhandener Titel bleibt", () => {
    const r = applyStructureProposal({
      currentTitle: "Behalten",
      currentBodyHtml: FLAT,
      proposal: PROPOSAL,
    });
    expect(r.preserved).toBe(false);
    expect(r.bodyHtml).toBe(frontDoorStructuredBodyHtml(PROPOSAL));
    expect(r.title).toBe("Behalten");
    expect(r.titleAdopted).toBe(false);
  });

  it("alle Gegenbeispiele aus Fix 1 bleiben beim Übernehmen byte-identisch", () => {
    const bodies = [
      `<div class="${editorBlockClass("warning")}"><p>Warnung</p></div>`,
      `<p>Vor</p>${fileLinkHtml({ objectId: "obj-9", name: "plan.pdf" })}`,
      '<p>Mit <a href="/ziel">Link</a> und <strong>Fett</strong>.</p>',
      "<tr><td>Zelle</td></tr>",
    ];
    for (const body of bodies) {
      const r = applyStructureProposal({
        currentTitle: "T",
        currentBodyHtml: body,
        proposal: PROPOSAL,
      });
      expect(r.preserved, body).toBe(true);
      expect(r.bodyHtml, body).toBe(body);
    }
  });
});

describe("WP-D6b: echter Kontrollfluss — genau EINE Body-Ersetzung, im !preserved-Zweig", () => {
  const assistSource = readFileSync(
    resolve(process.cwd(), "apps/web/src/lib/bodyAiAssist.ts"),
    "utf8",
  );
  const frontDoorSource = readFileSync(
    resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
    "utf8",
  );

  it("frontDoorStructuredBodyHtml(...) wird GENAU einmal aufgerufen und hängt am !preserved-Zweig", () => {
    const calls = assistSource.match(/frontDoorStructuredBodyHtml\(/g) ?? [];
    expect(calls).toHaveLength(1);
    // Der einzige Aufruf ist der false-Zweig des preserved-Ternaries (kein bedingungsloses Ersetzen):
    // preserved ? <Body byte-identisch> : frontDoorStructuredBodyHtml(...). Whitespace-robust geprüft.
    expect(assistSource).toMatch(/preserved\s*\?\s*input\.currentBodyHtml/);
    expect(assistSource).toContain(": frontDoorStructuredBodyHtml(input.proposal)");
  });

  it("CaptureFrontDoor ersetzt den Body NICHT mehr direkt — nur über applyStructureProposal", () => {
    expect(frontDoorSource).not.toContain("frontDoorStructuredBodyHtml");
    expect(frontDoorSource).toContain("applyStructureProposal({");
    expect(frontDoorSource).toContain("setBodyHtml(result.bodyHtml)");
  });
});

describe("WP-D6b: zwei ehrliche, zustandsabhängige Meldungen (DE/EN/NL)", () => {
  const KEYS = ["fd.structureKeptRichBodyTitle", "fd.structureKeptRichBodyNoTitle"];

  it("beide Varianten existieren in allen Sprachen und behaupten KEINE Kernaussage-Übernahme", () => {
    const forbidden = /Kernaussage|key statement|kernboodschap/i;
    for (const key of KEYS) {
      for (const lng of ["de", "en", "nl"]) {
        const msg = String(i18n.getResource(lng, "translation", key));
        expect(msg.length, `${lng}:${key}`).toBeGreaterThan(0);
        expect(msg, `${lng}:${key}`).not.toMatch(forbidden);
      }
    }
  });

  it("Variante (b) sagt: Inhalt bleibt, Vorschlag NICHT in den Inhalt übernommen (DE)", () => {
    const de = String(i18n.getResource("de", "translation", "fd.structureKeptRichBodyNoTitle"));
    expect(de).toMatch(/bleibt erhalten/);
    expect(de).toMatch(/nicht in den Inhalt übernommen/);
  });

  it("Variante (a) sagt ehrlich: Titel übernommen (DE)", () => {
    const de = String(i18n.getResource("de", "translation", "fd.structureKeptRichBodyTitle"));
    expect(de).toMatch(/Titel übernommen/);
  });
});
