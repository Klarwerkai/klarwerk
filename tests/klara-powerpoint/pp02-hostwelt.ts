// ================================================================================================
// PP-02 · HOSTANSCHLUSS — DIE GEMEINSAME PRÜFWELT (Server- und Fenstertest)
// ================================================================================================
//
// Dieselbe Bauart wie `pp02-datenherkunft.test.ts`: echte Routen, echter Wissensobjektdienst, echter
// Objektspeicher, eine hier gebaute `.pptx`; ersetzt ist nur die Anmeldung (`x-test-nutzer`). Der
// Bestand ist fiktiv und deckt die Abnahme von PP-02 ab: zwei direkt übernommene Tabellenzahlen,
// ein BERECHNETER Wert daraus, eine MANUELLE Zahl und eine OCR-Zahl aus einem Folienbild.
//
// `deck()` baut auf Wunsch die Fassung, die PowerPoint nach einer Bearbeitung GEÖFFNET hätte: eine
// neue Folie vorn (andere Positionen, gleiche `p:sldId`), eine geänderte Tabellenzahl, ein
// gelöschtes Textfeld. Die Texterkennung selbst läuft hier nicht (wie in D2/D4).
import { createHash } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import JSZip from "jszip";
import type { BildKorrekturDienst } from "../../services/app/src/assistenz-bildkorrekturen";
import type { FolienAbgleichGrenzen } from "../../services/app/src/folien-abgleich-grenzen";
import type { Guards, SessionUser } from "../../services/app/src/http";
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

export const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export const BILD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 8, 8, 8]);
export const BILD_KENNUNG = `sha256:${createHash("sha256").update(BILD).digest("hex")}`;
export const OCR_TEXT = "Belegschaft\nMitarbeitende 2025: 85";

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

export interface DeckFassung {
  /** Q4-Kosten in der Tabelle (Zeile 3, Spalte 3). */
  kostenQ4?: string;
  /** Eine neue Folie (`p:sldId` 258) VOR allen anderen. */
  neueFolieVorn?: boolean;
  /** Das Textfeld „Marktanteil“ (7) ist gelöscht. */
  ohneMarktanteil?: boolean;
}

/** Folie 256: Titel 2, Tabelle 4, Ergebnis 6, Marktanteil 7, Bild 8 · Folie 257: Titel 2, Ergebnis 6. */
export async function deck(f: DeckFassung = {}, bildBytes = BILD): Promise<Buffer> {
  const roh = new JSZip();
  const datum = new Date("2026-10-01T08:00:00Z");
  const datei = (name: string, inhalt: string | Buffer) => roh.file(name, inhalt, { date: datum });
  const reihe = [
    ...(f.neueFolieVorn ? ['<p:sldId id="258" r:id="rId4"/>'] : []),
    '<p:sldId id="256" r:id="rId2"/>',
    '<p:sldId id="257" r:id="rId3"/>',
  ];
  datei(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8"?><p:presentation ${NS}><p:sldIdLst>${reihe.join("")}</p:sldIdLst></p:presentation>`,
  );
  datei(
    "ppt/_rels/presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="${REL}/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="${REL}/slide" Target="slides/slide2.xml"/>${f.neueFolieVorn ? `<Relationship Id="rId4" Type="${REL}/slide" Target="slides/slide3.xml"/>` : ""}</Relationships>`,
  );
  datei(
    "ppt/slides/slide1.xml",
    folie(
      [
        form(2, "Titel 1", ["Ergebnis Q4 2025"], true),
        tabelle(4, "Tabelle Kennzahlen", [
          ["Kennzahl", "Q3", "Q4"],
          ["Umsatz", "1.400 T€", "1.500 T€"],
          ["Kosten", "1.100 T€", f.kostenQ4 ?? "1.200 T€"],
        ]),
        form(6, "Ergebnis", ["Ergebnis Q4: 300 T€"]),
        ...(f.ohneMarktanteil ? [] : [form(7, "Marktanteil", ["Marktanteil: 12 %"])]),
        bild(8, "Grafik Belegschaft", "rId5"),
      ].join(""),
    ),
  );
  datei(
    "ppt/slides/_rels/slide1.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId5" Type="${REL}/image" Target="../media/image1.png"/></Relationships>`,
  );
  datei("ppt/media/image1.png", bildBytes);
  // Folie 257 trägt dieselbe Elementkennung 6 wie Folie 256 — ohne gebundene Zahl.
  datei(
    "ppt/slides/slide2.xml",
    folie(
      [form(2, "Titel 1", ["Ausblick"], true), form(6, "Ergebnis", ["Ergebnis 2026: 320 T€"])].join(
        "",
      ),
    ),
  );
  if (f.neueFolieVorn) {
    datei("ppt/slides/slide3.xml", folie(form(2, "Titel 1", ["Agenda (neu)"], true)));
  }
  return roh.generateAsync({ type: "nodebuffer" });
}

export interface Konto {
  id: string;
  name: string;
  role: "viewer" | "experte" | "controller" | "admin";
}

export const KONTEN: Konto[] = [
  { id: "anna", name: "Anna Beispiel", role: "experte" },
  { id: "vera", name: "Vera Beispiel", role: "viewer" },
];

export interface Welt {
  app: FastifyInstance;
  ko: KoService;
  objekte: ObjectStore;
}

