// ================================================================================================
// produkt:wettbewerb:20261003:lernplattform — ÜBERGABE AN EINE BESTEHENDE LERNPLATTFORM (SCORM 1.2).
// ================================================================================================
//
// WAS GELIEFERT WIRD (technischer Lieferumfang, wörtlich auch in docs/lernplattform-scorm.md):
//   · Format:        SCORM 1.2 Content Package (PIF, eine ZIP-Datei) mit GENAU EINEM SCO.
//   · Standard:      ADL SCORM 1.2 — `<schema>ADL SCORM</schema><schemaversion>1.2</schemaversion>`.
//   · Referenz-LMS:  Moodle 4.5 LTS, Aktivität „SCORM-Paket" (mod_scorm). Andere LMS sind nicht
//                    zugesagt (Nichtziel: keine universelle Kompatibilitätszusage).
//   · Portabel:      das Paket lädt nur Dateien aus sich selbst (CSP `default-src 'self'`); kein
//                    Fremdserver, kein CDN, keine Schrift aus dem Netz, kein KI-Dienst.
//   · Rückkanal:     KEINER. Klarwerk liest aus der Lernplattform nichts zurück und behauptet
//                    deshalb auch keine Lernergebnisse.
//
// WOHER DER INHALT KOMMT: dieselbe Regel wie die Output Factory (service.ts) — nur VALIDIERTE und
// nicht vertrauliche Wissensobjekte, in der gewählten Reihenfolge. Die Gliederung je Lerneinheit
// folgt `renderTraining` (render.ts): Kernaussage, Kontext, Vorgehen, Lernziel — dazu der
// gesäuberte Fließtext samt Bildern und die Herkunft je Einheit.
//
// INHALTSFREIGABE UND EMPFÄNGERFREIGABE SIND ZWEI GETRENNTE PRÜFUNGEN. Die eine fragt, ob der
// INHALT hinaus darf (validiert, nicht vertraulich, keine Schutzdaten, keine eingeschränkte
// Fremdquelle, keine fremden oder fehlenden Medien). Die andere fragt, ob der EMPFÄNGER zugelassen
// ist (Betreiberliste `KLARWERK_LMS_EMPFAENGER`). Keine ersetzt die andere; jeder Befund nennt
// seinen Bereich.
//
// DIE EXPORTFASSUNG: `kennung` ist ein Fingerabdruck über Sprache, Titel, je Einheit Kennung,
// Fassung und gerendertem Inhalt sowie die Bytes jedes Mediums. Jede Änderung an der Quelle (neue
// KO-Fassung, anderes Bild) ergibt eine andere Kennung, einen anderen Manifest-Bezeichner und einen
// anderen Dateinamen. Gleicher Inhalt ergibt ein byte-gleiches Paket. Klarwerk legt Pakete nicht
// ab und überschreibt deshalb auch keine frühere Fassung: jeder Export ist ein weiterer
// (append-only) Auditeintrag mit Kennung, Objektfassungen und Paket-Prüfsumme; die
// Versions-Schnappschüsse der Wissensobjekte bleiben unberührt.
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { type KnowledgeObject, type KoService, isConfidential } from "../../knowledge-object";
import { sanitizeHtml } from "../../structure";
import {
  SCORM_BESCHRIFTUNG,
  SCORM_SPRACHEN,
  SCO_CSS,
  SCO_JS,
  type ScormBeschriftung,
  type ScormSprache,
} from "./scorm-laufzeit";

export const SCORM_FORMAT = {
  standard: "SCORM 1.2",
  schemaversion: "1.2",
  paketart: "SCORM 1.2 Content Package (PIF, ZIP) mit genau einem SCO",
  referenzLms: "Moodle 4.5 LTS — Aktivität „SCORM-Paket“ (mod_scorm)",
  netz: "keine Netzabhängigkeit: das Paket lädt nur eigene Dateien (CSP default-src 'self')",
  rueckkanal: "keiner — Klarwerk liest keine Lernergebnisse aus der Lernplattform zurück",
} as const;

export const MAX_SCORM_EINHEITEN = 50;

/** Feste Zeitmarke aller ZIP-Einträge: ohne sie wäre dasselbe Paket bei jedem Lauf byte-anders. */
const ZIP_DATUM = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));

