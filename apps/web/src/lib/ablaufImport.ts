// ================================================================================================
// BILDSCHIRMABLÄUFE (produkt:wettbewerb:20261003:bildschirmablaeufe) — IMPORT UND BEARBEITUNG.
// ================================================================================================
//
// Ein außerhalb Klarwerks bewusst aufgezeichneter Softwareablauf kommt als STRUKTURIERTE Datei an
// und wird hier in geordnete, einzeln bearbeitbare Schritte übersetzt. Zwei Eingabeformate:
//
//   · `klarwerk-ablauf/1` — das offene Austauschformat dieses Auftrags (Beschreibung:
//     `docs/aufnahme/bildschirmablauf-uebernahme.md`). Schritte mit Handlungstext und optionalem
//     Bildschirmfoto als data-URL, dazu Werkzeug, Zeitpunkt und Anwendung der Aufzeichnung.
//   · Chrome-DevTools-Recorder-Export (JSON) — der lokal und kostenlos vorhandene Rekorder in
//     Chrome/Edge. Er exportiert Schritte OHNE Bilder; die Handlungstexte werden aus Schritt-Typ und
//     Zugänglichkeitsname abgeleitet, Bilder lassen sich je Schritt bewusst hinzufügen.
//
// DOM-FREI und ohne Netz: alles hier läuft im Browser des Menschen. Es gibt keinen Aufruf eines
// KI-Dienstes, keinen Upload vor dem ausdrücklichen Speichern, und der Server sieht nur, was der
// Mensch danach als Entwurf speichert.
//
// Ein unvollständiger oder nicht unterstützter Import wird ABGELEHNT, nicht ausgedünnt: lieber ein
// verständlicher Fehler als eine scheinbar vollständige Anleitung mit fehlenden Schritten.

import type { Ablauf, AblaufSchritt } from "../api/types";
import { escapeCaptionText, insertImageSrcHtml, isSafeImgSrc } from "./richText";

/**
 * Dieselben Grenzen wie `services/capture/src/ablauf.ts` (`ABLAUF_GRENZEN`); der Webbuild kennt
 * `services/` nicht. `tests/bildschirmablauf/grenzen-gleich.test.ts` vergleicht beide.
 */
export const ABLAUF_GRENZEN = {
  schritte: 100,
  text: 2000,
  bild: 1_500_000,
  bilderGesamt: 2_000_000,
  kurztext: 200,
  datei: 300,
} as const;

/** Größte Importdatei. Bilder als data-URL sind ~4/3 ihrer Bytes; darüber hilft auch Schwärzen nicht. */
export const ABLAUF_DATEI_MAX_BYTES = 4 * 1024 * 1024;

export const FORMAT_KLARWERK = "klarwerk-ablauf/1";
export const FORMAT_CHROME = "chrome-recorder";

export type AblaufFehlerCode =
  | "datei_zu_gross"
  | "kein_json"
  | "format_unbekannt"
  | "werkzeug_fehlt"
  | "keine_schritte"
  | "zu_viele_schritte"
  | "schritt_ohne_text"
  | "schritt_zu_lang"
  | "bild_ungueltig"
  | "bild_zu_gross"
  | "bilder_zu_gross"
  | "schritttyp_unbekannt";

export interface AblaufFehler {
  code: AblaufFehlerCode;
  /** 1-basierte Schrittnummer, wo der Fehler einen Schritt betrifft. */
  schritt?: number;
  /** Zusatzangabe für die Meldung (z. B. der unbekannte Schritt-Typ). */
  detail?: string;
}

export type AblaufImportErgebnis =
  | { ok: true; ablauf: Ablauf; titel: string }
  | { ok: false; fehler: AblaufFehler };

/**
 * Formulierungen für Handlungstexte, die aus einem Recorder-Schritt ABGELEITET werden. Sie kommen
 * von der Oberfläche (übersetzt), damit ein abgeleiteter Text in der Sprache des Menschen steht.
 */