/** `abgleichGrenzen`: niedrige Grenzen des Hostabgleichs für die Grenzproben (Prüfbefund B1). */
export async function baueWelt(
  optionen: {
    abgleichGrenzen?: Partial<FolienAbgleichGrenzen>;
    bildKorrekturen?: Pick<BildKorrekturDienst, "lies">;
  } = {},
): Promise<Welt> {
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
  let uhr = Date.parse("2026-10-17T08:00:00Z");
  const app = Fastify();
  await app.register(
    praesentationDatenRoutes(
      {
        ko,
        objekte,
        ablage: new SpeicherDatenpunktAblage(),
        konten: async () => KONTEN,
        ...(optionen.bildKorrekturen ? { bildKorrekturen: optionen.bildKorrekturen } : {}),
        jetzt: () => {
          uhr += 1000;
          return uhr;
        },
        ...(optionen.abgleichGrenzen ? { abgleichGrenzen: optionen.abgleichGrenzen } : {}),
      },
      guards,
    ),
  );
  await app.ready();
  return { app, ko, objekte };
}

export async function artikelMitDeck(w: Welt): Promise<{ koId: string; anhangId: string }> {
  const bytes = await deck();
  const ref = await w.objekte.put({
    name: "Quartal-fiktiv.pptx",
    mime: PPTX,
    data: `data:${PPTX};base64,${bytes.toString("base64")}`,
    purpose: "attachment",
  });
  const ko = await w.ko.create({
    title: "Quartalsbericht Q4 2025 (fiktiv)",
    statement: "Fiktiver Quartalsbericht mit Präsentation.",
    type: "best_practice",
    category: "Testbestand",
    author: "anna",
    confidentiality: "intern",
  });
  const mit = await w.ko.addAttachment(ko.id, "anna", {
    name: "Quartal-fiktiv.pptx",
    mime: PPTX,
    objectId: ref.id,
    size: ref.size,
  });
  const anhang = mit.attachments?.[0];
  if (!anhang) {
    throw new Error("Anhang fehlt");
  }
  return { koId: ko.id, anhangId: anhang.id };
}

// biome-ignore lint/suspicious/noExplicitAny: Antwortkörper der Routen, im Test frei gelesen.
export type Koerper = any;

export async function rufe(
  w: Welt,
  nutzer: string | undefined,
  method: "GET" | "POST",
  url: string,
  payload?: unknown,
): Promise<{ status: number; body: Koerper }> {
  const r = await w.app.inject({
    method,
    url,
    headers: nutzer ? { "x-test-nutzer": nutzer } : {},
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });
  let body: Koerper;
  try {
    body = r.body ? JSON.parse(r.body) : undefined;
  } catch {
    body = r.body;
  }
  return { status: r.statusCode, body };
}

const ort = (anhangId: string, shapeId: string, zeile?: number, spalte?: number) => ({
  anhangId,
  sldId: "256",
  shapeId,
  ...(zeile === undefined ? {} : { zeile, spalte }),
});

export interface Bestand {
  koId: string;
  anhangId: string;
  ids: {
    umsatz: string;
    kosten: string;
    ergebnis: string;
    marktanteil: string;
    belegschaft: string;
  };
}

/** Der fiktive Bestand über die echten Routen: direkt, direkt, berechnet, manuell, OCR. */
export async function bestandAnlegen(w: Welt): Promise<Bestand> {
  const { koId, anhangId } = await artikelMitDeck(w);
  const neu = async (rumpf: Record<string, unknown>): Promise<string> => {
    const r = await rufe(w, "anna", "POST", `/api/kos/${koId}/datenpunkte`, rumpf);
    if (r.status !== 201) {
      throw new Error(`Erfassen scheiterte (${r.status}): ${JSON.stringify(r.body)}`);
    }
    return r.body.id as string;
  };
  const umsatz = await neu({
    art: "zahl",
    wert: "1.500 T€",
    einheit: "T€",
    zeitraum: "Q4 2025",
    erfassung: "direkt",
    ort: ort(anhangId, "4", 2, 3),
  });
  const kosten = await neu({
    art: "zahl",
    wert: "1.200 T€",
    einheit: "T€",
    zeitraum: "Q4 2025",
    erfassung: "direkt",
    ort: ort(anhangId, "4", 3, 3),
  });
  const ergebnis = await neu({
    art: "zahl",
    wert: "300 T€",
    einheit: "T€",
    zeitraum: "Q4 2025",
    erfassung: "berechnet",
    rechenweg: { art: "differenz", eingaben: [umsatz, kosten], stellen: 0 },
    ort: ort(anhangId, "6"),
  });
  const marktanteil = await neu({
    art: "zahl",
    wert: "12 %",
    einheit: "%",
    zeitraum: "2025",
    erfassung: "manuell",
    beleg: "Mündliche Auskunft Vertrieb (fiktiv)",
    ort: ort(anhangId, "7"),
  });
  const belegschaft = await neu({
    art: "zahl",
    wert: "85",
    zeitraum: "2025",
    erfassung: "ocr",
    ocr: { text: OCR_TEXT, bildKennung: BILD_KENNUNG, unsicher: true },
    ort: ort(anhangId, "8"),
  });
  return { koId, anhangId, ids: { umsatz, kosten, ergebnis, marktanteil, belegschaft } };
}

export const abgleichPfad = (b: { koId: string; anhangId: string }) =>
  `/api/kos/${b.koId}/office/${b.anhangId}/folien-abgleich`;