const BILD_ENDUNG: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export type ScormBefundBereich = "inhalt" | "medien" | "quellen" | "empfaenger";

export type ScormBefundCode =
  // Inhaltsfreigabe
  | "NO_SOURCES"
  | "TOO_MANY_SOURCES"
  | "UNKNOWN_KO"
  | "NOT_VALIDATED"
  | "CONFIDENTIAL"
  | "SCHUTZDATEN"
  // Quellen
  | "SOURCE_RESTRICTED"
  // Medien
  | "MEDIA_MISSING"
  | "MEDIA_UNSUPPORTED"
  | "MEDIA_CONFIDENTIAL"
  | "MEDIA_FOREIGN"
  // Hinweise (nicht blockierend): was NICHT ins Paket geht, wird gesagt, nicht verschwiegen.
  | "ATTACHMENTS_NOT_INCLUDED"
  | "LINK_INTERNAL_REMOVED"
  | "EXTERNAL_LINK"
  // Empfängerfreigabe
  | "RECIPIENTS_NOT_CONFIGURED"
  | "RECIPIENT_NOT_ALLOWED";

export interface ScormBefund {
  code: ScormBefundCode;
  schwere: "blockiert" | "hinweis";
  bereich: ScormBefundBereich;
  koId?: string;
  /** Sachlicher Zusatz (Dateiname, Anzahl, Kennung) — nie ein Geheimnis, nie Medieninhalt. */
  detail: string;
}

export interface ScormEmpfaenger {
  id: string;
  label: string;
}

export interface ScormExportEingabe {
  koIds: readonly string[];
  sprache: ScormSprache;
  empfaenger: string;
  titel?: string;
}

export interface ScormFassungsObjekt {
  koId: string;
  titel: string;
  version: number;
  stand: string;
}

export interface ScormFassung {
  kennung: string;
  manifestId: string;
  titel: string;
  sprache: ScormSprache;
  objekte: ScormFassungsObjekt[];
  dateiname: string;
}

export interface ScormPruefung {
  exportierbar: boolean;
  format: typeof SCORM_FORMAT;
  empfaenger: ScormEmpfaenger[];
  befunde: ScormBefund[];
  /** Nur gesetzt, wenn der INHALT vollständig gelesen werden konnte. */
  fassung: ScormFassung | null;
}

export interface ScormPaket {
  pruefung: ScormPruefung;
  fassung: ScormFassung;
  daten: Buffer;
  sha256: string;
}

/** Was der Paketbau von einem gespeicherten Medium wissen muss — nicht mehr. */
export interface ScormMedium {
  mime: string;
  data: Uint8Array;
  confidentiality?: string;
}

export type ScormMedienLeser = (objectId: string) => Promise<ScormMedium | undefined>;

export class LmsExportError extends Error {
  readonly code: "BAD_REQUEST";
  constructor(message: string) {
    super(message);
    this.code = "BAD_REQUEST";
    this.name = "LmsExportError";
  }
}

// ------------------------------------------------------------------------------------------------
// Konfiguration und Eingabe
// ------------------------------------------------------------------------------------------------

const EMPFAENGER_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * `KLARWERK_LMS_EMPFAENGER` — die vom Betreiber zugelassenen Lernplattformen dieser Instanz,
 * `kennung=Bezeichnung` durch `;` getrennt (z. B. `moodle-schulung=Moodle Schulungsportal`).
 * Ungültige Teile fallen weg (im Zweifel KEIN Empfänger); fehlt der Wert, ist kein Export möglich.
 */
export function leseLmsEmpfaenger(raw: string | undefined): ScormEmpfaenger[] {
  const liste: ScormEmpfaenger[] = [];
  for (const teil of (raw ?? "").split(";")) {
    const [id = "", ...rest] = teil.split("=");
    const kennung = id.trim();
    const label = rest.join("=").trim();
    if (EMPFAENGER_ID.test(kennung) && !liste.some((e) => e.id === kennung)) {
      liste.push({ id: kennung, label: label || kennung });
    }
  }
  return liste;
}