export interface AblaufFormulierung {
  oeffnen: (adresse: string) => string;
  klicken: (ziel: string) => string;
  eingeben: (wert: string, ziel: string) => string;
  taste: (taste: string) => string;
}

const RASTERBILD = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}

function text(wert: unknown): string {
  return typeof wert === "string" ? wert.trim() : "";
}

function kurz(wert: unknown, max: number): string | undefined {
  const t = text(wert);
  return t ? t.slice(0, max) : undefined;
}

/** Prüft fertige Schritte gegen die gemeinsamen Grenzen — dieselbe Regel wie am Server. */
export function pruefeSchritte(schritte: readonly AblaufSchritt[]): AblaufFehler | null {
  if (schritte.length === 0) {
    return { code: "keine_schritte" };
  }
  if (schritte.length > ABLAUF_GRENZEN.schritte) {
    return { code: "zu_viele_schritte", detail: String(ABLAUF_GRENZEN.schritte) };
  }
  let gesamt = 0;
  for (const [i, s] of schritte.entries()) {
    if (!s.text.trim()) {
      return { code: "schritt_ohne_text", schritt: i + 1 };
    }
    if (s.text.length > ABLAUF_GRENZEN.text) {
      return { code: "schritt_zu_lang", schritt: i + 1 };
    }
    if (s.bild !== undefined) {
      if (!RASTERBILD.test(s.bild) || !isSafeImgSrc(s.bild)) {
        return { code: "bild_ungueltig", schritt: i + 1 };
      }
      if (s.bild.length > ABLAUF_GRENZEN.bild) {
        return { code: "bild_zu_gross", schritt: i + 1 };
      }
      gesamt += s.bild.length;
    }
  }
  if (gesamt > ABLAUF_GRENZEN.bilderGesamt) {
    return { code: "bilder_zu_gross" };
  }
  return null;
}

function schrittId(i: number): string {
  return `s${i + 1}`;
}

function ausKlarwerkFormat(roh: Record<string, unknown>, dateiname: string): AblaufImportErgebnis {
  const werkzeug = kurz(roh.werkzeug, ABLAUF_GRENZEN.kurztext);
  if (!werkzeug) {
    return { ok: false, fehler: { code: "werkzeug_fehlt" } };
  }
  if (!Array.isArray(roh.schritte) || roh.schritte.length === 0) {
    return { ok: false, fehler: { code: "keine_schritte" } };
  }
  if (roh.schritte.length > ABLAUF_GRENZEN.schritte) {
    return {
      ok: false,
      fehler: { code: "zu_viele_schritte", detail: String(ABLAUF_GRENZEN.schritte) },
    };
  }
  const schritte: AblaufSchritt[] = [];
  for (const [i, eintrag] of roh.schritte.entries()) {
    if (!istObjekt(eintrag)) {
      return { ok: false, fehler: { code: "schritt_ohne_text", schritt: i + 1 } };
    }
    const handlung = text(eintrag.text);
    if (!handlung) {
      return { ok: false, fehler: { code: "schritt_ohne_text", schritt: i + 1 } };
    }
    const bild = eintrag.bild;
    if (bild !== undefined && bild !== null && typeof bild !== "string") {
      return { ok: false, fehler: { code: "bild_ungueltig", schritt: i + 1 } };
    }
    schritte.push({
      id: schrittId(i),
      text: handlung,
      ...(typeof bild === "string" && bild.trim() ? { bild: bild.trim() } : {}),
    });
  }
  const fehler = pruefeSchritte(schritte);
  if (fehler) {
    return { ok: false, fehler };
  }
  const aufgezeichnetAm = kurz(roh.aufgezeichnetAm, ABLAUF_GRENZEN.kurztext);
  const anwendung = kurz(roh.anwendung, ABLAUF_GRENZEN.kurztext);
  return {
    ok: true,
    titel: kurz(roh.titel, ABLAUF_GRENZEN.kurztext) ?? "",
    ablauf: {
      quelle: {
        art: "import",
        format: FORMAT_KLARWERK,
        werkzeug,
        ...(dateiname ? { datei: dateiname.slice(0, ABLAUF_GRENZEN.datei) } : {}),
        ...(aufgezeichnetAm ? { aufgezeichnetAm } : {}),
        ...(anwendung ? { anwendung } : {}),
      },
      schritte,
    },
  };
}

