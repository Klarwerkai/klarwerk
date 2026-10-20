// PP-05-Erweiterung des W06-Schreibwegs. Bestehendes PPTX, Master und unabhängige Inhalte bleiben.
import JSZip from "jszip";
import { lesePraesentation } from "./office-nachbearbeitung";
import type { AufbauPlan } from "./praesentation-aufbau";
import { DatenFehler, leseFolienDaten } from "./praesentation-daten";

const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships";
const CT = "application/vnd.openxmlformats-officedocument";
const X = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const xml = (s: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${s}`;
const rel = (id: string, art: string, target: string) =>
  `<Relationship Id="${id}" Type="${R}/${art}" Target="${X(target)}"/>`;
const rels = (s: string) => xml(`<Relationships xmlns="${PKG}">${s}</Relationships>`);
const absatz = (s: string, size = 1800, betont = false) =>
  `<a:p><a:r><a:rPr lang="de-DE" sz="${size}"${betont ? ' b="1"' : ""}><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:rPr><a:t>${X(s)}</a:t></a:r><a:endParaRPr lang="de-DE" sz="${size}"/></a:p>`;
const baum =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>';
const nvp = (id: number, name: string) => `<p:cNvPr id="${id}" name="${X(name)}"/>`;

export interface AusgabeBindung {
  datenpunktId: string;
  datenFassung: number;
  sldId: string;
  shapeId: string;
  zeile?: number;
  spalte?: number;
}
export interface DeckVertrag {
  vertrag: "klara-pp05-v1";
  plan: AufbauPlan;
  bindungen: AusgabeBindung[];
  diagramme: {
    sldId: string;
    shapeId: string;
    teil: string;
    datenpunkte: string[];
    minimum: number;
    maximum: number;
  }[];
  belegfolien: { datenpunktId: string; datenFassung: number; sldIds: string[] }[];
  folien: {
    sldId: string;
    titel?: string;
    rolle: "haupt" | "detail" | "einzelfolie";
    datenpunkte: { id: string; fassung: number }[];
  }[];
}

/** Dateifassung entsteht aus den fertigen Bytes, steht deshalb außerhalb des eingebetteten Vertrags. */
export interface GebundenerDeckVertrag {
  dateiFassung: string;
  deck: DeckVertrag;
}

/** Native Texte, Tabellen und Säulendiagramm mit editierbarer eingebetteter Arbeitsmappe. */
export async function schreibeDatenfolien(
  bytes: Buffer,
  plan: AufbauPlan,
): Promise<{ bytes: Buffer; deck: DeckVertrag }> {
  // Derselbe W06-Leser, kein neuer Import-/Hostweg. Der Aufrufer liefert gespeicherte Anhangsbytes.
  const { zip, folien } = await lesePraesentation(bytes);
  let praes = await zip.file("ppt/presentation.xml")?.async("string");
  let pr = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
  let ct = await zip.file("[Content_Types].xml")?.async("string");
  const layout = Object.keys(zip.files).find((n) => /^ppt\/slideLayouts\/[^/]+\.xml$/.test(n));
  const size = /<p:sldSz\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/.exec(praes ?? "");
  if (!praes || !pr || !ct || !layout || !size || !praes.includes("</p:sldIdLst>"))
    throw new DatenFehler(
      "ungueltig",
      "Die Vorlage braucht Folienformat und Folienlayout. Keine Vorlage wurde erfunden.",
    );
  const w = Number(size[1]);
  const h = Number(size[2]);
  if (w < 1000000 || h < 1000000 || w / h < 1.2 || w / h > 2.2)
    throw new DatenFehler("ungueltig", "Dieses Vorlagenformat wird noch nicht unterstützt.");
  const box = (x: number, y: number, bw: number, bh: number, prefix = "a") =>
    `<${prefix}:xfrm><a:off x="${Math.round(x * w)}" y="${Math.round(y * h)}"/><a:ext cx="${Math.round(bw * w)}" cy="${Math.round(bh * h)}"/></${prefix}:xfrm>`;
  const text = (id: number, name: string, zeilen: string[], y: number, bh: number, size = 1800) =>
    `<p:sp><p:nvSpPr>${nvp(id, name)}<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${box(0.05, y, 0.9, bh)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${zeilen.map((s) => absatz(s, size, plan.auftrag.design === "betont" && id === 2)).join("")}</p:txBody></p:sp>`;
  const frame = (id: number, name: string, inner: string) =>
    `<p:graphicFrame><p:nvGraphicFramePr>${nvp(id, name)}<p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>${box(0.05, 0.22, 0.9, 0.62, "p")}<a:graphic>${inner}</a:graphic></p:graphicFrame>`;
  const deck: DeckVertrag = {
    vertrag: "klara-pp05-v1",
    plan,
    bindungen: [],
    diagramme: [],
    belegfolien: [],
    folien: [],
  };
  let sldId = Math.max(255, ...folien.map((f) => f.folieId));
  let count = 0;
  const contentType = (part: string, typ: string) => {
    ct = ct?.replace("</Types>", `<Override PartName="/${part}" ContentType="${typ}"/></Types>`);
  };
  const neu = async (titel: string, inhalt: string, extraRels = ""): Promise<string> => {
    if (++count > 160)
      throw new DatenFehler(
        "ungueltig",
        "Die Belege sind für diesen Aufbau zu umfangreich. Auswahl verkleinern.",
      );
    sldId++;
    let part = `ppt/slides/klaraPP05_${sldId}.xml`;
    while (zip.file(part)) part = part.replace(".xml", "_.xml");
    let rid = `klaraPP05_${sldId}`;
    while (pr?.includes(`Id="${rid}"`)) rid += "_";
    // Gültige Vorlagen können r nur an ihren einzelnen Verweisen deklarieren. Die neuen
    // Geschwister brauchen daher ihre eigene Bindung, statt einen Root-Namespace vorauszusetzen.
    praes = praes?.replace(
      "</p:sldIdLst>",
      `<p:sldId xmlns:r="${R}" id="${sldId}" r:id="${rid}"/></p:sldIdLst>`,
    );
    pr = pr?.replace("</Relationships>", `${rel(rid, "slide", part.slice(4))}</Relationships>`);
    zip.file(
      part,
      xml(
        `<p:sld xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${baum}${text(2, "Titel", [titel], 0.04, 0.14, 2800)}${inhalt}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
      ),
    );
    const file = part.slice(part.lastIndexOf("/") + 1);
    zip.file(
      `ppt/slides/_rels/${file}.rels`,
      rels(rel("rIdLayout", "slideLayout", `../${layout.slice(4)}`) + extraRels),
    );
    contentType(part, `${CT}.presentationml.slide+xml`);
    deck.folien.push({ sldId: String(sldId), titel, rolle: "haupt", datenpunkte: [] });
    return String(sldId);
  };
  await neu(
    plan.auftrag.titel,
    text(
      3,
      "Ziel und Publikum",
      [
        `Ziel: ${plan.auftrag.ziel}`,
        `Publikum: ${plan.auftrag.publikum}`,
        `Zeit: ${plan.auftrag.dauerMinuten} Minuten`,
        `Datenkontrolle PP-03: ${plan.kontrolliertAm}`,
        "Gliederung: Datenübersicht, belegte Aussagen, Quellen und Prüfstände",
        "Prüfbedarf bleibt an den betroffenen Werten sichtbar",
      ],
      0.24,
      0.65,
      2000,
    ),
  );
  const cell = (s: string) =>
    `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${absatz(s, 1400)}</a:txBody><a:tcPr/></a:tc>`;
  for (let i = 0; i < plan.fakten.length; i += 3) {
    const gruppe = plan.fakten.slice(i, i + 3);
    const rows = [
      ["Bezug / Einheit", "Wert", "Zeitraum", "Prüfstand"],
      ...gruppe.map((f) => [
        `${f.label} (${f.einheit})`,
        f.wert,
        f.zeitraum,
        `${f.prognose ? "Prognose · " : ""}${f.zustand}`,
      ]),
    ];
    const table = `<a:graphicData uri="${A}/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>${[0.28, 0.19, 0.2, 0.23].map((n) => `<a:gridCol w="${Math.round(w * n)}"/>`).join("")}</a:tblGrid>${rows.map((r) => `<a:tr h="${Math.round(h * 0.14)}">${r.map(cell).join("")}</a:tr>`).join("")}</a:tbl></a:graphicData>`;
    const id = await neu("Datenübersicht", frame(3, "Gebundene Daten", table));
    gruppe.forEach((f, j) =>
      deck.bindungen.push({
        datenpunktId: f.id,
        datenFassung: f.fassung,
        sldId: id,
        shapeId: "3",
        zeile: j + 2,
        spalte: 2,
      }),
    );
    const zuordnung = deck.folien.find((f) => f.sldId === id);
    if (zuordnung) zuordnung.datenpunkte = gruppe.map((f) => ({ id: f.id, fassung: f.fassung }));
  }
  for (const f of plan.fakten) {
    const id = await neu(
      f.label,
      text(3, "Gebundene Aussage", [f.wert], 0.24, 0.2, 3200) +
        text(
          4,
          "Bezugsrahmen und Prüfstand",
          [
            `${f.einheit} · ${f.zeitraum}`,
            f.zustand,
            ...(f.prognose ? ["Prognose: kein beobachteter Ist-Wert"] : []),
            "Quelle und Rechenweg: zugehörige Belegfolien",
          ],
          0.48,
          0.35,
          1800,
        ),
    );
    deck.bindungen.push({ datenpunktId: f.id, datenFassung: f.fassung, sldId: id, shapeId: "3" });
    const zuordnung = deck.folien.find((f) => f.sldId === id);
    if (zuordnung) {
      zuordnung.rolle = "einzelfolie";
      zuordnung.datenpunkte = [{ id: f.id, fassung: f.fassung }];
    }
  }
  if (plan.diagramm) {
    let name = `klaraPP05_${sldId + 1}`;
    while (zip.file(`ppt/charts/${name}.xml`)) name += "_";
    const part = `ppt/charts/${name}.xml`;
    const workbook = `ppt/embeddings/${name}.xlsx`;
    const wb = new JSZip();
    wb.file(
      "[Content_Types].xml",
      xml(
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${CT}.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${CT}.spreadsheetml.worksheet+xml"/></Types>`,
      ),
    );
    wb.file("_rels/.rels", rels(rel("rId1", "officeDocument", "xl/workbook.xml")));
    wb.file(
      "xl/workbook.xml",
      xml(
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}"><sheets><sheet name="Daten" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    );
    wb.file("xl/_rels/workbook.xml.rels", rels(rel("rId1", "worksheet", "worksheets/sheet1.xml")));
    wb.file(
      "xl/worksheets/sheet1.xml",
      xml(
        `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Bezug</t></is></c><c r="B1" t="inlineStr"><is><t>${X(plan.diagramm.einheit)}</t></is></c></row>${plan.fakten.map((f, i) => `<row r="${i + 2}"><c r="A${i + 2}" t="inlineStr"><is><t>${X(f.prognose ? `${f.label} (Prognose)` : f.label)}</t></is></c><c r="B${i + 2}"><v>${f.zahl}</v></c></row>`).join("")}</sheetData></worksheet>`,
      ),
    );
    zip.file(workbook, await wb.generateAsync({ type: "nodebuffer" }));
    contentType(workbook, `${CT}.spreadsheetml.sheet`);
    const pts = (values: (string | number)[]) =>
      `<c:ptCount val="${values.length}"/>${values.map((v, i) => `<c:pt idx="${i}"><c:v>${X(String(v))}</c:v></c:pt>`).join("")}`;
    const cats = `<c:cat><c:strRef><c:f>Daten!$A$2:$A$${plan.fakten.length + 1}</c:f><c:strCache>${pts(plan.fakten.map((f) => (f.prognose ? `${f.label} (Prognose)` : f.label)))}</c:strCache></c:strRef></c:cat>`;
    const vals = `<c:val><c:numRef><c:f>Daten!$B$2:$B$${plan.fakten.length + 1}</c:f><c:numCache><c:formatCode>General</c:formatCode>${pts(plan.fakten.map((f) => f.zahl as number))}</c:numCache></c:numRef></c:val>`;
    const axTitle = `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/>${absatz(plan.diagramm.einheit)}</c:rich></c:tx></c:title>`;
    zip.file(
      part,
      xml(
        `<c:chartSpace xmlns:c="${C}" xmlns:a="${A}" xmlns:r="${R}"><c:lang val="de-DE"/><c:chart><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser><c:idx val="0"/><c:order val="0"/>${cats}${vals}</c:ser><c:axId val="1"/><c:axId val="2"/></c:barChart><c:catAx><c:axId val="1"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:crossAx val="2"/></c:catAx><c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/><c:max val="${plan.diagramm.maximum}"/><c:min val="${plan.diagramm.minimum}"/></c:scaling><c:axPos val="l"/>${axTitle}<c:crossAx val="1"/><c:crosses val="autoZero"/></c:valAx></c:plotArea><c:plotVisOnly val="1"/></c:chart><c:externalData r:id="rIdData"><c:autoUpdate val="0"/></c:externalData></c:chartSpace>`,
      ),
    );
    zip.file(
      `ppt/charts/_rels/${name}.xml.rels`,
      rels(rel("rIdData", "package", `../embeddings/${name}.xlsx`)),
    );
    contentType(part, `${CT}.drawingml.chart+xml`);
    const id = await neu(
      `Vergleich · ${plan.fakten[0]?.zeitraum}`,
      frame(
        3,
        "Gebundenes Säulendiagramm",
        `<a:graphicData uri="${C}"><c:chart xmlns:c="${C}" r:id="rIdChart"/></a:graphicData>`,
      ) +
        text(
          4,
          "Prüfhinweis",
          ["Prüfstände und Definitionen: Datenübersicht und Belegfolien"],
          0.87,
          0.1,
          1400,
        ),
      rel("rIdChart", "chart", `../charts/${name}.xml`),
    );
    deck.diagramme.push({
      sldId: id,
      shapeId: "3",
      teil: part,
      datenpunkte: plan.fakten.map((f) => f.id),
      minimum: plan.diagramm.minimum,
      maximum: plan.diagramm.maximum,
    });
    const zuordnung = deck.folien.find((f) => f.sldId === id);
    if (zuordnung)
      zuordnung.datenpunkte = plan.fakten.map((f) => ({ id: f.id, fassung: f.fassung }));
  }
  for (const f of plan.fakten) {
    // Vollständige Belege lesbar umbrechen, nie abschneiden oder auf eine bloße interne URL reduzieren.
    const lines = f.belege.flatMap((s) => s.match(/.{1,76}(?:\s|$)|.{1,76}/gu) ?? [s]);
    const ids: string[] = [];
    for (let i = 0; i < lines.length; i += 9)
      ids.push(
        await neu(
          `Belege · ${f.label}`,
          text(3, "Herkunft und Prüfungen", lines.slice(i, i + 9), 0.22, 0.73, 1600),
        ),
      );
    deck.belegfolien.push({ datenpunktId: f.id, datenFassung: f.fassung, sldIds: ids });
    for (const id of ids) {
      const zuordnung = deck.folien.find((f) => f.sldId === id);
      if (zuordnung) {
        zuordnung.rolle = "detail";
        zuordnung.datenpunkte = [{ id: f.id, fassung: f.fassung }];
      }
    }
  }
  await neu(
    "Offene Punkte und Weitergabe",
    text(
      3,
      "Liefergrenzen",
      plan.hinweise.flatMap((s) => s.match(/.{1,76}(?:\s|$)|.{1,76}/gu) ?? [s]),
      0.22,
      0.73,
      1600,
    ),
  );
  zip.file("ppt/presentation.xml", praes);
  zip.file("ppt/_rels/presentation.xml.rels", pr);
  zip.file("[Content_Types].xml", ct);
  // Transportvertrag zur exakten Dateifassung, keine zweite Datenablage oder Validierung.
  const manifest = `ppt/klara/pp05-${sldId}.json`;
  zip.file(manifest, JSON.stringify(deck));
  if (!ct.includes('Extension="json"'))
    zip.file(
      "[Content_Types].xml",
      ct.replace("</Types>", '<Default Extension="json" ContentType="application/json"/></Types>'),
    );
  const result = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const erneut = await leseFolienDaten(result);
  for (const b of deck.bindungen) {
    const e = erneut.folien
      .find((f) => f.sldId === b.sldId)
      ?.elemente.find((e) => e.shapeId === b.shapeId);
    const f = plan.fakten.find((f) => f.id === b.datenpunktId);
    const value = b.zeile
      ? e?.zellen?.find((z) => z.zeile === b.zeile && z.spalte === b.spalte)?.text
      : e?.text;
    if (!f || value !== f.wert)
      throw new DatenFehler(
        "ungueltig",
        "Wiederöffnungsprüfung der gebundenen Werte fehlgeschlagen.",
      );
  }
  return { bytes: result, deck };
}
