// WP-RETEST7 R1a/c (Pedis DOCX-Befund): ehrliche Lese-Fehlerursachen. Ein nach dem Deploy
// gescheiterter dynamic import (mammoth/pdfjs/fflate/tesseract im alten Tab) ist KEIN kaputtes
// Dokument — die zentrale Erkennung (isStaleChunkError) unterscheidet die bekannten Browser-/
// Vite-Formulierungen robust; echte Parse-Fehler tragen die kurze Ursache (max. 120 Zeichen).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  STALE_BUNDLE_KEY,
  honestParseErrorText,
  isStaleChunkError,
  shortErrorDetail,
} from "../../apps/web/src/lib/staleChunk";

describe("WP-RETEST7 R1: Stale-Bundle-Erkennung", () => {
  it("erkennt die bekannten dynamic-import-/Preload-Fehler aller Browser", () => {
    expect(
      isStaleChunkError(new TypeError("Failed to fetch dynamically imported module: /x.js")),
    ).toBe(true);
    expect(isStaleChunkError(new TypeError("error loading dynamically imported module"))).toBe(
      true,
    );
    expect(isStaleChunkError(new TypeError("Importing a module script failed."))).toBe(true);
    const chunk = new Error("Loading chunk 42 failed.");
    chunk.name = "ChunkLoadError";
    expect(isStaleChunkError(chunk)).toBe(true);
    expect(isStaleChunkError(new Error("Unable to preload CSS for /assets/x.css"))).toBe(true);
  });

  it("ein ECHTER Parse-Fehler (auch TypeError) bleibt ein Parse-Fehler", () => {
    expect(isStaleChunkError(new Error("Kaputtes ZIP: zentrale Verzeichnisstruktur fehlt"))).toBe(
      false,
    );
    expect(isStaleChunkError(new TypeError("Cannot read properties of undefined"))).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
  });

  it("Meldungswahl: Stale → Neu-laden-Text; sonst Basis-Meldung + kurze Ursache (120 Zeichen)", () => {
    const stale = new TypeError("Failed to fetch dynamically imported module: /assets/mammoth.js");
    expect(honestParseErrorText(stale, "NEU LADEN", "PARSE")).toBe("NEU LADEN");
    const parse = new Error("Zentrale Verzeichnisstruktur des Archivs fehlt");
    expect(honestParseErrorText(parse, "NEU LADEN", "PARSE")).toBe(
      "PARSE (Zentrale Verzeichnisstruktur des Archivs fehlt)",
    );
    // Ursache wird hart auf 120 Zeichen gekappt (Whitespace normalisiert).
    const long = new Error(`a  ${"b".repeat(300)}`);
    expect(shortErrorDetail(long).length).toBe(120);
    // Ohne Ursache bleibt die Basis-Meldung unverändert.
    expect(honestParseErrorText(new Error(""), "NEU LADEN", "PARSE")).toBe("PARSE");
  });

  it("die Neu-laden-Meldung existiert in DE, EN und NL", () => {
    const i18n = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");
    expect(i18n.split(`"${STALE_BUNDLE_KEY}":`).length - 1).toBe(3);
  });

  it("ALLE Lazy-Import-Fehlerstellen nutzen die zentrale Meldungswahl (Capture + BodyExtractPanel)", () => {
    const capture = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"), "utf8");
    const panel = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/BodyExtractPanel.tsx"),
      "utf8",
    );
    // Drei Lese-Catches in Capture (Erzähl-Modus DOCX/Text, Erzähl-Modus PDF, Datei-Import) + Panel.
    expect(capture.split("honestParseErrorText(").length - 1).toBeGreaterThanOrEqual(3);
    expect(panel).toContain("honestParseErrorText(");
  });
});