/** Prüft den rohen Rumpf. Ein unlesbarer Rumpf ist 400 — keine Prüfung, kein Paket. */
export function leseScormEingabe(body: unknown): ScormExportEingabe {
  if (typeof body !== "object" || body === null) {
    throw new LmsExportError("Rumpf fehlt.");
  }
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.koIds) || !b.koIds.every((id) => typeof id === "string")) {
    throw new LmsExportError("koIds muss eine Liste von Kennungen sein.");
  }
  if (!SCORM_SPRACHEN.includes(b.sprache as ScormSprache)) {
    throw new LmsExportError("sprache muss de oder en sein.");
  }
  if (typeof b.empfaenger !== "string") {
    throw new LmsExportError("empfaenger fehlt.");
  }
  const eingabe: ScormExportEingabe = {
    koIds: b.koIds as string[],
    sprache: b.sprache as ScormSprache,
    empfaenger: b.empfaenger,
  };
  if (b.titel !== undefined) {
    if (typeof b.titel !== "string" || b.titel.length > 200) {
      throw new LmsExportError("titel muss Text bis 200 Zeichen sein.");
    }
    if (b.titel.trim()) {
      eingabe.titel = b.titel.trim();
    }
  }
  return eingabe;
}

// ------------------------------------------------------------------------------------------------
// Darstellung
// ------------------------------------------------------------------------------------------------

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sha256(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function fuelle(vorlage: string, werte: Record<string, string>): string {
  return vorlage.replace(/\{(\w+)\}/g, (_, k: string) => werte[k] ?? "");
}

function slug(text: string): string {
  const s = text
    .normalize("NFKD")
    // Nach NFKD stehen Akzente als eigene Kombinationszeichen da; sie fallen weg (ä → a).
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "lerninhalt";
}

function blockiert(
  code: ScormBefundCode,
  bereich: ScormBefundBereich,
  koId: string,
  detail: string,
): ScormBefund {
  return { code, schwere: "blockiert", bereich, koId, detail };
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag);
  return m?.[1];
}

interface Einheit {
  ko: KnowledgeObject;
  version: number;
  stand: string;
}

interface Medienbedarf {
  objectId: string;
  koId: string;
}

/** Bildquellen im gesäuberten Fließtext, die auf den Objektspeicher zeigen. */
function bildObjekte(html: string): string[] {
  const ids: string[] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = attr(m[0], "src") ?? "";
    const id = /^\/api\/objects\/([\w-]+)\/raw$/.exec(src)?.[1];
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Schreibt den gesäuberten Fließtext paketfähig um: Objektspeicher-Bilder zeigen auf die Datei im
 * Paket, interne Verweise verlieren ihr Ziel (sie führen ausserhalb von Klarwerk ins Leere), externe
 * Verweise öffnen nur auf Klick in einem neuen Fenster. Gezählt wird, was umgeschrieben wurde.
 */
function paketHtml(
  html: string,
  medienPfad: ReadonlyMap<string, string>,
): { html: string; intern: number; extern: number } {
  let intern = 0;
  let extern = 0;
  const mitBildern = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = attr(tag, "src") ?? "";
    const id = /^\/api\/objects\/([\w-]+)\/raw$/.exec(src)?.[1];
    if (id) {
      const pfad = medienPfad.get(id);
      return pfad ? tag.replace(`src="${src}"`, `src="${pfad}"`) : "";
    }
    return /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(src) ? tag : "";
  });
  const mitVerweisen = mitBildern.replace(/<a\b[^>]*>/gi, (tag) => {
    const href = attr(tag, "href");
    if (href === undefined) {
      return tag;
    }
    if (/^https?:\/\//i.test(href)) {
      extern += 1;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">`;
    }
    if (/^mailto:/i.test(href)) {
      return `<a href="${href}">`;
    }
    intern += 1;
    return "<a>";
  });
  return { html: mitVerweisen, intern, extern };
}