// Chrome-Recorder: Schritt-Typen ohne eigene Handlung des Menschen. Sie werden übergangen — sie
// beschreiben Fenstergröße, Wartebedingungen und das Loslassen einer Taste.
const RECORDER_TECHNISCH = new Set([
  "setViewport",
  "keyUp",
  "waitForElement",
  "waitForExpression",
  "scroll",
  "hover",
  "close",
]);

/** Der lesbarste Name eines Recorder-Ziels: `aria/…` vor `text/…` vor dem ersten Selektor. */
function zielname(selectors: unknown): string {
  const flach: string[] = [];
  if (Array.isArray(selectors)) {
    for (const s of selectors) {
      if (Array.isArray(s)) {
        for (const teil of s) {
          if (typeof teil === "string") {
            flach.push(teil);
          }
        }
      } else if (typeof s === "string") {
        flach.push(s);
      }
    }
  }
  const aria = flach.find((s) => s.startsWith("aria/"));
  if (aria) {
    return aria
      .slice(5)
      .replace(/\[role=".*"\]$/, "")
      .trim();
  }
  const textSel = flach.find((s) => s.startsWith("text/"));
  if (textSel) {
    return textSel.slice(5).trim();
  }
  return (flach[0] ?? "").slice(0, ABLAUF_GRENZEN.kurztext);
}

function ausChromeRecorder(
  roh: Record<string, unknown>,
  dateiname: string,
  formulierung: AblaufFormulierung,
): AblaufImportErgebnis {
  const steps = roh.steps as unknown[];
  const schritte: AblaufSchritt[] = [];
  for (const [i, step] of steps.entries()) {
    if (!istObjekt(step) || typeof step.type !== "string") {
      return { ok: false, fehler: { code: "schritttyp_unbekannt", schritt: i + 1 } };
    }
    const typ = step.type;
    if (RECORDER_TECHNISCH.has(typ)) {
      continue;
    }
    let handlung: string;
    if (typ === "navigate") {
      handlung = formulierung.oeffnen(text(step.url));
    } else if (typ === "click" || typ === "doubleClick") {
      handlung = formulierung.klicken(zielname(step.selectors));
    } else if (typ === "change") {
      handlung = formulierung.eingeben(text(step.value), zielname(step.selectors));
    } else if (typ === "keyDown") {
      handlung = formulierung.taste(text(step.key));
    } else {
      // Ein Schritt, den diese Übernahme nicht versteht, wird NICHT übergangen: die Anleitung
      // wäre sonst scheinbar vollständig und in Wahrheit lückenhaft.
      return {
        ok: false,
        fehler: { code: "schritttyp_unbekannt", schritt: i + 1, detail: typ.slice(0, 60) },
      };
    }
    schritte.push({
      id: schrittId(schritte.length),
      text: handlung.slice(0, ABLAUF_GRENZEN.text),
    });
  }
  const fehler = pruefeSchritte(schritte);
  if (fehler) {
    return { ok: false, fehler };
  }
  return {
    ok: true,
    titel: kurz(roh.title, ABLAUF_GRENZEN.kurztext) ?? "",
    ablauf: {
      quelle: {
        art: "import",
        format: FORMAT_CHROME,
        werkzeug: "Chrome DevTools Recorder",
        ...(dateiname ? { datei: dateiname.slice(0, ABLAUF_GRENZEN.datei) } : {}),
      },
      schritte,
    },
  };
}

/**
 * Übersetzt den Inhalt einer Importdatei in einen bearbeitbaren Ablauf — oder in einen benannten
 * Fehler. Erkennt das Format am Inhalt, nicht an der Dateiendung.
 */
