// @vitest-environment jsdom
// ================================================================================================
// aufnahme:20260922:excel-erster-weg · KO-04-01 · EIN MANIFEST JE HOST
// ================================================================================================
//
// Excel und PowerPoint bekommen je ein eigenes, wohlgeformtes Manifest mit dem passenden Host, der
// kleinsten Mindeststufe und derselben Fassung wie die ausgelieferte Seite. Das Word-Manifest bleibt
// unverändert Word-only: es wird nicht zum „universellen" Manifest umgedeutet.
// Ob ein Manifest in Excel bzw. PowerPoint auf dem Mac und im Web tatsächlich geladen wird, belegt
// dieser Test NICHT — das ist Teil der offenen Hostabnahme (KO-04-07).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KLARA_OFFICE_TASKPANE_FASSUNG,
  KLARA_OFFICE_TASKPANE_PFAD,
  KLARA_TASKPANE_FASSUNG,
  KLARA_TASKPANE_PFAD,
} from "../../services/app/src/web-static";
import { REPO_WURZEL } from "../support/repoPfad";
import { lies } from "./buehne";

// Der Root-Typcheck läuft ohne DOM-lib — der jsdom-DOMParser über einen schmalen Struktur-Typ
// (dasselbe Muster wie tests/app/word-addin.test.ts).
interface XmlElement {
  textContent: string | null;
  getAttribute(name: string): string | null;
}
interface XmlDoc {
  getElementsByTagName(tag: string): ArrayLike<XmlElement> & Iterable<XmlElement>;
}
const { DOMParser: XmlParser } = globalThis as unknown as {
  DOMParser: new () => { parseFromString(source: string, mime: string): XmlDoc };
};

const EXCEL = "docs/office-addin/klara-excel-manifest.xml";
const POWERPOINT = "docs/office-addin/klara-powerpoint-manifest.xml";
const WORD = "docs/word-addin/klara-manifest.xml";
const APP = "https://app.klarwerk.ai";

function manifest(pfad: string): XmlDoc {
  const quelle = readFileSync(join(REPO_WURZEL, pfad), "utf8");
  const doc = new XmlParser().parseFromString(quelle, "application/xml");
  expect(doc.getElementsByTagName("parsererror").length, pfad).toBe(0);
  return doc;
}

function texte(doc: XmlDoc, tag: string): string[] {
  return [...doc.getElementsByTagName(tag)].map((e) => (e.textContent ?? "").trim());
}

function werte(doc: XmlDoc, tag: string, attribut: string): string[] {
  return [...doc.getElementsByTagName(tag)].map((e) => e.getAttribute(attribut) ?? "");
}

function ersteStufe(host: string): string | undefined {
  const fenster: Record<string, unknown> = {};
  new Function("window", lies("hostkern.js"))(fenster);
  const kern = fenster.KlaraOfficeHost as { API: Record<string, { stufen: string[] }> };
  return kern.API[host]?.stufen[0];
}

const FAELLE: [string, string, string, string][] = [
  [EXCEL, "Workbook", "ExcelApi", "excel"],
  [POWERPOINT, "Presentation", "PowerPointApi", "powerpoint"],
];

describe("KO-04-01 · eigene Manifeste für Excel und PowerPoint", () => {
  it.each(FAELLE)("%s: Host %s, Satz %s ab der kleinsten Stufe", (pfad, host, satz, kernHost) => {
    const doc = manifest(pfad);
    expect(werte(doc, "Host", "Name")).toEqual([host]);
    expect(werte(doc, "Set", "Name")).toEqual([satz]);
    expect(werte(doc, "Set", "MinVersion")).toEqual([ersteStufe(kernHost)]);
    expect(texte(doc, "Permissions")).toEqual(["ReadWriteDocument"]);
    expect(texte(doc, "AppDomain")).toContain(APP);
    expect(werte(doc, "DisplayName", "DefaultValue")).toEqual(["Klara"]);
  });

  it("beide zeigen auf das Office-Fenster mit derselben Fassung wie die Auslieferung", () => {
    for (const pfad of [EXCEL, POWERPOINT]) {
      const doc = manifest(pfad);
      expect(texte(doc, "Version"), pfad).toEqual([KLARA_OFFICE_TASKPANE_FASSUNG]);
      expect(werte(doc, "SourceLocation", "DefaultValue"), pfad).toEqual([
        `${APP}${KLARA_OFFICE_TASKPANE_PFAD}?v=${KLARA_OFFICE_TASKPANE_FASSUNG}`,
      ]);
    }
  });

  it("das Word-Manifest bleibt Word-only mit eigener Seite und Fassung; alle Ids verschieden", () => {
    const word = manifest(WORD);
    expect(werte(word, "Host", "Name")).toEqual(["Document"]);
    expect(texte(word, "Version")).toEqual([KLARA_TASKPANE_FASSUNG]);
    expect(werte(word, "SourceLocation", "DefaultValue")).toEqual([
      `${APP}${KLARA_TASKPANE_PFAD}?v=${KLARA_TASKPANE_FASSUNG}`,
    ]);
    const ids = [WORD, EXCEL, POWERPOINT].map((pfad) => texte(manifest(pfad), "Id")[0] ?? "");
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    }
  });
});
