import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FILE_CAPTURE_ACCEPT,
  FILE_IMPORT_ACCEPT,
  FILE_TEXT_INSERT_ACCEPT,
  TEXT_INSERT_KINDS,
  isTextInsertSupported,
} from "../../apps/web/src/lib/captureFromFile";
import { detectFileKind } from "../../apps/web/src/lib/extract";

// ================================================================================================
// JOB 2699 D1 — ZWEI LISTEN, EINE TABELLE (Befund R2-27)
// ================================================================================================
//
// Der eigentliche Fehler war nicht „.pptx", sondern: die Liste des Dialogs und die Liste der Pruefung
// liefen auseinander. Diese Faelle messen beide Richtungen ueber die Accept-Marken selbst — jede
// Marke wird zu einer Probedatei (Endung → Name, MIME → Typ, Muster → Beispieltyp) und durch die
// echte Pruefung geschickt.

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** Eine Probedatei je Accept-Marke — so, wie der Dialog sie dem Weg reichen wuerde. */
function probe(marke: string): { name: string; type: string } {
  if (marke.startsWith(".")) {
    return { name: `probe${marke}`, type: "" };
  }
  if (marke.endsWith("/*")) {
    const beispiel: Record<string, string> = { image: "png", video: "mp4", audio: "mpeg" };
    const gruppe = marke.slice(0, -2);
    return { name: "probe", type: `${gruppe}/${beispiel[gruppe] ?? "x"}` };
  }
  return { name: "probe", type: marke };
}

function marken(liste: string): string[] {
  return liste
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
}

describe("JOB 2699 D1 · A · die Liste des Text-Einfuege-Weges und seine Pruefung sind EINE Tabelle", () => {
  it("A1 · JEDE Marke, die der Dialog anbietet, traegt die Pruefung — 0 Ausreisser", () => {
    const ausreisser = marken(FILE_TEXT_INSERT_ACCEPT).filter(
      (m) => !isTextInsertSupported(probe(m)),
    );
    expect(ausreisser).toEqual([]);
  });

  it("A2 · .pptx und der PPTX-MIME stehen NICHT mehr in der Liste dieses Weges", () => {
    expect(FILE_TEXT_INSERT_ACCEPT).not.toContain(".pptx");
    expect(FILE_TEXT_INSERT_ACCEPT).not.toContain(PPTX_MIME);
    // … und die Pruefung lehnt sie ab, mit welchem MIME auch immer.
    expect(isTextInsertSupported({ name: "folien.pptx", type: PPTX_MIME })).toBe(false);
    expect(isTextInsertSupported({ name: "folien.pptx", type: "text/plain" })).toBe(false);
  });

  it("A3 · die Messung aus dem Auftrag: welche Arten der alten Liste kannte die Pruefung nicht? Genau eine — PPTX (zwei Marken)", () => {
    const unbekannt = marken(FILE_CAPTURE_ACCEPT).filter((m) => !isTextInsertSupported(probe(m)));
    expect(unbekannt).toEqual([".pptx", PPTX_MIME]);
    expect(new Set(unbekannt.map((m) => detectFileKind(probe(m)))).size).toBe(1);
  });

  it("A4 · die Arten, die durchgehen: Text, Word, PDF, Bild — und Video/Audio als Anhang", () => {
    expect(TEXT_INSERT_KINDS).toEqual(["text", "docx", "pdf", "image"]);
    for (const p of [
      { name: "notiz.txt", type: "text/plain" },
      { name: "notiz.md", type: "" },
      { name: "daten.csv", type: "text/csv" },
      { name: "bericht.docx", type: "" },
      { name: "plan.pdf", type: "application/pdf" },
      { name: "foto.jpg", type: "image/jpeg" },
      { name: "clip.mp4", type: "video/mp4" },
      { name: "ton.mp3", type: "audio/mpeg" },
    ]) {
      expect(isTextInsertSupported(p), p.name).toBe(true);
    }
    expect(isTextInsertSupported({ name: "tabelle.xlsx", type: "" })).toBe(false);
  });

  it("A5 · die anderen Listen bleiben, was sie waren: der Hauptweg und der Anhang-Weg bieten PPTX weiter an", () => {
    expect(FILE_IMPORT_ACCEPT).toContain(".pptx");
    expect(FILE_CAPTURE_ACCEPT).toContain(".pptx");
    expect(FILE_CAPTURE_ACCEPT.startsWith(FILE_IMPORT_ACCEPT)).toBe(true);
  });
});

describe("JOB 2699 D1 · B · die Eingaenge tragen die richtige Liste (Quelle gelesen)", () => {
  const capture = readFileSync(
    join(__dirname, "..", "..", "apps", "web", "src", "pages", "Capture.tsx"),
    "utf8",
  );

  it("B1 · beide „Text aus Datei einfuegen“-Eingaenge (onDocs) tragen FILE_TEXT_INSERT_ACCEPT", () => {
    const onDocsEingaenge = capture.match(
      /accept=\{(FILE_[A-Z_]+)\}\s*\n\s*className="hidden"\s*\n\s*onChange=\{\(e\) => void onDocs\(e\)\}/g,
    );
    expect(onDocsEingaenge).toHaveLength(2);
    for (const e of onDocsEingaenge ?? []) {
      expect(e).toContain("accept={FILE_TEXT_INSERT_ACCEPT}");
    }
  });

  it("B2 · „Datei oder Bild beifuegen“ (onAttach) behaelt FILE_CAPTURE_ACCEPT — dort ist .pptx als Anhang richtig", () => {
    expect(capture).toMatch(
      /accept=\{FILE_CAPTURE_ACCEPT\}\s*\n\s*className="hidden"\s*\n\s*onChange=\{\(e\) => void onAttach\(e\)\}/,
    );
  });

  it("B3 · onDocs verzweigt ueber detectFileKind, nicht mehr ueber Endungspraedikate", () => {
    const onDocs = capture.slice(
      capture.indexOf("const onDocs = async"),
      capture.indexOf("const onDocs = async") + 4000,
    );
    expect(onDocs).toContain("const kind = detectFileKind({ name: f.name, type: f.type })");
    expect(onDocs).toContain('kind === "docx" ? await readDocxFile(f) : await readTextFile(f)');
    expect(onDocs).not.toContain("isTextDocument(f) || isWordDocument(f)");
  });
});
