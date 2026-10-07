// ================================================================================================
// BILDSCHIRMABLÄUFE (produkt:wettbewerb:20261003:bildschirmablaeufe) — DER ABLAUF AM ENTWURF.
// ================================================================================================
//
// Ein übernommener Bildschirmablauf ist eine GEORDNETE Liste von Schritten (Handlungstext, optional
// ein Bild) plus seine Herkunft. Er reist als `DraftPayload.ablauf` im Entwurf — additiv im JSONB,
// keine Migration — damit „Speichern" und „Neu laden" genau dieselben Schritte in derselben
// Reihenfolge zurückgeben. Der lesbare Rumpf (`bodyHtml`) wird von der Oberfläche aus denselben
// Schritten erzeugt und geht wie jeder andere Rumpf durch den Sanitizer; ins Wissensobjekt reist
// ausschliesslich dieser Rumpf (`toKoInput` zählt seine Felder einzeln auf, `ablauf` gehört nicht
// dazu).
//
// ZWEI STELLEN, wie bei den übrigen Strukturen des Entwurfs:
//   · `pruefeAblaufGestalt` am RAND (`validateDraftPayloadShape`): ein Ablauf, der nicht vollständig
//     und gültig ist, wird mit 400 und einem lesbaren Satz abgewiesen. KEIN stilles Kürzen und kein
//     stilles Weglassen einzelner Schritte — eine scheinbar vollständige Anleitung mit fehlenden
//     Schritten ist genau der Fehler, den der Auftrag ausschliesst.
//   · `normalizeAblauf` an der Persistenzgrenze (`normalizeDraftPayload`): übernimmt nur die
//     bekannten Felder und trimmt. Was hier ankommt, hat die Gestaltprüfung bestanden.
//
// GEGENSTÜCK: `apps/web/src/lib/ablaufImport.ts` führt dieselben Grenzen (`ABLAUF_GRENZEN`); der
// Webbuild kennt `services/` nicht. `tests/bildschirmablauf/grenzen-gleich.test.ts` vergleicht beide.

/** Mengen- und Längengrenzen eines Ablaufs am Entwurf. */
export const ABLAUF_GRENZEN = {
  /** Schritte je Ablauf. */
  schritte: 100,
  /** Zeichen je Handlungstext. */
  text: 2000,
  /** Zeichen je Bild (data-URL). */
  bild: 1_500_000,
  /**
   * Zeichen aller Bilder zusammen. Der Rumpf trägt dieselben Bilder ein zweites Mal; beides zusammen
   * bleibt so unter dem Deckel der Entwurfsrouten (5 MiB, `DRAFTS_BODY_LIMIT`).
   */
  bilderGesamt: 2_000_000,
  /** Zeichen für Werkzeug, Format, Anwendung. */
  kurztext: 200,
  /** Zeichen für den Dateinamen der Quelle. */
  datei: 300,
} as const;

/** `import` = außerhalb Klarwerks aufgezeichnet und als Datei übernommen. */
export type AblaufQuellenArt = "import";

export interface DraftAblaufQuelle {
  art: AblaufQuellenArt;
  /** Erkanntes Eingabeformat, z. B. `klarwerk-ablauf/1` oder `chrome-recorder`. */
  format: string;
  /** Das Werkzeug, mit dem außerhalb Klarwerks aufgezeichnet wurde (Angabe der Datei). */
  werkzeug: string;
  datei?: string;
  aufgezeichnetAm?: string;
  anwendung?: string;
  /**
   * Der Übernahmeschlüssel (aus Dateiinhalt und Konto abgeleitet, s. `apps/web/src/lib/ablaufImport.ts`).
   * Er bleibt am Entwurf, damit das Einreichen nach einem Neuladen denselben wiederholsicheren
   * Vorgang benutzt. Transportangabe, keine Autorität: der Server prüft Eigentümer und Abdruck selbst.
   */
  schluessel?: string;
}

export interface DraftAblaufSchritt {
  /** Stabile Kennung des Schritts innerhalb des Ablaufs. */
  id: string;
  text: string;
  /** Rasterbild als data-URL (png/jpeg/webp). Geschwärzte Bilder sind neu kodiert. */
  bild?: string;
}

export interface DraftAblauf {
  quelle: DraftAblaufQuelle;
  schritte: DraftAblaufSchritt[];
}

const SCHRITT_ID = /^[\w-]{1,64}$/;
// Dieselbe Zeichenmenge wie `OPERATION_ID_PATTERN` (knowledge-object), kürzer gedeckelt.
const SCHLUESSEL = /^[\w-]{8,100}$/;
// Dieselbe Rasterregel wie der Sanitizer (`isSafeImgSrc`): kein SVG, keine Fremdadresse.
const BILD = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}

function optionalerText(wert: unknown, max: number): boolean {
  return wert === undefined || (typeof wert === "string" && wert.length <= max);
}