export function leseAblaufDatei(
  inhalt: string,
  dateiname: string,
  formulierung: AblaufFormulierung,
): AblaufImportErgebnis {
  if (inhalt.length > ABLAUF_DATEI_MAX_BYTES) {
    return { ok: false, fehler: { code: "datei_zu_gross" } };
  }
  let roh: unknown;
  try {
    roh = JSON.parse(inhalt);
  } catch {
    return { ok: false, fehler: { code: "kein_json" } };
  }
  if (!istObjekt(roh)) {
    return { ok: false, fehler: { code: "format_unbekannt" } };
  }
  if (roh.format === FORMAT_KLARWERK) {
    return ausKlarwerkFormat(roh, dateiname);
  }
  if (Array.isArray(roh.steps) && typeof roh.title === "string") {
    return ausChromeRecorder(roh, dateiname, formulierung);
  }
  return {
    ok: false,
    fehler: {
      code: "format_unbekannt",
      ...(typeof roh.format === "string" ? { detail: roh.format.slice(0, 60) } : {}),
    },
  };
}

// ------------------------------------------------------------------------------------------------
// BEARBEITEN — reine Funktionen, jede liefert einen NEUEN Ablauf.
// ------------------------------------------------------------------------------------------------

function mitSchritten(ablauf: Ablauf, schritte: AblaufSchritt[]): Ablauf {
  return { ...ablauf, schritte };
}

export function schrittTextAendern(ablauf: Ablauf, id: string, neu: string): Ablauf {
  return mitSchritten(
    ablauf,
    ablauf.schritte.map((s) => (s.id === id ? { ...s, text: neu } : s)),
  );
}

/** Verschiebt einen Schritt um eine Stelle; am Rand bleibt alles, wie es ist. */
export function schrittVerschieben(ablauf: Ablauf, id: string, richtung: -1 | 1): Ablauf {
  const i = ablauf.schritte.findIndex((s) => s.id === id);
  const ziel = i + richtung;
  if (i < 0 || ziel < 0 || ziel >= ablauf.schritte.length) {
    return ablauf;
  }
  const neu = [...ablauf.schritte];
  const [schritt] = neu.splice(i, 1);
  neu.splice(ziel, 0, schritt as AblaufSchritt);
  return mitSchritten(ablauf, neu);
}

export function schrittEntfernen(ablauf: Ablauf, id: string): Ablauf {
  return mitSchritten(
    ablauf,
    ablauf.schritte.filter((s) => s.id !== id),
  );
}

/** Setzt oder entfernt (`undefined`) das Bild eines Schritts. Das alte Bild bleibt nirgends stehen. */
export function schrittBildSetzen(ablauf: Ablauf, id: string, bild: string | undefined): Ablauf {
  return mitSchritten(
    ablauf,
    ablauf.schritte.map((s) => {
      if (s.id !== id) {
        return s;
      }
      const { bild: _alt, ...ohne } = s;
      return bild === undefined ? ohne : { ...ohne, bild };
    }),
  );
}

/** Das Zeichen, das eine geschwärzte Angabe ersetzt. Feste Länge: sie verrät die Länge nicht. */
export const SCHWAERZUNG = "█████";