function einheitHtml(
  e: Einheit,
  i: number,
  inhalt: string,
  b: ScormBeschriftung,
  sprache: ScormSprache,
): string {
  const ko = e.ko;
  const teile = [
    `<section data-einheit="${i}" data-ko-id="${esc(ko.id)}" data-ko-version="${e.version}" lang="${sprache}" hidden>`,
    `<h2>${i + 1}. ${esc(ko.title)}</h2>`,
    `<p><strong>${esc(b.kernaussage)}:</strong> ${esc(ko.statement)}</p>`,
  ];
  if (ko.conditions.length > 0) {
    teile.push(
      `<h3>${esc(b.kontext)}</h3>`,
      `<ul>${ko.conditions.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`,
    );
  }
  if (ko.measures.length > 0) {
    teile.push(
      `<h3>${esc(b.vorgehen)}</h3>`,
      `<ol>${ko.measures.map((m) => `<li>${esc(m)}</li>`).join("")}</ol>`,
    );
  }
  if (inhalt) {
    teile.push(`<div class="kw-inhalt">${inhalt}</div>`);
  }
  teile.push(`<p><em>${esc(fuelle(b.lernziel, { kategorie: ko.category }))}</em></p>`);
  const quellen = ko.sources.map((s) => {
    const zusatz = [s.provider, s.sourceVersion !== undefined ? `v${s.sourceVersion}` : null]
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .join(" · ");
    const url =
      s.url && /^https?:\/\//i.test(s.url)
        ? ` — <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.url)}</a>`
        : "";
    return `<li>${esc(s.label)}${zusatz ? ` (${esc(zusatz)})` : ""}${url}</li>`;
  });
  teile.push(
    `<div class="kw-herkunft">`,
    `<p><strong>${esc(b.herkunft)}:</strong> ${esc(fuelle(b.fassung, { id: ko.id, v: String(e.version), stand: e.stand }))}</p>`,
    `<p><strong>${esc(b.quellen)}:</strong></p>`,
    quellen.length > 0 ? `<ul>${quellen.join("")}</ul>` : `<p>${esc(b.keineQuellen)}</p>`,
    "</div>",
    "</section>",
  );
  return teile.join("\n");
}

function indexHtml(
  titel: string,
  kennung: string,
  sprache: ScormSprache,
  einheiten: string[],
): string {
  const b = SCORM_BESCHRIFTUNG[sprache];
  const texte: Record<string, string> = {
    fortschritt: b.fortschritt,
    "kein-lms": b.keinLms,
    verbunden: b.verbunden,
    abgeschlossen: b.abgeschlossen,
    "abschluss-offen": b.abschlussOffen,
    "abschluss-fehler": b.abschlussFehler,
    "abschluss-ohne-lms": b.abschlussOhneLms,
    "abschluss-offline": b.abschlussOffline,
  };
  const daten = Object.entries(texte)
    .map(([k, v]) => ` data-text-${k}="${esc(v)}"`)
    .join("");
  return [
    "<!DOCTYPE html>",
    `<html lang="${sprache}">`,
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta name="klarwerk-exportfassung" content="${kennung}">`,
    `<title>${esc(titel)}</title>`,
    '<link rel="stylesheet" href="sco.css">',
    "</head>",
    `<body${daten}>`,
    `<header><h1>${esc(titel)}</h1><div class="kw-fortschritt" id="kw-fortschritt"></div></header>`,
    '<div class="kw-meldung" id="kw-meldung" role="status" aria-live="polite"></div>',
    "<main>",
    ...einheiten,
    "</main>",
    "<nav>",
    `<button type="button" id="kw-zurueck">${esc(b.zurueck)}</button>`,
    `<button type="button" id="kw-weiter">${esc(b.weiter)}</button>`,
    `<button type="button" id="kw-abschliessen" hidden>${esc(b.abschliessen)}</button>`,
    "</nav>",
    `<footer>${esc(fuelle(b.exportfassung, { kennung }))}</footer>`,
    '<script src="sco.js"></script>',
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function manifestXml(
  manifestId: string,
  kennung: string,
  titel: string,
  dateien: readonly string[],
): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<manifest identifier="${manifestId}" version="${kennung}" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">`,
    "  <metadata>",
    "    <schema>ADL SCORM</schema>",
    "    <schemaversion>1.2</schemaversion>",
    "  </metadata>",
    '  <organizations default="ORG-1">',
    '    <organization identifier="ORG-1">',
    `      <title>${esc(titel)}</title>`,
    '      <item identifier="ITEM-1" identifierref="RES-SCO" isvisible="true">',
    `        <title>${esc(titel)}</title>`,
    "      </item>",
    "    </organization>",
    "  </organizations>",
    "  <resources>",
    '    <resource identifier="RES-SCO" type="webcontent" adlcp:scormtype="sco" href="index.html">',
    ...dateien.map((d) => `      <file href="${esc(d)}"/>`),
    "    </resource>",
    "  </resources>",
    "</manifest>",
    "",
  ].join("\n");
}