/**
 * Gestaltprüfung am Rand. `undefined` heisst gültig; sonst ein Satz, der nach aussen darf.
 * `null` ist gültig: das ausdrückliche Leeren aus dem Merge-Vertrag (`mergeDraftPayload`).
 */
export function pruefeAblaufGestalt(wert: unknown): string | undefined {
  if (wert === undefined || wert === null) {
    return undefined;
  }
  if (!istObjekt(wert)) {
    return "draftPayload.ablauf muss ein Objekt sein.";
  }
  const quelle = wert.quelle;
  if (!istObjekt(quelle)) {
    return "draftPayload.ablauf.quelle fehlt — die Herkunft der Aufzeichnung ist Pflicht.";
  }
  if (quelle.art !== "import") {
    return "draftPayload.ablauf.quelle.art ist unbekannt.";
  }
  for (const feld of ["format", "werkzeug"] as const) {
    const v = quelle[feld];
    if (typeof v !== "string" || !v.trim() || v.length > ABLAUF_GRENZEN.kurztext) {
      return `draftPayload.ablauf.quelle.${feld} fehlt oder ist zu lang.`;
    }
  }
  if (
    !optionalerText(quelle.datei, ABLAUF_GRENZEN.datei) ||
    !optionalerText(quelle.aufgezeichnetAm, ABLAUF_GRENZEN.kurztext) ||
    !optionalerText(quelle.anwendung, ABLAUF_GRENZEN.kurztext)
  ) {
    return "draftPayload.ablauf.quelle enthält ein ungültiges Feld.";
  }
  if (
    quelle.schluessel !== undefined &&
    (typeof quelle.schluessel !== "string" || !SCHLUESSEL.test(quelle.schluessel))
  ) {
    return "draftPayload.ablauf.quelle.schluessel ist ungültig.";
  }
  const schritte = wert.schritte;
  if (!Array.isArray(schritte) || schritte.length === 0) {
    return "draftPayload.ablauf.schritte muss mindestens einen Schritt enthalten.";
  }
  if (schritte.length > ABLAUF_GRENZEN.schritte) {
    return `draftPayload.ablauf.schritte: höchstens ${ABLAUF_GRENZEN.schritte} Schritte.`;
  }
  const ids = new Set<string>();
  let bildzeichen = 0;
  for (const [i, schritt] of schritte.entries()) {
    const nr = i + 1;
    if (!istObjekt(schritt)) {
      return `Schritt ${nr} ist kein Objekt.`;
    }
    if (typeof schritt.id !== "string" || !SCHRITT_ID.test(schritt.id) || ids.has(schritt.id)) {
      return `Schritt ${nr} hat keine gültige, eindeutige Kennung.`;
    }
    ids.add(schritt.id);
    if (
      typeof schritt.text !== "string" ||
      !schritt.text.trim() ||
      schritt.text.length > ABLAUF_GRENZEN.text
    ) {
      return `Schritt ${nr} braucht einen Handlungstext (höchstens ${ABLAUF_GRENZEN.text} Zeichen).`;
    }
    if (schritt.bild !== undefined) {
      if (typeof schritt.bild !== "string" || !BILD.test(schritt.bild)) {
        return `Schritt ${nr}: das Bild ist kein unterstütztes Rasterbild (PNG, JPEG, WebP).`;
      }
      if (schritt.bild.length > ABLAUF_GRENZEN.bild) {
        return `Schritt ${nr}: das Bild ist zu groß.`;
      }
      bildzeichen += schritt.bild.length;
    }
  }
  if (bildzeichen > ABLAUF_GRENZEN.bilderGesamt) {
    return "Die Bilder des Ablaufs sind zusammen zu groß.";
  }
  return undefined;
}

/** Übernimmt nur bekannte Felder. Erwartet einen Wert, der `pruefeAblaufGestalt` bestanden hat. */
export function normalizeAblauf(wert: unknown): DraftAblauf | undefined {
  if (pruefeAblaufGestalt(wert) !== undefined || !istObjekt(wert)) {
    return undefined;
  }
  const q = wert.quelle as Record<string, unknown>;
  const quelle: DraftAblaufQuelle = {
    art: "import",
    format: String(q.format).trim(),
    werkzeug: String(q.werkzeug).trim(),
    ...(typeof q.datei === "string" && q.datei.trim() ? { datei: q.datei.trim() } : {}),
    ...(typeof q.aufgezeichnetAm === "string" && q.aufgezeichnetAm.trim()
      ? { aufgezeichnetAm: q.aufgezeichnetAm.trim() }
      : {}),
    ...(typeof q.anwendung === "string" && q.anwendung.trim()
      ? { anwendung: q.anwendung.trim() }
      : {}),
    ...(typeof q.schluessel === "string" ? { schluessel: q.schluessel } : {}),
  };
  const schritte = (wert.schritte as Record<string, unknown>[]).map((s) => ({
    id: String(s.id),
    text: String(s.text).trim(),
    ...(typeof s.bild === "string" ? { bild: s.bild } : {}),
  }));
  return { quelle, schritte };
}
