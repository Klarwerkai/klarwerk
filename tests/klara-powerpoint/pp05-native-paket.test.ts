// @vitest-environment jsdom
// R1 ist die tatsächlich in PowerPoint16.111 warnungsfrei geöffnete fiktive Eingabe.
// Die eingefrorene alte presentation.xml stammt aus dem dort abgewiesenen 8fcb-PP05-Deck.
// Der strikte DOMParser prüft Namespace-Sichtbarkeit unabhängig vom regexbasierten Produktleser.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { schreibeDatenfolien } from "../../services/app/src/office-datenfolien";
import type { AufbauPlan } from "../../services/app/src/praesentation-aufbau";

const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
interface XmlElement {
  textContent: string | null;
  getAttribute(name: string): string | null;
  getAttributeNS(namespace: string, name: string): string | null;
  lookupNamespaceURI(prefix: string): string | null;
}
interface XmlDocument {
  documentElement: XmlElement;
  getElementsByTagName(name: string): ArrayLike<XmlElement> & Iterable<XmlElement>;
  getElementsByTagNameNS(
    namespace: string,
    name: string,
  ): ArrayLike<XmlElement> & Iterable<XmlElement>;
}
const { DOMParser: XmlParser } = globalThis as unknown as {
  DOMParser: new () => { parseFromString(source: string, mime: string): XmlDocument };
};
const parse = (s: string) => new XmlParser().parseFromString(s, "application/xml");
function wohlgeformt(s: string, name: string) {
  const doc = parse(s);
  expect(
    [...doc.getElementsByTagName("parsererror")].map((e) => e.textContent),
    name,
  ).toEqual([]);
  return doc;
}
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const fixture = (name: string) => join(process.cwd(), "tests/fixtures", name);
const nativeInput = fixture("pp05-r1-native-eingabe.pptx");
function plan(input: Buffer): AufbauPlan {
  const fakten = [
    { id: "nord", label: "Umsatz Nord", wert: "400 T€", zahl: 400 },
    { id: "sued", label: "Umsatz Süd", wert: "600 T€", zahl: 600 },
    { id: "summe", label: "Gesamtumsatz", wert: "1.000 T€", zahl: 1000 },
  ].map((f) => ({
    ...f,
    fassung: 1,
    einheit: "T€",
    waehrung: "EUR",
    prognose: false,
    zeitraum: "Q4 2025",
    zustand: "Erfasst, noch nicht geprüft",
    belege: ["Fiktiver kontrollierter Beleg"],
  }));
  return {
    vertrag: "klara-pp05-v1",
    planId: "xml-namensraum-regression",
    kontrolliertAm: "2026-10-20T17:40:00.000Z",
    basis: {
      koId: "fiktiv-r1",
      anhangId: "native-eingabe",
      artikelFassung: 1,
      dateiFassung: sha(input),
    },
    auftrag: {
      expectedVersion: 1,
      titel: "Vertrieb Q4 2025",
      ziel: "Vertriebsdaten prüfen",
      publikum: "Geschäftsführung",
      dauerMinuten: 12,
      design: "vorlage",
      diagramm: true,
      datenpunkte: fakten.map(({ id, fassung }) => ({ id, fassung })),
    },
    fakten,
    diagramm: { minimum: 0, maximum: 1000, einheit: "T€" },
    hinweise: ["Fiktiver XML-Paketnachweis"],
  };
}

describe("PP05 XML-Namensräume", () => {
  it("weist die eingefrorene tatsächlich nativ abgewiesene alte presentation.xml zurück", async () => {
    const bad = await readFile(fixture("pp05-8fcb-ungueltige-presentation.xml"), "utf8");
    const errors = [...parse(bad).getElementsByTagName("parsererror")];
    expect(errors).toHaveLength(1);
    expect(errors[0]?.textContent).toMatch(/unbound.*prefix.*r/i);
  });

  it.each([false, true])(
    "erhält ein gültiges Paket bei r-Deklaration am Root=%s",
    async (rootNamespace) => {
      let input: Buffer = await readFile(nativeInput);
      expect(sha(input)).toBe("fe18644a17d0fd415795aa32dad4e060b7292b1576f4de4b06938556dabe9a11");
      let original = await JSZip.loadAsync(input);
      const source = await original.file("ppt/presentation.xml")!.async("string");
      const sourceDoc = wohlgeformt(source, "tatsächlich nativ geöffnete Eingabe");
      expect(sourceDoc.documentElement.lookupNamespaceURI("r")).toBeNull();
      if (rootNamespace) {
        // Gegenfall für bisherige Vorlagen mit globalem r. Keine native Öffnungsbehauptung für Variante.
        original.file(
          "ppt/presentation.xml",
          source.replace("<p:presentation ", `<p:presentation xmlns:r="${R}" `),
        );
        input = await original.generateAsync({ type: "nodebuffer" });
        original = await JSZip.loadAsync(input);
      }
      const output = await schreibeDatenfolien(input, plan(input));
      const zip = await JSZip.loadAsync(output.bytes);
      for (const name of Object.keys(zip.files).filter((n) => /\.(?:xml|rels)$/.test(n)))
        wohlgeformt(await zip.file(name)!.async("string"), name);
      const presentation = wohlgeformt(
        await zip.file("ppt/presentation.xml")!.async("string"),
        "Folienliste",
      );
      const ids = [...presentation.getElementsByTagNameNS(P, "sldId")];
      expect(ids).toHaveLength(1 + output.deck.folien.length);
      const relationships = wohlgeformt(
        await zip.file("ppt/_rels/presentation.xml.rels")!.async("string"),
        "Folienbeziehungen",
      );
      const relIds = new Set(
        [...relationships.getElementsByTagName("Relationship")].map((e) => e.getAttribute("Id")),
      );
      for (const id of ids) {
        expect(id.lookupNamespaceURI("r")).toBe(R);
        expect(relIds.has(id.getAttributeNS(R, "id"))).toBe(true);
      }
      for (const binding of output.deck.bindungen)
        expect(ids.some((id) => id.getAttribute("id") === binding.sldId)).toBe(true);
      expect(output.deck.vertrag).toBe("klara-pp05-v1");
      for (const name of Object.keys(original.files).filter(
        (n) =>
          !original.files[n]!.dir &&
          ![
            "ppt/presentation.xml",
            "ppt/_rels/presentation.xml.rels",
            "[Content_Types].xml",
          ].includes(n),
      ))
        expect(await zip.file(name)!.async("nodebuffer"), name).toEqual(
          await original.file(name)!.async("nodebuffer"),
        );
      if (!rootNamespace && process.env.PP05_NAMESPACE_BELEGE) {
        const { writeFile } = await import("node:fs/promises");
        await writeFile(
          join(process.env.PP05_NAMESPACE_BELEGE, "PP05-R1-GEAENDERTER-SCHREIBER.pptx"),
          output.bytes,
        );
      }
    },
  );
});
