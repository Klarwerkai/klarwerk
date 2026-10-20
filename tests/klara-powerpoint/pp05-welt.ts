import Fastify from "fastify";
import JSZip from "jszip";
import type { Guards, SessionUser } from "../../services/app/src/http";
import type { AufbauAuftrag } from "../../services/app/src/praesentation-aufbau";
import type { DatenpunktSicht } from "../../services/app/src/praesentation-daten";
import { SpeicherDatenpunktAblage } from "../../services/app/src/praesentation-daten-ablage";
import { officeRoutes } from "../../services/app/src/routes/office-routes";
import { praesentationDatenRoutes } from "../../services/app/src/routes/praesentation-daten-routes";
import {
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
} from "../../services/knowledge-object/src/repo";
import { KoService } from "../../services/knowledge-object/src/service";
import { InMemoryObjectRepo, ObjectStore } from "../../services/object-store";
import { can } from "../../services/rbac";
export const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
export async function vorlage(): Promise<Buffer> {
  const z = new JSZip();
  const rels = (s: string) =>
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${s}</Relationships>`;
  const rel = (id: string, typ: string, target: string) =>
    `<Relationship Id="${id}" Type="${R}/${typ}" Target="${target}"/>`;
  z.file(
    "[Content_Types].xml",
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/></Types>`,
  );
  z.file("_rels/.rels", rels(rel("rId1", "officeDocument", "ppt/presentation.xml")));
  z.file(
    "ppt/presentation.xml",
    `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
  );
  z.file(
    "ppt/_rels/presentation.xml.rels",
    rels(
      rel("rId1", "slide", "slides/slide1.xml") +
        rel("rIdMaster", "slideMaster", "slideMasters/slideMaster1.xml"),
    ),
  );
  const baum =
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>';
  z.file(
    "ppt/slides/slide1.xml",
    `<p:sld xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"><p:cSld><p:spTree>${baum}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Manueller Inhalt"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Unabhängiger Text bleibt erhalten</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
  );
  z.file(
    "ppt/slides/_rels/slide1.xml.rels",
    rels(rel("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml")),
  );
  z.file(
    "ppt/slideLayouts/slideLayout1.xml",
    `<p:sldLayout xmlns:p="${P}" xmlns:a="${A}" type="blank" preserve="1"><p:cSld><p:spTree>${baum}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
  );
  z.file(
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
    rels(rel("rId1", "slideMaster", "../slideMasters/slideMaster1.xml")),
  );
  z.file(
    "ppt/slideMasters/slideMaster1.xml",
    `<p:sldMaster xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"><p:cSld><p:spTree>${baum}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`,
  );
  z.file(
    "ppt/slideMasters/_rels/slideMaster1.xml.rels",
    rels(rel("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml")),
  );
  return z.generateAsync({ type: "nodebuffer" });
}
export async function welt() {
  const objekte = new ObjectStore({ repo: new InMemoryObjectRepo() });
  const repo = new InMemoryKoRepo();
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    evidence: new InMemoryEvidenceRepo(),
  });
  const datenpunkte = new SpeicherDatenpunktAblage();
  const nutzer: SessionUser = { id: "anna", role: "experte", spaceLesbar: new Set() };
  const guards: Guards = {
    async requireUser(req, _reply) {
      if (req.headers["x-test-viewer"]) {
        return { ...nutzer, id: "leser", role: "viewer" };
      }
      return nutzer;
    },
    async requirePermission(p, req, reply) {
      const u = await this.requireUser(req, reply);
      if (u && !can(u.role, p)) {
        reply.code(403).send({ error: "FORBIDDEN" });
        return;
      }
      return u;
    },
  };
  const app = Fastify();
  const deps = {
    ko,
    objekte,
    datenpunkte,
    einrichtung: { eingerichtet: false as const, fehlt: ["Testbestand"] },
    konten: async () => [
      { id: "anna", name: "Anna Beispiel", role: "experte" as const, approved: true },
    ],
    spaceLesbar: async () => new Set<string>(),
  };
  await app.register(officeRoutes(deps, guards));
  await app.register(
    praesentationDatenRoutes({ ko, objekte, ablage: datenpunkte, konten: deps.konten }, guards),
  );
  const original = await vorlage();
  const ref = await objekte.put({
    name: "Vorlage.pptx",
    mime: PPTX,
    data: `data:${PPTX};base64,${original.toString("base64")}`,
    purpose: "attachment",
    confidentiality: "intern",
  });
  const article = await ko.create({
    title: "Vertriebsdaten (fiktiv)",
    statement: "Kontrollierter Testbestand: 400 T€ im Norden und 600 T€ im Süden.",
    type: "best_practice",
    category: "Test",
    author: "anna",
    confidentiality: "intern",
  });
  const mit = await ko.addAttachment(article.id, "anna", {
    name: ref.name,
    mime: PPTX,
    objectId: ref.id,
    size: ref.size,
  });
  const anhangId = mit.attachments[0]?.id;
  const basis = `/api/kos/${mit.id}/office/${anhangId}`;
  async function capture(payload: Record<string, unknown>): Promise<DatenpunktSicht> {
    const r = await app.inject({ method: "POST", url: `/api/kos/${mit.id}/datenpunkte`, payload });
    if (r.statusCode !== 201) throw new Error(r.body);
    return r.json();
  }
  const a = await capture({
    art: "zahl",
    wert: "400 T€",
    einheit: "T€",
    waehrung: "EUR",
    zeitraum: "Q4 2025",
    bezugsgroesse: "Umsatz Nord",
    erfassung: "direkt",
    quelleKoId: mit.id,
    zitat: "400 T€ im Norden",
  });
  const b = await capture({
    art: "zahl",
    wert: "600 T€",
    einheit: "T€",
    waehrung: "EUR",
    zeitraum: "Q4 2025",
    bezugsgroesse: "Umsatz Süd",
    erfassung: "manuell",
    beleg: "Fiktiver kontrollierter Tabellenwert",
  });
  const sum = await capture({
    art: "zahl",
    wert: "1.000 T€",
    einheit: "T€",
    waehrung: "EUR",
    zeitraum: "Q4 2025",
    bezugsgroesse: "Gesamtumsatz",
    erfassung: "berechnet",
    rechenweg: { art: "summe", eingaben: [a.id, b.id], stellen: 0 },
  });
  const auftrag: AufbauAuftrag = {
    expectedVersion: mit.version,
    titel: "Vertrieb Q4 2025",
    ziel: "Vertriebsdaten prüfen",
    publikum: "Geschäftsführung",
    dauerMinuten: 12,
    design: "vorlage",
    diagramm: true,
    datenpunkte: [a, b, sum].map((d) => ({ id: d.id, fassung: d.fassung })),
  };
  return {
    app,
    ko,
    repo,
    objekte,
    datenpunkte,
    original,
    article: mit,
    anhangId,
    basis,
    capture,
    a,
    b,
    sum,
    auftrag,
  };
}
