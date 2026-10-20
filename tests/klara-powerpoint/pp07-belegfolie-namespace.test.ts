// @vitest-environment jsdom
// Nur die zusätzliche P-Belegfolie an tatsächlich gespeicherter lokaler R1-Namespacevorlage.
// Namespacebewusster DOMParser ist ein XML-Beleg, kein Native-PowerPoint-Nachweis.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import { expect, it } from "vitest";
import { leseDeckVertraege } from "../../services/app/src/office-daten-aenderungen";
import { leseFolienDaten } from "../../services/app/src/praesentation-daten";
import { decodeDataUrl } from "../../services/object-store";
import { PPTX, welt } from "./pp05-welt";

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
const parse = (xml: string) => new XmlParser().parseFromString(xml, "application/xml");
const fehler = (doc: XmlDocument) =>
  [...doc.getElementsByTagName("parsererror")].map((e) => e.textContent);
function pflicht<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error("Fiktiver PP07-Belegteil fehlt.");
  return v;
}

it("PP07 · zusätzliche gespeicherte Belegfolie bindet r bei ausschließlich lokal deklariertem R1-Namespace", async () => {
  const input = await readFile(join(process.cwd(), "tests/fixtures/pp05-r1-native-eingabe.pptx"));
  expect(createHash("sha256").update(input).digest("hex")).toBe(
    "fe18644a17d0fd415795aa32dad4e060b7292b1576f4de4b06938556dabe9a11",
  );
  const original = await JSZip.loadAsync(input);
  const source = parse(await pflicht(original.file("ppt/presentation.xml")).async("string"));
  expect(fehler(source)).toEqual([]);
  expect(source.documentElement.lookupNamespaceURI("r")).toBeNull();
  const w = await welt();
  try {
    const ref = await w.objekte.put({
      name: "R1-lokaler-Namespace.pptx",
      mime: PPTX,
      data: `data:${PPTX};base64,${input.toString("base64")}`,
      purpose: "attachment",
      owner: w.nutzer.id,
      confidentiality: "intern",
    });
    const { ko: eingabe } = await w.ko.uebernimmOfficeFassung(
      w.article.id,
      {
        anhangId: w.anhangId,
        objectId: ref.id,
        size: ref.size,
        expectedVersion: w.article.version,
      },
      w.nutzer.id,
    );
    const auftrag = {
      ...w.auftrag,
      expectedVersion: eingabe.version,
      diagramm: false,
      datenpunkte: [{ id: w.b.id, fassung: w.b.fassung }],
    };
    const p = await w.app.inject({
      method: "POST",
      url: `${w.basis}/folienaufbau/vorschau`,
      payload: auftrag,
    });
    expect(p.statusCode, p.body).toBe(200);
    const a = await w.app.inject({
      method: "POST",
      url: `${w.basis}/folienaufbau/uebernehmen`,
      payload: { ...auftrag, planId: p.json().planId },
    });
    expect(a.statusCode, a.body).toBe(200);
    const datei = async () => {
      const ko = pflicht(await w.ko.get(w.article.id));
      const obj = pflicht(
        await w.objekte.read(pflicht(ko.attachments.find((a) => a.id === w.anhangId)?.objectId)),
      );
      const bytes = pflicht(decodeDataUrl(obj.data)).bytes;
      return { ko, bytes, satz: await leseFolienDaten(bytes) };
    };
    const vorher = await datei();
    const altZip = await JSZip.loadAsync(vorher.bytes);
    const altXml = await pflicht(altZip.file("ppt/presentation.xml")).async("string");
    const altDoc = parse(altXml);
    expect(fehler(altDoc)).toEqual([]);
    expect(altDoc.documentElement.lookupNamespaceURI("r")).toBeNull();
    const alteIds = new Set(
      [...altDoc.getElementsByTagNameNS(P, "sldId")].map((e) => e.getAttribute("id")),
    );
    const altDeck = pflicht((await leseDeckVertraege(altZip))[0]).deck;
    const alteBelege = pflicht(altDeck.belegfolien.find((b) => b.datenpunktId === w.b.id)).sldIds
      .length;
    const body = {
      expectedVersion: vorher.ko.version,
      dateiFassung: vorher.satz.fassung,
      aenderungen: [
        {
          datenpunktId: w.b.id,
          fassung: w.b.fassung,
          korrektur: {
            wert: "700 T€",
            grund: "Zusätzlicher fiktiver Herkunftsbeleg für die bewusste Änderung. ".repeat(8),
          },
        },
      ],
    };
    const v = await w.app.inject({
      method: "POST",
      url: `${w.basis}/datenaktualisierung/vorschau`,
      payload: body,
    });
    expect(v.statusCode, v.body).toBe(200);
    expect(v.json().konflikte).toEqual([]);
    expect(v.json().dateikonflikte).toEqual([]);
    expect(
      v
        .json()
        .dateiwirkungen.some(
          (w: { vorher: string }) => w.vorher === "Keine zusätzliche Belegseite",
        ),
    ).toBe(true);
    const u = await w.app.inject({
      method: "POST",
      url: `${w.basis}/datenaktualisierung/uebernehmen`,
      payload: { ...body, vorschauId: v.json().vorschauId, bestaetigteKonflikte: [] },
    });
    expect(u.statusCode, u.body).toBe(200);
    expect(u.json().zustand).toBe("uebernommen");
    const gespeichert = await datei();
    const zip = await JSZip.loadAsync(gespeichert.bytes);
    const neuXml = await pflicht(zip.file("ppt/presentation.xml")).async("string");
    const neuDoc = parse(neuXml);
    const neueTeile = Object.keys(zip.files).filter((p) =>
      /^ppt\/slides\/klaraPP07_\d+\.xml$/.test(p),
    );
    expect(neueTeile.length).toBeGreaterThan(0);
    const neuDeck = pflicht((await leseDeckVertraege(zip))[0]).deck;
    expect(
      pflicht(neuDeck.belegfolien.find((b) => b.datenpunktId === w.b.id)).sldIds.length,
    ).toBeGreaterThan(alteBelege);
    if (process.env.PP07_BELEG_NAMESPACE_ARTEFAKTE) {
      const out = process.env.PP07_BELEG_NAMESPACE_ARTEFAKTE;
      await mkdir(out, { recursive: true });
      await writeFile(join(out, "R1-PP07-AUSGABE.pptx"), gespeichert.bytes);
      await writeFile(join(out, "presentation.xml"), neuXml);
      await writeFile(
        join(out, "NAMESPACE-BEFUND.json"),
        JSON.stringify(
          {
            vorlage: "pp05-r1-native-eingabe.pptx",
            namespaceAmRootVorher: null,
            alteBelegfolien: alteBelege,
            neueBelegfolien: pflicht(neuDeck.belegfolien.find((b) => b.datenpunktId === w.b.id))
              .sldIds.length,
            neuePBelegteile: neueTeile,
            parserfehler: fehler(neuDoc),
            nativePowerPointProbe: false,
          },
          null,
          2,
        ),
      );
    }
    expect(
      fehler(neuDoc),
      "Gespeicherte P-Folienliste mit tatsächlich zusätzlicher Belegfolie",
    ).toEqual([]);
    expect(neuDoc.documentElement.lookupNamespaceURI("r")).toBeNull();
    const neueIds = [...neuDoc.getElementsByTagNameNS(P, "sldId")].filter(
      (e) => !alteIds.has(e.getAttribute("id")),
    );
    expect(neueIds).toHaveLength(neueTeile.length);
    const relDoc = parse(
      await pflicht(zip.file("ppt/_rels/presentation.xml.rels")).async("string"),
    );
    expect(fehler(relDoc)).toEqual([]);
    const rels = new Map(
      [...relDoc.getElementsByTagName("Relationship")].map((e) => [
        e.getAttribute("Id"),
        e.getAttribute("Target"),
      ]),
    );
    for (const id of neueIds) {
      expect(id.lookupNamespaceURI("r")).toBe(R);
      const rid = id.getAttributeNS(R, "id");
      expect(rid).toBeTruthy();
      const target = pflicht(rels.get(rid));
      expect(neueTeile).toContain(`ppt/${target}`);
      expect(neuDeck.folien.find((f) => f.sldId === id.getAttribute("id"))?.rolle).toBe("detail");
    }
    expect(gespeichert.ko.version).toBe(vorher.ko.version + 1);
    expect((await w.datenpunkte.lesen(w.b.id))?.wert).toBe("700 T€");
  } finally {
    await w.app.close();
  }
});