function regexAus(begriff: string): RegExp {
  return new RegExp(begriff.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
}

/** Ersetzt jedes Vorkommen eines Begriffs (ohne Rücksicht auf Groß-/Kleinschreibung). */
export function schwaerzeText(textWert: string, begriff: string): string {
  const b = begriff.trim();
  return b ? textWert.replace(regexAus(b), SCHWAERZUNG) : textWert;
}

/** Schwärzt einen Begriff in ALLEN Handlungstexten und zählt die Treffer. */
export function schwaerzeInSchritten(
  ablauf: Ablauf,
  begriff: string,
): { ablauf: Ablauf; treffer: number } {
  const b = begriff.trim();
  if (!b) {
    return { ablauf, treffer: 0 };
  }
  let treffer = 0;
  const schritte = ablauf.schritte.map((s) => {
    const n = s.text.match(regexAus(b))?.length ?? 0;
    treffer += n;
    return n > 0 ? { ...s, text: schwaerzeText(s.text, b) } : s;
  });
  return { ablauf: mitSchritten(ablauf, schritte), treffer };
}

// ------------------------------------------------------------------------------------------------
// DER LESBARE RUMPF — daraus wird beim Einreichen der Inhalt des Wissensobjekts.
// ------------------------------------------------------------------------------------------------

export interface RumpfTexte {
  /** Überschrift eines Schritts, z. B. „Schritt 3". */
  schritt: (nummer: number) => string;
  /** Der Herkunftssatz: außerhalb Klarwerks aufgezeichnet, mit welchem Werkzeug, aus welcher Datei. */
  herkunft: string;
  /** Der Hinweis, dass Beobachtung kein Beleg der fachlichen Richtigkeit ist. */
  hinweis: string;
}

/**
 * Erzeugt den Rumpf aus Herkunft und Schritten — flach, nur mit Tags des Sanitizers (h3, p, figure,
 * img, figcaption, em). Reihenfolge = Reihenfolge der Schritte.
 */
export function ablaufZuRumpf(ablauf: Ablauf, texte: RumpfTexte): string {
  const teile: string[] = [
    `<p><em>${escapeCaptionText(texte.herkunft)}</em></p>`,
    `<p><em>${escapeCaptionText(texte.hinweis)}</em></p>`,
  ];
  ablauf.schritte.forEach((s, i) => {
    const titel = texte.schritt(i + 1);
    teile.push(`<h3>${escapeCaptionText(titel)}</h3>`);
    teile.push(`<p>${escapeCaptionText(s.text)}</p>`);
    if (s.bild && isSafeImgSrc(s.bild)) {
      teile.push(
        `<figure>${insertImageSrcHtml(s.bild, titel)}<figcaption>${escapeCaptionText(titel)}</figcaption></figure>`,
      );
    }
  });
  return teile.join("");
}

// ------------------------------------------------------------------------------------------------
// DER VORGANGSSCHLÜSSEL — dieselbe Übernahme ergibt denselben Schlüssel.
// ------------------------------------------------------------------------------------------------

/**
 * Leitet aus Dateiinhalt und Konto einen stabilen Schlüssel ab. Er geht als `operationId` an die
 * vorhandenen wiederholsicheren Wege (`POST /api/drafts`, `POST /api/drafts/:id/promote`): dieselbe
 * Datei, vom selben Konto noch einmal übernommen, ergibt keinen zweiten Entwurf und kein zweites
 * Wissensobjekt. Das Konto gehört hinein, weil der Schlüssel eines Wissensobjekts DB-weit eindeutig
 * ist — zwei Menschen mit derselben Datei sollen sich nicht gegenseitig sperren.
 */
// Strukturell getippt: dieselbe Datei läuft im Browser und im Node-Typcheck ohne DOM-Bibliothek.
interface Hashquelle {
  TextEncoder: new () => { encode: (s: string) => Uint8Array };
  crypto: { subtle: { digest: (alg: string, daten: Uint8Array) => Promise<ArrayBuffer> } };
}

export async function uebernahmeSchluessel(inhalt: string, konto: string): Promise<string> {
  const umgebung = globalThis as unknown as Hashquelle;
  const daten = new umgebung.TextEncoder().encode(`${konto}\n${inhalt}`);
  const digest = await umgebung.crypto.subtle.digest("SHA-256", daten);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `ablauf-${hex.slice(0, 40)}`;
}

/** Der Schlüssel des Einreichens — getrennt vom Entwurfsschlüssel, aus demselben Ursprung. */
export function einreichSchluessel(uebernahme: string): string {
  return `${uebernahme}-ko`;
}
