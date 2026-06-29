import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  BODY_READ_BLOCKS_KEY,
  BODY_READ_NOTE_KEY,
  BODY_READ_TITLE_KEY,
  bodyReadMode,
  hasBody,
  hasBodyBlocks,
} from "../../apps/web/src/lib/bodyReadMode";

// SCRUM-318: DOM-freie Erkennung für den Lesemodus des ausführlichen Inhalts (bodyHtml).
describe("SCRUM-318: bodyReadMode", () => {
  it("erkennt leeren/whitespace-Body als kein Body", () => {
    expect(hasBody("")).toBe(false);
    expect(hasBody(null)).toBe(false);
    expect(hasBody(undefined)).toBe(false);
    expect(hasBody("<p></p>")).toBe(false);
    expect(hasBody("<p>echter Inhalt</p>")).toBe(true);
  });

  it("erkennt Body-Blöcke an den statischen panel-Klassen", () => {
    expect(hasBodyBlocks('<div class="panel"><p>x</p></div>')).toBe(true);
    for (const v of ["info", "note", "warning", "success"]) {
      expect(hasBodyBlocks(`<div class="panel panel-${v}"><p>x</p></div>`)).toBe(true);
    }
    // gewöhnliche Absätze sind keine Blöcke.
    expect(hasBodyBlocks("<p>nur Text</p>")).toBe(false);
    // fremde panel-artige Wörter ohne echte Klasse triggern nicht fälschlich.
    expect(hasBodyBlocks("<p>das Panel im Auto</p>")).toBe(false);
    expect(hasBodyBlocks('<div class="not-panel"><p>x</p></div>')).toBe(false);
  });

  it("bodyReadMode kombiniert hasBody + hasBlocks", () => {
    expect(bodyReadMode("")).toEqual({ hasBody: false, hasBlocks: false });
    expect(bodyReadMode("<p>Text</p>")).toEqual({ hasBody: true, hasBlocks: false });
    expect(bodyReadMode('<p>Text</p><div class="panel panel-warning"><p>!</p></div>')).toEqual({
      hasBody: true,
      hasBlocks: true,
    });
  });

  it("liefert stabile i18n-Keys, alle DE+EN vorhanden", () => {
    expect(BODY_READ_TITLE_KEY).toBe("ko.body.readTitle");
    expect(BODY_READ_NOTE_KEY).toBe("ko.body.readNote");
    expect(BODY_READ_BLOCKS_KEY).toBe("ko.body.readBlocksChip");
    for (const key of [BODY_READ_TITLE_KEY, BODY_READ_NOTE_KEY, BODY_READ_BLOCKS_KEY]) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("bleibt ehrlich: Hinweis nennt Status/Trust/Quellen als maßgeblich (DE)", () => {
    const note = String(i18n.getResource("de", "translation", BODY_READ_NOTE_KEY) ?? "");
    expect(note).toMatch(/Status/i);
    expect(note).toMatch(/Quellen/i);
  });
});
