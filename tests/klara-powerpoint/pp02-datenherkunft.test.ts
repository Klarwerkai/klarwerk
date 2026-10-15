// ================================================================================================
// produkt:20261015:klara-powerpoint-datenherkunft (PP-02) · DATENHERKUNFT UND BINDUNG AN FOLIEN.
// ================================================================================================
//
// Geprüft wird `praesentationDatenRoutes` in einer Fastify-Instanz mit dem ECHTEN Wissensobjekt-
// dienst (Speicher-Repos mit Fassungen und Belegkette), dem echten Objektspeicher und einer echten,
// hier gebauten `.pptx` (Folie mit Titel, Text, nativer Tabelle und eingebettetem Bild). Ersetzt ist
// nur die Anmeldung (Kopfzeile `x-test-nutzer`). Die Texterkennung selbst läuft hier nicht: ihr
// Ergebnis wird so übergeben, wie die Fläche es aus dem vorhandenen Weg (W01) erhält; gebunden wird
// es über die Inhaltskennung der Bildbytes, die der Server selbst nachrechnet.
//
// Kontrollierter, fiktiver Bestand: Umsatz Q4 1.500 T€, Kosten Q4 1.200 T€ (Tabellenzellen),
// Ergebnis 300 T€ (berechnet), Marge 20,0 % (berechnet aus Berechnetem), Marktanteil 12 %
// (manuell), Mitarbeitende 85 (OCR aus einem Folienbild), Umsatz 2026 1.650 T€ (Prognose).
//
//   D1  (K1, K3) Daten-/Aussagenobjekt mit Wert, Einheit, Zeitraum, Quelle samt Artikel- und
//       Dateifassung, Fundstelle (Folie über p:sldId, Element, Zelle mit Kopf), Erfassungsart und
//       Bindung an Folie/Element; die Herkunft ist direkt an der Zahl abrufbar.
//   D2  (K2) Manuelle Zahl, OCR-Zahl und berechneter Wert sind unterscheidbar — an der Zahl, an
//       Quelle, Fundstelle und Prüfstand.
//   D3  (K2, K3) Rechenweg: Formel, Rundung, Ergebnis; alle tatsächlich verwendeten Eingaben sind
//       über die Kette erreichbar, bis zur richtigen Quelle; eine falsche Rechnung wird abgewiesen.
//   D4  (K3) Prognose nur mit Annahmen, nie als beobachteter Wert; OCR nur mit passendem Bild und
//       Text; ein direkt übernommener Wert muss an der Fundstelle stehen.
//   D5  (K3, K4) Prüfdimensionen getrennt; Erkennung oder grüner Teiltest validiert nicht;
//       „validiert“ erst mit allen erforderlichen Dimensionen samt fachlicher Freigabe.
//   D6  (K4) Wert-/Bezugsrahmenänderung hebt den alten Status auf; Prüfung gegen veraltete
//       Datenfassung wird abgewiesen; geänderte Eingabe → Überprüfung nötig, neu berechnen.
//   D7  (K4) Neue Quellfassung: Aktualität überholt, Bindung zeigt Abweichung bzw. Bestätigung;
//       neu lesen an der aktuellen Fassung.
//   D8  (K4) Rechte: Lesen ko.read + Sichtbarkeit, Schreiben ko.create, fachliche Freigabe
//       ko.validate; eine nicht sichtbare Quelle/Eingabe bleibt verborgen, die Schutzstufe der
//       strengsten Quelle gilt; fremde Eingaben lassen sich nicht verwenden.
//   D9  (K1) Gemeinsam nutzbar: derselbe Datenpunkt an einem zweiten Element gebunden; die
//       Folienliste des Anhangs führt jede Zahl an ihrem Element.
import { createHash } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import JSZip from "jszip";
import { beforeAll, describe, expect, it } from "vitest";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { leseFolienDaten, zahlAusWert } from "../../services/app/src/praesentation-daten";
import { SpeicherDatenpunktAblage } from "../../services/app/src/praesentation-daten-ablage";
import { praesentationDatenRoutes } from "../../services/app/src/routes/praesentation-daten-routes";
import {
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
} from "../../services/knowledge-object/src/repo";
import { KoService } from "../../services/knowledge-object/src/service";
import { InMemoryObjectRepo, ObjectStore } from "../../services/object-store";
import { can } from "../../services/rbac";

const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

// Fiktive Bildbytes (Kopf einer PNG-Datei und Füllbytes); erkannt wird hier nichts.
const BILD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7, 7]);
const BILD_KENNUNG = `sha256:${createHash("sha256").update(BILD).digest("hex")}`;
const OCR_TEXT = "Belegschaft\nMitarbeitende 2025: 85";

const absatz = (t: string) => `<a:p><a:r><a:rPr lang="de-DE"/><a:t>${t}</a:t></a:r></a:p>`;
const form = (id: number, name: string, zeilen: string[], titel = false) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr>${titel ? '<p:ph type="title"/>' : ""}</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/>${zeilen.map(absatz).join("")}</p:txBody></p:sp>`;
const zelle = (t: string) => `<a:tc><a:txBody><a:bodyPr/>${absatz(t)}</a:txBody><a:tcPr/></a:tc>`;
const tabelle = (id: number, name: string, zeilen: string[][]) =>
  `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${name}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblGrid/>${zeilen.map((z) => `<a:tr h="370840">${z.map(zelle).join("")}</a:tr>`).join("")}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
const bild = (id: number, name: string, rId: string) =>
  `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${name}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rId}"/></p:blipFill><p:spPr/></p:pic>`;
