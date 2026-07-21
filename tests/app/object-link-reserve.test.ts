// WP-HYG (bens P2-Hinweis aus D1e): die Object-Id-Längen-Reserve lebt ZENTRAL in bodyFileLink
// (dem Modul, das Object-Links besitzt) — keine lokale Kopie mehr bei den Aufrufern. Verhalten
// unverändert (reine Hygiene): der Preflight misst weiterhin mit exakt derselben Link-Erzeugung.
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OBJECT_LINK_ID_RESERVE_CHARS,
  fileLinkHtml,
  reservedObjectLinkHtml,
} from "../../apps/web/src/lib/bodyFileLink";

describe("WP-HYG: zentrale Object-Id-Reserve", () => {
  it("Wert gepinnt (128) und Platzhalter-Link nie kürzer als ein echter UUID-Link", () => {
    expect(OBJECT_LINK_ID_RESERVE_CHARS).toBe(128);
    // Reale Ids sind UUIDs (36 Zeichen) — der reservierte Link ist beweisbar mindestens so lang.
    const realistic = fileLinkHtml({
      objectId: "abcdef01-2345-6789-abcd-ef0123456789",
      name: "Bericht.docx",
    });
    const reserved = reservedObjectLinkHtml("Bericht.docx");
    expect(reserved.length).toBeGreaterThanOrEqual(realistic.length);
    expect(reserved).toContain("x".repeat(OBJECT_LINK_ID_RESERVE_CHARS));
  });

  it("STRUKTUR: genau EINE Deklaration (bodyFileLink) — keine lokale Kopie der Reserve mehr", () => {
    const root = resolve(process.cwd(), "apps/web/src");
    const declarations: string[] = [];
    const placeholderBuilders: string[] = [];
    for (const entry of readdirSync(root, { recursive: true }) as string[]) {
      if (!/\.(ts|tsx)$/.test(entry)) {
        continue;
      }
      const text = readFileSync(join(root, entry), "utf8");
      if (text.includes("OBJECT_LINK_ID_RESERVE_CHARS =")) {
        declarations.push(entry);
      }
      if (text.includes('"x".repeat(OBJECT_LINK_ID_RESERVE_CHARS)')) {
        placeholderBuilders.push(entry);
      }
    }
    expect(declarations).toEqual(["lib/bodyFileLink.ts"]);
    // Auch der x-Repeat-Platzhalter wird nur noch an der zentralen Stelle gebaut.
    expect(placeholderBuilders).toEqual(["lib/bodyFileLink.ts"]);
  });
});