// ------------------------------------------------------------------------------------------------
// Dienst
// ------------------------------------------------------------------------------------------------

export interface LmsExportServiceDeps {
  koService: Pick<KoService, "get">;
  medien: ScormMedienLeser;
  empfaenger: readonly ScormEmpfaenger[];
}

interface Vorbereitung {
  pruefung: ScormPruefung;
  dateien: Map<string, Uint8Array | string>;
}

export class LmsExportService {
  private readonly deps: LmsExportServiceDeps;

  constructor(deps: LmsExportServiceDeps) {
    this.deps = deps;
  }

  /** Prüfung vor dem Export: sagt, was blockiert und was nicht mitgeht — erzeugt kein Paket. */
  //
  // R-1175: `sichtbar` ist die EINE Sichtbarkeitsentscheidung des Betrachters (von der Route aus
  // `sichtbarkeitsfilterFuer`). Ein Objekt, das er nicht sehen darf, blockiert wie ein unbekanntes
  // (`UNKNOWN_KO`) — ohne Titel im Befund. Die Vertraulichkeitssperre bleibt daneben bestehen.
  async pruefe(
    eingabe: ScormExportEingabe,
    sichtbar: (ko: KnowledgeObject) => boolean = () => true,
  ): Promise<ScormPruefung> {
    return (await this.bereite(eingabe, sichtbar)).pruefung;
  }