const folie = (inhalt: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${inhalt}</p:spTree></p:cSld></p:sld>`;

/**
 * Ein kleines, echtes Deck. `umsatzQ4` ändert die Quellzahl für eine zweite Dateifassung. Alle
 * Teile tragen ein festes Datum — sonst wären gleiche Inhalte verschiedene Dateifassungen.
 */
async function deck(umsatzQ4 = "1.500 T€"): Promise<Buffer> {
  const roh = new JSZip();
  const datum = new Date("2026-10-01T08:00:00Z");
  const zip = {
    file: (name: string, inhalt: string | Buffer) => roh.file(name, inhalt, { date: datum }),
    generateAsync: (o: { type: "nodebuffer" }) => roh.generateAsync(o),
  };
  zip.file(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8"?><p:presentation ${NS}><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst></p:presentation>`,
  );
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="${REL}/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="${REL}/slide" Target="slides/slide2.xml"/></Relationships>`,
  );
  zip.file(
    "ppt/slides/slide1.xml",
    folie(
      [
        form(2, "Titel 1", ["Ergebnis Q4 2025"], true),
        tabelle(4, "Tabelle Kennzahlen", [
          ["Kennzahl", "Q3", "Q4"],
          ["Umsatz", "1.400 T€", umsatzQ4],
          ["Kosten", "1.100 T€", "1.200 T€"],
        ]),
        form(5, "Marge", ["Marge Q4: 20,0 %"]),
        form(6, "Ergebnis", ["Ergebnis Q4: 300 T€"]),
        form(7, "Marktanteil", ["Marktanteil: 12 %"]),
        bild(8, "Grafik Belegschaft", "rId5"),
        form(9, "Zusammenfassung", ["Ergebnis 300 T€ bei 85 Mitarbeitenden"]),
      ].join(""),
    ),
  );
  zip.file(
    "ppt/slides/_rels/slide1.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId5" Type="${REL}/image" Target="../media/image1.png"/></Relationships>`,
  );
  zip.file("ppt/media/image1.png", BILD);
  zip.file(
    "ppt/slides/slide2.xml",
    folie(
      [form(2, "Titel 1", ["Ausblick"], true), form(3, "Prognose", ["Umsatz 2026: 1.650 T€"])].join(
        "",
      ),
    ),
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

interface Konto {
  id: string;
  name: string;
  role: "viewer" | "experte" | "controller" | "admin";
}

const KONTEN: Konto[] = [
  { id: "anna", name: "Anna Beispiel", role: "experte" },
  { id: "chef", name: "Chefin Beispiel", role: "admin" },
  { id: "vera", name: "Vera Beispiel", role: "viewer" },
];

interface Welt {
  app: FastifyInstance;
  ko: KoService;
  objekte: ObjectStore;
}

async function baueWelt(): Promise<Welt> {
  const objekte = new ObjectStore({ repo: new InMemoryObjectRepo() });
  const ko = new KoService({
    repo: new InMemoryKoRepo(),
    versions: new InMemoryKoVersionRepo(),
    evidence: new InMemoryEvidenceRepo(),
  });
  const nutzer = (id: string | undefined): SessionUser | undefined => {
    const k = KONTEN.find((x) => x.id === id);
    return k ? { id: k.id, role: k.role, spaceLesbar: new Set() } : undefined;
  };
  const guards: Guards = {
    async requireUser(request, reply) {
      const u = nutzer(request.headers["x-test-nutzer"] as string | undefined);
      if (!u) {
        reply.code(401).send({ error: "UNAUTHORIZED" });
      }
      return u;
    },
    async requirePermission(permission, request, reply) {
      const u = await this.requireUser(request, reply);
      if (u && !can(u.role, permission)) {
        reply.code(403).send({ error: "FORBIDDEN" });
        return undefined;
      }
      return u;
    },
  };
  let uhr = Date.parse("2026-10-15T12:00:00Z");
  const app = Fastify();
  await app.register(
    praesentationDatenRoutes(
      {
        ko,
        objekte,
        ablage: new SpeicherDatenpunktAblage(),
        konten: async () => KONTEN,
        jetzt: () => {
          uhr += 1000;
          return uhr;
        },
      },
      guards,
    ),
  );
  await app.ready();
  return { app, ko, objekte };
}

async function legeObjektAb(w: Welt, bytes: Buffer) {
  return w.objekte.put({
    name: "Quartal.pptx",
    mime: PPTX,
    data: `data:${PPTX};base64,${bytes.toString("base64")}`,
    purpose: "attachment",
  });
}

async function artikelMitDeck(w: Welt, autor = "anna") {
  const ref = await legeObjektAb(w, await deck());
  const ko = await w.ko.create({
    title: "Quartalsbericht Q4 2025 (fiktiv)",
    statement: "Fiktiver Quartalsbericht mit Präsentation.",
    type: "best_practice",
    category: "Testbestand",
    author: autor,
    // Ausdrücklich „intern“: ohne Stufe behandelt `darfSehen` (schutzrang) ein Objekt wie
    // „vertraulich“ — dann läse es die Rolle `viewer` gar nicht (Befund Nacharbeit 1, D1–D9).
    confidentiality: "intern",
  });
  const mit = await w.ko.addAttachment(ko.id, autor, {
    name: "Quartal.pptx",
    mime: PPTX,
    objectId: ref.id,
    size: ref.size,
  });
  const anhang = mit.attachments?.[0];
  if (!anhang) {
    throw new Error("Anhang fehlt");
  }
  return { koId: ko.id, anhangId: anhang.id, objectId: ref.id };
}

// biome-ignore lint/suspicious/noExplicitAny: Antwortkörper der Routen, im Test frei gelesen.
type Koerper = any;

async function rufe(
  w: Welt,
  nutzer: string,
  method: "GET" | "POST",
  url: string,
  payload?: unknown,
): Promise<{ status: number; body: Koerper }> {
  const r = await w.app.inject({
    method,
    url,
    headers: { "x-test-nutzer": nutzer },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : undefined };
}

const ort = (
  anhangId: string,
  sldId: string,
  shapeId: string,
  zeile?: number,
  spalte?: number,
) => ({
  anhangId,
  sldId,
  shapeId,
  ...(zeile === undefined ? {} : { zeile, spalte }),
});

const dimension = (sicht: Koerper, d: string) =>
  sicht.pruefstand.dimensionen.find((x: { dimension: string }) => x.dimension === d);

describe("PP-02 · Datenherkunft und Bindung an Folien", () => {
  let w: Welt;
  let koId: string;
  let anhangId: string;
  let objectId: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    w = await baueWelt();
    ({ koId, anhangId, objectId } = await artikelMitDeck(w));
  });

  it("D0 · der Leser kennt Folien über p:sldId, Elemente über ihre Kennung, Zellen und Bilder", async () => {
    const satz = await leseFolienDaten(await deck());
    expect(satz.fassung).toMatch(/^[0-9a-f]{64}$/);
    expect(satz.folien.map((f) => [f.sldId, f.position, f.titel])).toEqual([
      ["256", 1, "Ergebnis Q4 2025"],
      ["257", 2, "Ausblick"],
    ]);
    const tab = satz.folien[0]?.elemente.find((e) => e.shapeId === "4");
    expect(tab?.art).toBe("tabelle");
    expect(tab?.zellen?.find((z) => z.zeile === 2 && z.spalte === 3)?.text).toBe("1.500 T€");
    const pic = satz.folien[0]?.elemente.find((e) => e.shapeId === "8");
    expect(pic?.bild).toEqual({ kennung: BILD_KENNUNG, bildAufFolie: 1 });
    expect(zahlAusWert("1.500 T€")).toBe(1500);
    expect(zahlAusWert("20,0 %")).toBe(20);
    expect(zahlAusWert("Umsatz 2025: 1.500")).toBeUndefined();
  });

  it("D1 · direkt übernommene Tabellenzahl: Quelle mit Fassung, Fundstelle, Bindung, Herkunft an der Zahl", async () => {
    const umsatz = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "1.500 T€",
      einheit: "T€",
      waehrung: "EUR",
      zeitraum: "Q4 2025",
      bezugsgroesse: "Konzern, fiktiv",
      erfassung: "direkt",
      ort: ort(anhangId, "256", "4", 2, 3),
    });
    expect(umsatz.status).toBe(201);
    const s = umsatz.body;
    ids.umsatz = s.id;
    expect(s.erfassung).toBe("direkt");
    expect([s.wert, s.zahl, s.einheit, s.zeitraum, s.bezugsgroesse]).toEqual([
      "1.500 T€",
      1500,
      "T€",
      "Q4 2025",
      "Konzern, fiktiv",
    ]);
    const artikel = await w.ko.get(koId);
    const fassung = createHash("sha256")
      .update(await deck())
      .digest("hex");
    expect(s.quelle).toMatchObject({
      lesbar: true,
      koId,
      koFassung: artikel?.version,
      aktuelleFassung: artikel?.version,
      anhangId,
      anhangName: "Quartal.pptx",
      objectId,
      dateiFassung: fassung,
    });
    expect(s.fundstelle).toEqual({
      art: "tabellenzelle",
      sldId: "256",
      shapeId: "4",
      folienPosition: 1,
      folienTitel: "Ergebnis Q4 2025",
      elementName: "Tabelle Kennzahlen",
      zeile: 2,
      spalte: 3,
      zeilenkopf: "Umsatz",
      spaltenkopf: "Q4",
      zitat: "1.500 T€",
    });
    expect(s.bindungen).toHaveLength(1);
    expect(s.bindungen[0]).toMatchObject({
      koId,
      anhangId,
      objectId,
      dateiFassung: fassung,
      sldId: "256",
      shapeId: "4",
      zeile: 2,
      spalte: 3,
      lage: "aktuell",
    });
    expect(s.erfasstVon).toEqual({ id: "anna", name: "Anna Beispiel" });

    const kosten = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "1.200 T€",
      einheit: "T€",
      zeitraum: "Q4 2025",
      erfassung: "direkt",
      ort: ort(anhangId, "256", "4", 3, 3),
    });
    expect(kosten.status).toBe(201);
    ids.kosten = kosten.body.id;

    // Aufruf der Herkunft direkt an der Zahl: dieselbe Sicht über ihre Kennung.
    const herkunft = await rufe(w, "vera", "GET", `/api/datenpunkte/${ids.umsatz}`);
    expect(herkunft.status).toBe(200);
    expect(herkunft.body.fundstelle).toEqual(s.fundstelle);
  });

  it("D2/D3 · berechnete Werte: Formel, Rundung, alle verwendeten Eingaben erreichbar; falsche Rechnung abgewiesen", async () => {
    const ergebnis = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "300 T€",
      einheit: "T€",
      zeitraum: "Q4 2025",
      erfassung: "berechnet",
      rechenweg: { art: "differenz", eingaben: [ids.umsatz, ids.kosten], stellen: 0 },
      ort: ort(anhangId, "256", "6"),
    });
    expect(ergebnis.status).toBe(201);
    ids.ergebnis = ergebnis.body.id;
    expect(ergebnis.body.rechenweg).toMatchObject({
      art: "differenz",
      formel: "1.500 T€ − 1.200 T€",
      stellen: 0,
      roh: 300,
      ergebnis: 300,
    });
    expect(ergebnis.body.quelle).toBeNull();
    expect(ergebnis.body.fundstelle).toEqual({ art: "rechenweg" });

    const falsch = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "21,0 %",
      erfassung: "berechnet",
      rechenweg: { art: "anteil_prozent", eingaben: [ids.ergebnis, ids.umsatz], stellen: 1 },
      ort: ort(anhangId, "256", "5"),
    });
    expect(falsch.status).toBe(400);
    expect(falsch.body.message).toContain("ergibt 20,0");

    const marge = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "20,0 %",
      einheit: "%",
      zeitraum: "Q4 2025",
      bezugsgroesse: "Umsatz Q4",
      erfassung: "berechnet",
      rechenweg: { art: "anteil_prozent", eingaben: [ids.ergebnis, ids.umsatz], stellen: 1 },
      ort: ort(anhangId, "256", "5"),
    });
    expect(marge.status).toBe(201);
    ids.marge = marge.body.id;

    // Die ganze Kette: Marge → Ergebnis → Umsatz/Kosten → Tabellenzellen der Quellfassung.
    const h = (await rufe(w, "vera", "GET", `/api/datenpunkte/${ids.marge}`)).body;
    expect(h.rechenweg.formel).toBe("300 T€ ÷ 1.500 T€ × 100");
    expect(h.rechenweg.eingaben.map((e: Koerper) => [e.lesbar, e.verwendet.wert])).toEqual([
      [true, "300 T€"],
      [true, "1.500 T€"],
    ]);
    const blaetter: Koerper[] = [];
    const sammle = (dp: Koerper) => {
      if (dp.rechenweg) {
        for (const e of dp.rechenweg.eingaben) {
          expect(e.lesbar).toBe(true);
          sammle(e.datenpunkt);
        }
      } else {
        blaetter.push(dp);
      }
    };
    sammle(h);
    expect(
      blaetter.map((b) => [b.wert, b.erfassung, b.fundstelle.zeilenkopf, b.quelle.koId]),
    ).toEqual([
      ["1.500 T€", "direkt", "Umsatz", koId],
      ["1.200 T€", "direkt", "Kosten", koId],
      ["1.500 T€", "direkt", "Umsatz", koId],
    ]);
  });

  it("D2/D4 · manuelle Zahl und OCR-Zahl: unterscheidbar; OCR nur mit passendem Bild und Text", async () => {
    const manuell = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "12 %",
      einheit: "%",
      zeitraum: "2025",
      erfassung: "manuell",
      beleg: "Mündliche Auskunft Vertrieb (fiktiv)",
      ort: ort(anhangId, "256", "7"),
    });
    expect(manuell.status).toBe(201);
    ids.manuell = manuell.body.id;

    const fremdesBild = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "85",
      erfassung: "ocr",
      ocr: { text: OCR_TEXT, bildKennung: `sha256:${"0".repeat(64)}`, unsicher: false },
      ort: ort(anhangId, "256", "8"),
    });
    expect(fremdesBild.status).toBe(400);
    const nichtImText = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "86",
      erfassung: "ocr",
      ocr: { text: OCR_TEXT, bildKennung: BILD_KENNUNG, unsicher: false },
      ort: ort(anhangId, "256", "8"),
    });
    expect(nichtImText.status).toBe(400);
    const ocr = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "85",
      zeitraum: "2025",
      erfassung: "ocr",
      ocr: { text: OCR_TEXT, bildKennung: BILD_KENNUNG, unsicher: true },
      ort: ort(anhangId, "256", "8"),
    });
    expect(ocr.status).toBe(201);
    ids.ocr = ocr.body.id;

    const m = manuell.body;
    const o = ocr.body;
    const b = (await rufe(w, "vera", "GET", `/api/datenpunkte/${ids.ergebnis}`)).body;
    // Erfassungsart, Quelle und Fundstelle unterscheiden die drei.
    expect([m.erfassung, o.erfassung, b.erfassung]).toEqual(["manuell", "ocr", "berechnet"]);
    expect(m.quelle).toBeNull();
    expect(m.fundstelle).toEqual({ art: "eingabe", beleg: "Mündliche Auskunft Vertrieb (fiktiv)" });
    expect(o.quelle).toMatchObject({ lesbar: true, koId, anhangId, objectId });
    expect(o.fundstelle).toMatchObject({
      art: "bild",
      sldId: "256",
      shapeId: "8",
      elementName: "Grafik Belegschaft",
      bildKennung: BILD_KENNUNG,
      ocrText: OCR_TEXT,
      unsicher: true,
    });
    expect(b.fundstelle).toEqual({ art: "rechenweg" });
    // Und ihr Prüfstand: OCR ist nicht bestätigt, manuell hat keine Erkennung, berechnet ist
    // maschinell nachgerechnet — validiert ist keiner.
    expect(dimension(o, "erkennung").stand).toBe("offen");
    expect(dimension(o, "erkennung").grund).toContain("OCR allein validiert nicht");
    expect(dimension(o, "erkennung").grund).toContain("unsicheren Stellen");
    expect(dimension(m, "erkennung").stand).toBe("nicht_zutreffend");
    expect(dimension(b, "berechnung").stand).toBe("bestanden");
    expect(dimension(b, "berechnung").pruefung.von).toBe("klarwerk:rechenweg");
    for (const x of [m, o, b]) {
      expect(x.pruefstand.zustand).not.toBe("validiert");
    }
    expect(o.pruefstand.zustand).toBe("erfasst");
  });

  it("D4 · Prognose nur mit Annahmen; direkt übernommen nur, wenn der Wert an der Fundstelle steht", async () => {
    const ohneAnnahme = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "1.650 T€",
      erfassung: "prognose",
      ort: ort(anhangId, "257", "3"),
    });
    expect(ohneAnnahme.status).toBe(400);
    const prognose = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "1.650 T€",
      einheit: "T€",
      zeitraum: "2026",
      erfassung: "prognose",
      annahmen: ["Wachstum 10 % gegenüber 2025 (fiktiv)"],
      modellbezug: "lineare Fortschreibung",
      ort: ort(anhangId, "257", "3"),
    });
    expect(prognose.status).toBe(201);
    expect(prognose.body.pruefstand.prognose).toBe(true);
    expect(prognose.body.annahmen).toEqual(["Wachstum 10 % gegenüber 2025 (fiktiv)"]);
    expect(prognose.body.erfassung).toBe("prognose");

    const nichtDort = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "1.600 T€",
      erfassung: "direkt",
      ort: ort(anhangId, "256", "4", 2, 3),
    });
    expect(nichtDort.status).toBe(400);
    expect(nichtDort.body.message).toContain("steht nicht in diesem Element");
    const zweiZahlen = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "Umsatz 2025: 1.500",
      erfassung: "manuell",
    });
    expect(zweiZahlen.status).toBe(400);
  });

  it("D5 · Dimensionen getrennt; maschinelle Erkennung validiert nicht; validiert erst mit fachlicher Freigabe", async () => {
    const vorher = (await rufe(w, "vera", "GET", `/api/datenpunkte/${ids.kosten}`)).body;
    expect(vorher.pruefstand.erforderlich).toEqual([
      "erkennung",
      "struktur",
      "konsistenz",
      "aktualitaet",
      "fachliche_freigabe",
    ]);
    expect(dimension(vorher, "erkennung")).toMatchObject({ stand: "bestanden" });
    expect(dimension(vorher, "erkennung").pruefung.von).toBe("klarwerk:pptx-leser");
    expect(dimension(vorher, "berechnung").stand).toBe("nicht_zutreffend");
    expect(vorher.pruefstand.zustand).toBe("in_pruefung");
    expect(vorher.pruefstand.naechsteArbeit.length).toBeGreaterThan(0);

    let fassung = vorher.fassung;
    for (const d of ["struktur", "konsistenz", "aktualitaet"]) {
      const r = await rufe(w, "anna", "POST", `/api/datenpunkte/${ids.kosten}/pruefungen`, {
        dimension: d,
        ergebnis: "bestanden",
        grund: `${d} geprüft (fiktiv)`,
        fassung,
      });
      expect(r.status).toBe(200);
      fassung = r.body.fassung;
    }
    const ohneFreigabe = (await rufe(w, "vera", "GET", `/api/datenpunkte/${ids.kosten}`)).body;
    expect(ohneFreigabe.pruefstand.zustand).toBe("in_pruefung");
    expect(dimension(ohneFreigabe, "fachliche_freigabe").stand).toBe("offen");

    // Fachliche Freigabe: das Recht der Artikelfreigabe (ko.validate), nicht das des Erfassens.
    const experte = await rufe(w, "anna", "POST", `/api/datenpunkte/${ids.kosten}/pruefungen`, {
      dimension: "fachliche_freigabe",
      ergebnis: "bestanden",
      fassung,
    });
    expect(experte.status).toBe(403);
    const frei = await rufe(w, "chef", "POST", `/api/datenpunkte/${ids.kosten}/pruefungen`, {
      dimension: "fachliche_freigabe",
      ergebnis: "bestanden",
      grund: "Mit dem Controlling abgestimmt (fiktiv)",
      fassung,
    });
    expect(frei.status).toBe(200);
    expect(frei.body.pruefstand.zustand).toBe("validiert");
    expect(frei.body.pruefstand.grund).toContain("Datenfassung 1");
    expect(dimension(frei.body, "fachliche_freigabe").pruefung).toMatchObject({
      von: "chef",
      name: "Chefin Beispiel",
      datenFassung: 1,
    });

    const klaerung = await rufe(w, "anna", "POST", `/api/datenpunkte/${ids.ocr}/pruefungen`, {
      dimension: "erkennung",
      ergebnis: "klaerung",
      fassung: 1,
    });
    expect(klaerung.status).toBe(400); // Klärung braucht einen Grund.
    const mitGrund = await rufe(w, "anna", "POST", `/api/datenpunkte/${ids.ocr}/pruefungen`, {
      dimension: "erkennung",
      ergebnis: "klaerung",
      grund: "Ziffer im Bild unscharf: 85 oder 86?",
      fassung: 1,
    });
    expect(mitGrund.body.pruefstand.zustand).toBe("klaerung");
    expect(mitGrund.body.pruefstand.grund).toContain("85 oder 86");
  });

  it("D6 · Wert- und Bezugsrahmenänderung heben den alten Status auf; veraltete Prüfung abgewiesen", async () => {
    const korrektur = await rufe(w, "anna", "POST", `/api/datenpunkte/${ids.kosten}/korrektur`, {
      fassung: 1,
      zeitraum: "Q4 2025 (Oktober bis Dezember)",
      grund: "Zeitraum präzisiert (fiktiv)",
    });
    expect(korrektur.status).toBe(200);
    const k = korrektur.body;
    expect(k.fassung).toBe(2);
    expect(k.pruefstand.zustand).toBe("ueberpruefung_noetig");
    expect(dimension(k, "struktur").stand).toBe("ueberholt");
    expect(dimension(k, "struktur").grund).toContain("Bezugszeitraum");
    expect(dimension(k, "fachliche_freigabe").stand).toBe("ueberholt");
    // Die alten Prüfungen bleiben sichtbar, gelten aber nicht mehr.
    expect(k.pruefungen.filter((p: Koerper) => p.datenFassung === 1).length).toBe(5);
    expect(k.korrekturen).toEqual([
      expect.objectContaining({
        fassung: 2,
        felder: ["zeitraum"],
        vorher: { zeitraum: "Q4 2025" },
        von: "anna",
        name: "Anna Beispiel",
      }),
    ]);

    const veraltet = await rufe(w, "anna", "POST", `/api/datenpunkte/${ids.kosten}/pruefungen`, {
      dimension: "struktur",
      ergebnis: "bestanden",
      fassung: 1,
    });
    expect(veraltet.status).toBe(409);
    expect(veraltet.body.error).toBe("DATENPUNKT_GEAENDERT");

    // Die Eingabe Kosten hat eine neue Fassung → das Ergebnis darf seinen Rechenstatus nicht behalten.
    const ergebnis = (await rufe(w, "vera", "GET", `/api/datenpunkte/${ids.ergebnis}`)).body;
    expect(dimension(ergebnis, "berechnung").stand).toBe("ueberholt");
    expect(dimension(ergebnis, "berechnung").grund).toContain("gerechnet mit 1");
    expect(ergebnis.pruefstand.zustand).toBe("ueberpruefung_noetig");
    // Nacharbeit 2 (Bens Befund 2): die Eingabe erscheint in der VERWENDETEN Fassung (damaliger
    // Zeitraum), der heutige Stand steht daneben.
    const kostenEingabe = ergebnis.rechenweg.eingaben[1];
    expect(kostenEingabe.verwendet.fassung).toBe(1);
    expect(kostenEingabe.datenpunkt.fassung).toBe(1);
    expect(kostenEingabe.datenpunkt.zeitraum).toBe("Q4 2025");
    expect(kostenEingabe.datenpunkt.historisch).toEqual({ aktuelleFassung: 2 });
    expect(kostenEingabe.aktuell).toEqual({ fassung: 2, wert: "1.200 T€" });

    const neu = await rufe(w, "anna", "POST", `/api/datenpunkte/${ids.ergebnis}/korrektur`, {
      fassung: 1,
      neuBerechnen: true,
      grund: "Eingabe Kosten präzisiert",
    });
    expect(neu.status).toBe(200);
    expect(neu.body.fassung).toBe(2);
    expect(neu.body.wert).toBe("300 T€");
    expect(neu.body.rechenweg.eingaben.map((e: Koerper) => e.verwendet.fassung)).toEqual([1, 2]);
    expect(dimension(neu.body, "berechnung").stand).toBe("bestanden");

    // Eine Wertkorrektur an einer manuellen Zahl: neue Fassung, Bindung zeigt die Abweichung.
    const wert = await rufe(w, "anna", "POST", `/api/datenpunkte/${ids.manuell}/korrektur`, {
      fassung: 1,
      wert: "13 %",
      grund: "Neue Auskunft (fiktiv)",
    });
    expect(wert.status).toBe(200);
    expect(wert.body.zahl).toBe(13);
    expect(wert.body.bindungen[0]).toMatchObject({
      lage: "abweichung",
      heute: "Marktanteil: 12 %",
    });
  });

  it("D7 · neue Quellfassung: Aktualität überholt, Abweichung an der Folie; neu lesen", async () => {
    const neueDatei = await legeObjektAb(w, await deck("1.550 T€"));
    const artikel = await w.ko.get(koId);
    await w.ko.uebernimmOfficeFassung(
      koId,
      {
        anhangId,
        objectId: neueDatei.id,
        size: neueDatei.size,
        expectedVersion: artikel?.version ?? 0,
      },
      "anna",
    );
    const umsatz = (await rufe(w, "vera", "GET", `/api/datenpunkte/${ids.umsatz}`)).body;
    expect(umsatz.pruefstand.zustand).toBe("ueberpruefung_noetig");
    expect(dimension(umsatz, "aktualitaet").stand).toBe("ueberholt");
    expect(dimension(umsatz, "aktualitaet").grund).toContain("neue Fassung");
    expect(umsatz.quelle.koFassung).toBeLessThan(umsatz.quelle.aktuelleFassung);
    expect(umsatz.bindungen[0]).toMatchObject({ lage: "abweichung", heute: "1.550 T€" });
    const kosten = (await rufe(w, "vera", "GET", `/api/datenpunkte/${ids.kosten}`)).body;
    expect(kosten.bindungen[0].lage).toBe("bestaetigt_in_neuer_fassung");

    const nurNeuLesen = await rufe(w, "anna", "POST", `/api/datenpunkte/${ids.umsatz}/korrektur`, {
      fassung: 1,
      quelleAktualisieren: true,
      grund: "Neue Quellfassung",
    });
    expect(nurNeuLesen.status).toBe(400);
    expect(nurNeuLesen.body.message).toContain("1.550 T€");
    const gelesen = await rufe(w, "anna", "POST", `/api/datenpunkte/${ids.umsatz}/korrektur`, {
      fassung: 1,
      quelleAktualisieren: true,
      wert: "1.550 T€",
      grund: "Neue Quellfassung übernommen",
    });
    expect(gelesen.status).toBe(200);
    expect(gelesen.body.quelle.objectId).toBe(neueDatei.id);
    expect(gelesen.body.quelle.koFassung).toBe(gelesen.body.quelle.aktuelleFassung);
    expect(dimension(gelesen.body, "erkennung")).toMatchObject({ stand: "bestanden" });
    expect(dimension(gelesen.body, "aktualitaet").stand).toBe("offen");
    expect(gelesen.body.bindungen[0].lage).toBe("bestaetigt_in_neuer_fassung");
    // Die Marge rechnete mit der alten Umsatzfassung: Überprüfung nötig.
    const marge = (await rufe(w, "vera", "GET", `/api/datenpunkte/${ids.marge}`)).body;
    expect(dimension(marge, "berechnung").stand).toBe("ueberholt");
  });

  it("D8 · Rechte: Rollen, Sichtbarkeit der Quellen, strengste Schutzstufe", async () => {
    // Lesende Rolle sieht, ändert aber nichts.
    expect(
      (
        await rufe(w, "vera", "POST", `/api/kos/${koId}/datenpunkte`, {
          art: "zahl",
          wert: "1",
          erfassung: "manuell",
        })
      ).status,
    ).toBe(403);
    expect((await rufe(w, "vera", "GET", `/api/kos/${koId}/datenpunkte`)).status).toBe(200);

    // Eine vertrauliche Quelle (nur für die Chefin sichtbar) hinter einem sichtbaren Artikel.
    const geheim = await w.ko.create({
      title: "Marktstudie 2025 (fiktiv)",
      statement: "Marktvolumen 2025: 40 Mio. € laut fiktiver Studie.",
      type: "best_practice",
      category: "Testbestand",
      author: "chef",
    });
    await w.ko.setConfidentiality(geheim.id, "vertraulich", "chef");
    const studie = await rufe(w, "chef", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "40 Mio. €",
      waehrung: "EUR",
      zeitraum: "2025",
      erfassung: "direkt",
      quelleKoId: geheim.id,
      zitat: "Marktvolumen 2025: 40 Mio. €",
    });
    expect(studie.status).toBe(201);
    expect(studie.body.fundstelle).toEqual({
      art: "artikel",
      zitat: "Marktvolumen 2025: 40 Mio. €",
    });
    expect(studie.body.schutzstufe).toBe("vertraulich");

    // Nacharbeit 2 (Bens Befund 1): ohne Leserecht an der Quelle gibt es den Datenpunkt für Anna
    // nicht — sein Wert, die Fundstelle mit Zitat und alles Abgeleitete stammen aus der Quelle.
    const fuerAnna = await rufe(w, "anna", "GET", `/api/datenpunkte/${studie.body.id}`);
    expect(fuerAnna.status).toBe(404);

    // Anna kann die vertrauliche Quelle nicht als Fundstelle nennen …
    const annaDirekt = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "40 Mio. €",
      erfassung: "direkt",
      quelleKoId: geheim.id,
      zitat: "Marktvolumen 2025: 40 Mio. €",
    });
    expect(annaDirekt.status).toBe(404);

    // … und ein Datenpunkt am vertraulichen Artikel ist für sie weder lesbar noch Eingabe.
    const amGeheimen = await rufe(w, "chef", "POST", `/api/kos/${geheim.id}/datenpunkte`, {
      art: "zahl",
      wert: "40 Mio. €",
      erfassung: "direkt",
      quelleKoId: geheim.id,
      zitat: "Marktvolumen 2025: 40 Mio. €",
    });
    expect(amGeheimen.status).toBe(201);
    expect((await rufe(w, "anna", "GET", `/api/datenpunkte/${amGeheimen.body.id}`)).status).toBe(
      404,
    );
    const annaRechnet = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "41.500.000",
      erfassung: "berechnet",
      rechenweg: { art: "summe", eingaben: [amGeheimen.body.id, ids.umsatz], stellen: 0 },
    });
    expect(annaRechnet.status).toBe(404);

    // Die Chefin rechnet damit. Die Formel trüge den vertraulichen Wert („… + 40 Mio. €“), das
    // Ergebnis ist aus ihm abgeleitet: für Anna gibt es den berechneten Datenpunkt nicht.
    // Umsatz steht nach D7 bei 1.550; 1.550 + 40 = 1.590 (nur als Rechteprobe, fiktiv).
    const anteil = await rufe(w, "chef", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "1.590",
      erfassung: "berechnet",
      rechenweg: { art: "summe", eingaben: [ids.umsatz, amGeheimen.body.id], stellen: 0 },
    });
    expect(anteil.status).toBe(201);
    expect(anteil.body.rechenweg.formel).toContain("40 Mio. €");
    expect(anteil.body.schutzstufe).toBe("vertraulich");
    const anteilAnna = await rufe(w, "anna", "GET", `/api/datenpunkte/${anteil.body.id}`);
    expect(anteilAnna.status).toBe(404);
    // Die Chefin sieht weiter alles, Fundstelle samt Zitat.
    const fuerChef = await rufe(w, "chef", "GET", `/api/datenpunkte/${studie.body.id}`);
    expect(fuerChef.status).toBe(200);
    expect(fuerChef.body.fundstelle.zitat).toBe("Marktvolumen 2025: 40 Mio. €");

    // Die vollständigen Antwortkörper, die Anna erreicht, tragen nichts davon — weder in Listen noch
    // als Eingabe, Formel, Fundstelle, Prüfgrund oder Korrektur.
    const geheimnisse = [
      "40 Mio",
      "Marktvolumen",
      "Marktstudie",
      "1.590",
      studie.body.id,
      amGeheimen.body.id,
      anteil.body.id,
    ];
    const fuerAnnaKoerper = [
      JSON.stringify(fuerAnna.body),
      JSON.stringify(anteilAnna.body),
      JSON.stringify((await rufe(w, "anna", "GET", `/api/kos/${koId}/datenpunkte`)).body),
      JSON.stringify(
        (await rufe(w, "anna", "GET", `/api/kos/${koId}/office/${anhangId}/folien-daten`)).body,
      ),
    ];
    for (const koerper of fuerAnnaKoerper) {
      for (const geheimnis of geheimnisse) {
        expect(koerper, geheimnis).not.toContain(geheimnis);
      }
    }

    // RECHTEENTZUG: eine zuerst interne Quelle wird vertraulich. Danach erreicht Anna weder den
    // direkt übernommenen Wert noch die Berechnung daraus — samt Prüfgrund und Korrekturhistorie.
    const lager = await w.ko.create({
      title: "Lagerbericht 2025 (fiktiv)",
      statement: "Lagerbestand 2025: 7.300 Stück im Zentrallager.",
      type: "best_practice",
      category: "Testbestand",
      author: "chef",
      confidentiality: "intern",
    });
    const bestand = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "7.300 Stück",
      einheit: "Stück",
      zeitraum: "2025",
      erfassung: "direkt",
      quelleKoId: lager.id,
      zitat: "Lagerbestand 2025: 7.300 Stück",
    });
    expect(bestand.status).toBe(201);
    const pruefung = await rufe(
      w,
      "anna",
      "POST",
      `/api/datenpunkte/${bestand.body.id}/pruefungen`,
      {
        dimension: "struktur",
        ergebnis: "klaerung",
        grund: "Lagerbericht nennt 7.300 Stück ohne Stichtag",
        fassung: 1,
      },
    );
    expect(pruefung.status).toBe(200);
    const korrektur = await rufe(
      w,
      "anna",
      "POST",
      `/api/datenpunkte/${bestand.body.id}/korrektur`,
      {
        fassung: 1,
        zeitraum: "Stichtag 31.12.2025",
        grund: "Stichtag aus dem Lagerbericht ergänzt",
      },
    );
    expect(korrektur.status).toBe(200);
    // 7.300 + 85 (OCR-Zahl aus D2/D4) = 7.385 — nur als Rechteprobe, fiktiv.
    const summe = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, {
      art: "zahl",
      wert: "7.385",
      erfassung: "berechnet",
      rechenweg: { art: "summe", eingaben: [bestand.body.id, ids.ocr], stellen: 0 },
    });
    expect(summe.status).toBe(201);
    expect((await rufe(w, "anna", "GET", `/api/datenpunkte/${summe.body.id}`)).status).toBe(200);

    await w.ko.setConfidentiality(lager.id, "vertraulich", "chef");

    for (const pfad of [
      `/api/datenpunkte/${bestand.body.id}`,
      `/api/datenpunkte/${bestand.body.id}?fassung=1`,
      `/api/datenpunkte/${summe.body.id}`,
    ]) {
      expect((await rufe(w, "anna", "GET", pfad)).status, pfad).toBe(404);
    }
    for (const [pfad, rumpf] of [
      [
        `/api/datenpunkte/${bestand.body.id}/pruefungen`,
        { dimension: "struktur", ergebnis: "bestanden", fassung: 2 },
      ],
      [`/api/datenpunkte/${bestand.body.id}/korrektur`, { fassung: 2, grund: "Probe" }],
      [`/api/datenpunkte/${bestand.body.id}/bindungen`, { koId, ort: ort(anhangId, "256", "9") }],
      [
        `/api/datenpunkte/${summe.body.id}/korrektur`,
        { fassung: 1, neuBerechnen: true, grund: "x" },
      ],
    ] as const) {
      expect((await rufe(w, "anna", "POST", pfad, rumpf)).status, pfad).toBe(404);
    }
    const nachEntzug = [
      JSON.stringify((await rufe(w, "anna", "GET", `/api/kos/${koId}/datenpunkte`)).body),
      JSON.stringify(
        (await rufe(w, "anna", "GET", `/api/kos/${koId}/office/${anhangId}/folien-daten`)).body,
      ),
    ];
    for (const koerper of nachEntzug) {
      for (const geheimnis of [
        "7.300",
        "7.385",
        "Lagerbestand",
        "Lagerbericht",
        "Stichtag",
        bestand.body.id,
        summe.body.id,
      ]) {
        expect(koerper, geheimnis).not.toContain(geheimnis);
      }
    }
    // Die Berechtigte sieht weiter die ganze Historie.
    const chefBestand = await rufe(w, "chef", "GET", `/api/datenpunkte/${bestand.body.id}`);
    expect(chefBestand.status).toBe(200);
    expect(chefBestand.body.korrekturen[0].vorher).toEqual({ zeitraum: "2025" });

    // Unbekannt und unsichtbar sehen gleich aus.
    expect((await rufe(w, "anna", "GET", "/api/datenpunkte/gibt-es-nicht")).status).toBe(404);
    expect(
      (await rufe(w, "anna", "GET", `/api/kos/${geheim.id}/office/x/folien-daten`)).status,
    ).toBe(404);
  });

  it("D9 · gemeinsam nutzbar: zweite Bindung; die Folienliste führt jede Zahl an ihrem Element", async () => {
    const zweite = await rufe(w, "anna", "POST", `/api/datenpunkte/${ids.ergebnis}/bindungen`, {
      koId,
      ort: ort(anhangId, "256", "9"),
    });
    expect(zweite.status).toBe(200);
    expect(zweite.body.bindungen.map((b: Koerper) => b.shapeId)).toEqual(["6", "9"]);
    const falsch = await rufe(w, "anna", "POST", `/api/datenpunkte/${ids.ergebnis}/bindungen`, {
      koId,
      ort: ort(anhangId, "256", "7"),
    });
    expect(falsch.status).toBe(400);

    const lage = await rufe(w, "vera", "GET", `/api/kos/${koId}/office/${anhangId}/folien-daten`);
    expect(lage.status).toBe(200);
    expect(lage.body.darfErfassen).toBe(false);
    expect(lage.body.folien.map((f: Koerper) => f.sldId)).toEqual(["256", "257"]);
    const amElement = (shapeId: string) =>
      lage.body.datenpunkte
        .filter((d: Koerper) =>
          d.bindungen.some((b: Koerper) => b.sldId === "256" && b.shapeId === shapeId),
        )
        .map((d: Koerper) => [d.wert, d.erfassung]);
    expect(amElement("7")).toEqual([["13 %", "manuell"]]);
    expect(amElement("8")).toEqual([["85", "ocr"]]);
    expect(amElement("6")).toEqual([["300 T€", "berechnet"]]);
    expect(amElement("9")).toEqual([["300 T€", "berechnet"]]);
    expect(amElement("4").map((x: string[]) => x[1])).toEqual(["direkt", "direkt"]);
  });

  it("D10 · eine Berechnung führt zur tatsächlich verwendeten Fassung ihrer Eingaben samt damaliger Quelle", async () => {
    // Stand nach D6/D7: Umsatz und Ergebnis haben Fassung 2; die Marge rechnete mit Fassung 1.
    const marge = (await rufe(w, "vera", "GET", `/api/datenpunkte/${ids.marge}`)).body;
    const [ergebnis, umsatz] = marge.rechenweg.eingaben;
    expect(umsatz.verwendet).toMatchObject({ fassung: 1, wert: "1.500 T€" });
    expect(umsatz.aktuell).toEqual({ fassung: 2, wert: "1.550 T€" });
    expect(umsatz.datenpunkt).toMatchObject({
      fassung: 1,
      wert: "1.500 T€",
      historisch: { aktuelleFassung: 2 },
    });
    // Die damalige Quelle: die erste Dateifassung, die damalige Zelle mit ihrem damaligen Text.
    expect(umsatz.datenpunkt.quelle).toMatchObject({ lesbar: true, objectId });
    expect(umsatz.datenpunkt.fundstelle).toMatchObject({ zeile: 2, spalte: 3, zitat: "1.500 T€" });
    // Rekursiv: das Ergebnis in Fassung 1 mit SEINEN damals verwendeten Eingaben.
    expect(ergebnis.aktuell.fassung).toBe(2);
    expect(ergebnis.datenpunkt.fassung).toBe(1);
    expect(
      ergebnis.datenpunkt.rechenweg.eingaben.map((e: Koerper) => [
        e.verwendet.fassung,
        e.datenpunkt.fassung,
        e.datenpunkt.wert,
        e.datenpunkt.zeitraum,
      ]),
    ).toEqual([
      [1, 1, "1.500 T€", "Q4 2025"],
      [1, 1, "1.200 T€", "Q4 2025"],
    ]);

    // Direkt abrufbar: `?fassung=n`; die aktuelle Fassung trägt keine Markierung.
    const damals = await rufe(w, "vera", "GET", `/api/datenpunkte/${ids.umsatz}?fassung=1`);
    expect(damals.status).toBe(200);
    expect(damals.body).toMatchObject({ fassung: 1, wert: "1.500 T€" });
    expect(damals.body.quelle.objectId).toBe(objectId);
    expect(damals.body.korrekturen).toEqual([]);
    const heute = await rufe(w, "vera", "GET", `/api/datenpunkte/${ids.umsatz}?fassung=2`);
    expect(heute.body.wert).toBe("1.550 T€");
    expect(heute.body.historisch).toBeUndefined();
    for (const falsch of ["0", "3", "zwei"]) {
      const r = await rufe(w, "vera", "GET", `/api/datenpunkte/${ids.umsatz}?fassung=${falsch}`);
      expect(r.status, falsch).toBe(400);
    }
  });
});