  /** Paket erzeugen. Bei blockierenden Befunden kein Paket, sondern die Prüfung als Antwort. */
  async exportiere(
    eingabe: ScormExportEingabe,
    sichtbar: (ko: KnowledgeObject) => boolean = () => true,
  ): Promise<ScormPaket | { pruefung: ScormPruefung }> {
    const { pruefung, dateien } = await this.bereite(eingabe, sichtbar);
    if (!pruefung.exportierbar || !pruefung.fassung) {
      return { pruefung };
    }
    const zip = new JSZip();
    for (const [pfad, inhalt] of dateien) {
      zip.file(pfad, inhalt, { date: ZIP_DATUM, createFolders: false });
    }
    const daten = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
      platform: "DOS",
    });
    return { pruefung, fassung: pruefung.fassung, daten, sha256: sha256(daten) };
  }

  // Exportiert wird immer die AKTUELLE Fassung. Eine frühere Fassung erneut auszugeben ist bewusst
  // nicht Teil dieser Lieferung: ein Versions-Schnappschuss entsteht beim Schreiben, die Validierung
  // oft später — er belegt also nicht, dass genau diese Fassung je validiert war.
  private async lade(
    id: string,
    befunde: ScormBefund[],
    sichtbar: (ko: KnowledgeObject) => boolean,
  ): Promise<Einheit | null> {
    const aktuell = await this.deps.koService.get(id);
    if (!aktuell || !sichtbar(aktuell)) {
      befunde.push(blockiert("UNKNOWN_KO", "inhalt", id, id));
      return null;
    }
    if (isConfidential(aktuell.confidentiality)) {
      befunde.push(blockiert("CONFIDENTIAL", "inhalt", id, aktuell.title));
      return null;
    }
    const ko = aktuell;
    if (ko.status !== "validiert") {
      befunde.push({
        code: "NOT_VALIDATED",
        schwere: "blockiert",
        bereich: "inhalt",
        koId: id,
        detail: `${ko.title} · v${ko.version}`,
      });
      return null;
    }
    if (ko.schutzdatenQuarantaene) {
      befunde.push({
        code: "SCHUTZDATEN",
        schwere: "blockiert",
        bereich: "inhalt",
        koId: id,
        detail: ko.schutzdatenQuarantaene.arten.join(", "),
      });
      return null;
    }
    const stand = ko.history.find((h) => h.version === ko.version)?.at ?? ko.createdAt;
    return { ko, version: ko.version, stand };
  }

  private async bereite(
    eingabe: ScormExportEingabe,
    sichtbar: (ko: KnowledgeObject) => boolean,
  ): Promise<Vorbereitung> {
    const befunde: ScormBefund[] = [];
    const sprache = eingabe.sprache;
    const b = SCORM_BESCHRIFTUNG[sprache];

    // --- Empfängerfreigabe (unabhängig vom Inhalt) ---------------------------------------------
    const empfaenger = [...this.deps.empfaenger];
    if (empfaenger.length === 0) {
      befunde.push({
        code: "RECIPIENTS_NOT_CONFIGURED",
        schwere: "blockiert",
        bereich: "empfaenger",
        detail: "KLARWERK_LMS_EMPFAENGER",
      });
    } else if (!empfaenger.some((e) => e.id === eingabe.empfaenger)) {
      befunde.push({
        code: "RECIPIENT_NOT_ALLOWED",
        schwere: "blockiert",
        bereich: "empfaenger",
        detail: eingabe.empfaenger,
      });
    }

    // --- Inhaltsfreigabe -------------------------------------------------------------------------
    const ids = [...new Set(eingabe.koIds)];
    if (ids.length === 0) {
      befunde.push({ code: "NO_SOURCES", schwere: "blockiert", bereich: "inhalt", detail: "0" });
    }
    if (ids.length > MAX_SCORM_EINHEITEN) {
      befunde.push({
        code: "TOO_MANY_SOURCES",
        schwere: "blockiert",
        bereich: "inhalt",
        detail: `${ids.length} > ${MAX_SCORM_EINHEITEN}`,
      });
    }
    const einheiten: Einheit[] = [];
    let inhaltVollstaendig = ids.length > 0 && ids.length <= MAX_SCORM_EINHEITEN;
    if (inhaltVollstaendig) {
      for (const id of ids) {
        const e = await this.lade(id, befunde, sichtbar);
        if (e) {
          einheiten.push(e);
        } else {
          inhaltVollstaendig = false;
        }
      }
    }

    // --- Quellen ---------------------------------------------------------------------------------
    for (const e of einheiten) {
      for (const s of e.ko.sources) {
        const r = s.sourceRestrictions;
        if (r && (r.users.length > 0 || r.groups.length > 0)) {
          befunde.push({
            code: "SOURCE_RESTRICTED",
            schwere: "blockiert",
            bereich: "quellen",
            koId: e.ko.id,
            detail: s.label,
          });
        }
      }
    }

    // --- Medien ----------------------------------------------------------------------------------
    const gesaeubert = new Map<string, string>();
    const bedarf: Medienbedarf[] = [];
    for (const e of einheiten) {
      const html = e.ko.bodyHtml ? sanitizeHtml(e.ko.bodyHtml) : "";
      gesaeubert.set(e.ko.id, html);
      const bilder = bildObjekte(html);
      for (const objectId of bilder) {
        bedarf.push({ objectId, koId: e.ko.id });
      }
      const ohneBild = e.ko.attachments.filter((a) => !a.objectId || !bilder.includes(a.objectId));
      if (ohneBild.length > 0) {
        befunde.push({
          code: "ATTACHMENTS_NOT_INCLUDED",
          schwere: "hinweis",
          bereich: "medien",
          koId: e.ko.id,
          detail: ohneBild.map((a) => a.name).join(", "),
        });
      }
    }
    const medienPfad = new Map<string, string>();
    const medienDaten = new Map<string, Uint8Array>();
    for (const { objectId, koId } of bedarf) {
      if (medienPfad.has(objectId)) {
        continue;
      }
      const ko = einheiten.find((e) => e.ko.id === koId)?.ko;
      const anhang = ko?.attachments.find((a) => a.objectId === objectId);
      if (anhang?.quelle) {
        befunde.push({
          code: "MEDIA_FOREIGN",
          schwere: "blockiert",
          bereich: "medien",
          koId,
          detail: `${anhang.name} (${anhang.quelle.provider})`,
        });
        continue;
      }
      const medium = await this.deps.medien(objectId);
      const name = anhang?.name ?? objectId;
      if (!medium) {
        befunde.push(blockiert("MEDIA_MISSING", "medien", koId, name));
        continue;
      }
      if (isConfidential(medium.confidentiality as KnowledgeObject["confidentiality"])) {
        befunde.push(blockiert("MEDIA_CONFIDENTIAL", "medien", koId, name));
        continue;
      }
      const endung = BILD_ENDUNG[medium.mime.toLowerCase()];
      if (!endung) {
        befunde.push({
          code: "MEDIA_UNSUPPORTED",
          schwere: "blockiert",
          bereich: "medien",
          koId,
          detail: `${name} (${medium.mime})`,
        });
        continue;
      }
      const pfad = `medien/${sha256(medium.data).slice(0, 16)}.${endung}`;
      medienPfad.set(objectId, pfad);
      medienDaten.set(pfad, medium.data);
    }

    // --- Darstellung und Fassung -----------------------------------------------------------------
    const titel =
      eingabe.titel ??
      (einheiten[0]
        ? `${sprache === "de" ? "Schulungsunterlage" : "Training material"}: ${einheiten[0].ko.title}`
        : sprache === "de"
          ? "Schulungsunterlage"
          : "Training material");
    const abschnitte: string[] = [];
    einheiten.forEach((e, i) => {
      const umgeschrieben = paketHtml(gesaeubert.get(e.ko.id) ?? "", medienPfad);
      if (umgeschrieben.intern > 0) {
        befunde.push({
          code: "LINK_INTERNAL_REMOVED",
          schwere: "hinweis",
          bereich: "inhalt",
          koId: e.ko.id,
          detail: String(umgeschrieben.intern),
        });
      }
      if (umgeschrieben.extern > 0) {
        befunde.push({
          code: "EXTERNAL_LINK",
          schwere: "hinweis",
          bereich: "inhalt",
          koId: e.ko.id,
          detail: String(umgeschrieben.extern),
        });
      }
      abschnitte.push(einheitHtml(e, i, umgeschrieben.html, b, sprache));
    });

    const gesperrt = befunde.some((f) => f.schwere === "blockiert");
    const inhaltGesperrt = befunde.some(
      (f) => f.schwere === "blockiert" && f.bereich !== "empfaenger",
    );
    const dateien = new Map<string, Uint8Array | string>();
    let fassung: ScormFassung | null = null;

    if (inhaltVollstaendig && !inhaltGesperrt) {
      const kennung = sha256(
        JSON.stringify({
          format: SCORM_FORMAT.schemaversion,
          sprache,
          titel,
          einheiten: einheiten.map((e, i) => ({
            koId: e.ko.id,
            version: e.version,
            html: abschnitte[i],
          })),
          medien: [...medienDaten.keys()].sort(),
        }),
      ).slice(0, 16);
      const manifestId = `KLARWERK-SCORM12-${kennung}`;
      const objekte = einheiten.map((e) => ({
        koId: e.ko.id,
        titel: e.ko.title,
        version: e.version,
        stand: e.stand,
      }));
      fassung = {
        kennung,
        manifestId,
        titel,
        sprache,
        objekte,
        dateiname: `klarwerk-scorm12-${slug(titel)}-${kennung}.zip`,
      };
      const nachweis = {
        format: SCORM_FORMAT,
        exportfassung: kennung,
        manifestId,
        titel,
        sprache,
        empfaenger: eingabe.empfaenger,
        objekte: einheiten.map((e) => ({
          koId: e.ko.id,
          titel: e.ko.title,
          version: e.version,
          stand: e.stand,
          quellen: e.ko.sources.map((s) => ({
            label: s.label,
            url: s.url && /^https?:\/\//i.test(s.url) ? s.url : null,
            provider: s.provider ?? null,
            sourceVersion: s.sourceVersion ?? null,
          })),
        })),
        medien: [...medienDaten.entries()].map(([pfad, d]) => ({ pfad, sha256: sha256(d) })),
        nichtEnthalten: befunde.filter((f) => f.schwere === "hinweis"),
      };
      const sco = [
        "index.html",
        "sco.js",
        "sco.css",
        "klarwerk-export.json",
        ...[...medienDaten.keys()].sort(),
      ];
      const lmsTitel = `${titel} · ${kennung.slice(0, 8)}`;
      dateien.set("imsmanifest.xml", manifestXml(manifestId, kennung, lmsTitel, sco));
      dateien.set("index.html", indexHtml(titel, kennung, sprache, abschnitte));
      dateien.set("sco.js", SCO_JS);
      dateien.set("sco.css", SCO_CSS);
      dateien.set("klarwerk-export.json", `${JSON.stringify(nachweis, null, 2)}\n`);
      for (const pfad of [...medienDaten.keys()].sort()) {
        const d = medienDaten.get(pfad);
        if (d) {
          dateien.set(pfad, d);
        }
      }
    }

    return {
      pruefung: {
        exportierbar: !gesperrt && fassung !== null,
        format: SCORM_FORMAT,
        empfaenger,
        befunde,
        fassung,
      },
      dateien,
    };
  }
}
