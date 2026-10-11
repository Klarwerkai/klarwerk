// ================================================================================================
// BPA-02 · TECHNISCHE DATEN AUS WEBSEITEN NACHVOLLZIEHBAR IN WISSEN ÜBERNEHMEN.
// ================================================================================================
//
// DER WEG (Auftrag `produkt:20261011:assistenz-browser-wissenserfassung`, data_paths_interfaces):
//   Seiten-/Dateiadapter → Extraktion nach KI-Regel → geschützter Entwurf → bestehender Import-/
//   Validierungsdienst → Wissensobjekt mit Eigentümer.
//
// DIESES MODUL IST DIE EXTRAKTION — und sie ist REGELBASIERT. Kein Modell, kein Anbieter, keine
// Embeddings. Damit erfüllt sie jede Schutzstufe und auch „Keine KI" (G06), ohne dass eine
// Anbieterprüfung nötig wäre: es verlässt nichts den Server. Die Route
// (`routes/technische-daten-routes.ts`) legt das Ergebnis über den VORHANDENEN Entwurfsdienst ab —
// keine zweite Ablage, kein zweiter Wissensdienst (G03).
//
// WAS HIER NICHT GERATEN WIRD (failure_abort_resume): eine fehlende Einheit bleibt fehlend, ein
// Widerspruch bleibt ein Widerspruch. Beides wird eine benannte Klärung; der betroffene Wert ist
// `in_klaerung` und nie verbindlich.
//
// DIE QUELLE IST INHALT, KEIN AUFTRAG (G07): gelesen werden ausschliesslich Tabellenzellen, die
// der Adapter in der Sitzung des Menschen tatsächlich erfasst hat. Der Server ruft keine Adresse
// ab — eine bloss genannte URL verschafft keinen Zugriff (roles_rights).

import { createHash } from "node:crypto";

// ------------------------------------------------------------------------------------------------
// Eingang
// ------------------------------------------------------------------------------------------------

/** Herkunftsart des Belegs: die HTML-Seite selbst oder ein ausdrücklich gewähltes Datenblatt. */
export type BelegArt = "html" | "datenblatt";

/** Ein erfasster Tabellenabschnitt, so wie der Adapter ihn gelesen hat. */
export interface ErfassterAbschnitt {
  art: BelegArt;
  /** Absolute http(s)-Adresse der Seite bzw. des Datenblatts. */
  url: string;
  /** Genauer Abschnitt: Überschrift, Tabellenbeschriftung oder Elementkennung. Pflicht. */
  abschnitt: string;
  /** Optionaler Sprunganker (Elementkennung) für den direkten Rückweg zum Abschnitt. */
  anker?: string;
  titel?: string;
  /** Zeitpunkt der Erfassung durch den Adapter (ISO 8601 mit Zeitzone). */
  abgerufenAm: string;
  /** Vom Dokument selbst angegebener Stand (JJJJ-MM-TT), falls vorhanden. Nie geraten. */
  stand?: string;
  kopf: string[];
  zeilen: string[][];
}

export interface Ziel {
  /** Objekt/Modell, für das übernommen wird, z. B. „V-17". */
  objekt?: string;
  variante?: string;
}

export const GRENZEN = {
  belege: 5,
  zeilen: 200,
  spalten: 30,
  zelle: 500,
  abschnitt: 300,
  titel: 300,
  url: 2048,
} as const;

export type EingangsFehler =
  | "BELEG_FORM"
  | "BELEG_URL"
  | "QUELLABSCHNITT_FEHLT"
  | "BELEG_ZEIT"
  | "BELEG_UMFANG";

/** Prüft die Gestalt eines Belegs. Liefert den Fehlercode oder `null`. */
export function pruefeAbschnitt(roh: unknown): EingangsFehler | null {
  if (typeof roh !== "object" || roh === null) return "BELEG_FORM";
  const b = roh as Record<string, unknown>;
  if (b.art !== "html" && b.art !== "datenblatt") return "BELEG_FORM";
  if (typeof b.url !== "string" || b.url.length > GRENZEN.url) return "BELEG_URL";
  let adresse: URL;
  try {
    adresse = new URL(b.url);
  } catch {
    return "BELEG_URL";
  }
  if (adresse.protocol !== "https:" && adresse.protocol !== "http:") return "BELEG_URL";
  // AC03: ein Startseitenlink allein genügt nicht — ohne benannten Abschnitt keine Übernahme.
  if (
    typeof b.abschnitt !== "string" ||
    b.abschnitt.trim().length === 0 ||
    b.abschnitt.length > GRENZEN.abschnitt
  ) {
    return "QUELLABSCHNITT_FEHLT";
  }
  if (b.anker !== undefined && (typeof b.anker !== "string" || !/^[\w.:-]{1,128}$/.test(b.anker))) {
    return "BELEG_FORM";
  }
  if (b.titel !== undefined && (typeof b.titel !== "string" || b.titel.length > GRENZEN.titel)) {
    return "BELEG_FORM";
  }
  if (
    typeof b.abgerufenAm !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(b.abgerufenAm) ||
    Number.isNaN(Date.parse(b.abgerufenAm))
  ) {
    return "BELEG_ZEIT";
  }
  if (
    b.stand !== undefined &&
    (typeof b.stand !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.stand))
  ) {
    return "BELEG_FORM";
  }
  if (!Array.isArray(b.kopf) || !Array.isArray(b.zeilen)) return "BELEG_FORM";
  if (b.kopf.length === 0 || b.kopf.length > GRENZEN.spalten) return "BELEG_UMFANG";
  if (b.zeilen.length === 0 || b.zeilen.length > GRENZEN.zeilen) return "BELEG_UMFANG";
  const zelleOk = (z: unknown) => typeof z === "string" && z.length <= GRENZEN.zelle;
  if (!b.kopf.every(zelleOk)) return "BELEG_FORM";
  for (const zeile of b.zeilen) {
    if (!Array.isArray(zeile) || zeile.length > GRENZEN.spalten || !zeile.every(zelleOk)) {
      return "BELEG_FORM";
    }
  }
  return null;
}

// ------------------------------------------------------------------------------------------------
// Fassung
// ------------------------------------------------------------------------------------------------

/**
 * Die Fassung eines Belegs: SHA-256 über Adresse, Abschnitt und den erfassten Zelleninhalt.
 * Der Erfassungszeitpunkt gehört NICHT dazu — derselbe Inhalt zu anderer Zeit ist dieselbe Fassung.
 */
export function belegFassung(b: ErfassterAbschnitt): string {
  const kanonisch = JSON.stringify([b.url, b.abschnitt, b.kopf, b.zeilen]);
  return createHash("sha256").update(kanonisch, "utf8").digest("hex");
}

export interface ZellAenderung {
  zeile: number;
  spalte: string;
  vorher: string | null;
  jetzt: string | null;
}

/** Zellgenauer Unterschied zweier Fassungen desselben Abschnitts (AC08). */
export function fassungsUnterschied(
  vorher: ErfassterAbschnitt,
  jetzt: ErfassterAbschnitt,
): ZellAenderung[] {
  const aenderungen: ZellAenderung[] = [];
  const spalten = Math.max(vorher.kopf.length, jetzt.kopf.length);
  for (let s = 0; s < spalten; s++) {
    const a = vorher.kopf[s] ?? null;
    const b = jetzt.kopf[s] ?? null;
    if (a !== b) aenderungen.push({ zeile: 0, spalte: b ?? a ?? `#${s + 1}`, vorher: a, jetzt: b });
  }
  const zeilen = Math.max(vorher.zeilen.length, jetzt.zeilen.length);
  for (let z = 0; z < zeilen; z++) {
    for (let s = 0; s < spalten; s++) {
      const a = vorher.zeilen[z]?.[s] ?? null;
      const b = jetzt.zeilen[z]?.[s] ?? null;
      if (a !== b) {
        const name = jetzt.kopf[s] ?? vorher.kopf[s] ?? `#${s + 1}`;
        aenderungen.push({ zeile: z + 1, spalte: name, vorher: a, jetzt: b });
      }
    }
  }
  return aenderungen;
}

// ------------------------------------------------------------------------------------------------
// Einheiten und Normalisierung
// ------------------------------------------------------------------------------------------------

type Groesse = "druck" | "temperatur";

interface EinheitInfo {
  groesse: Groesse;
  kanon: string;
}

const EINHEITEN: Record<string, EinheitInfo> = {
  bar: { groesse: "druck", kanon: "bar" },
  mbar: { groesse: "druck", kanon: "mbar" },
  pa: { groesse: "druck", kanon: "Pa" },
  kpa: { groesse: "druck", kanon: "kPa" },
  mpa: { groesse: "druck", kanon: "MPa" },
  psi: { groesse: "druck", kanon: "psi" },
  "°c": { groesse: "temperatur", kanon: "°C" },
  degc: { groesse: "temperatur", kanon: "°C" },
  "°f": { groesse: "temperatur", kanon: "°F" },
  degf: { groesse: "temperatur", kanon: "°F" },
  k: { groesse: "temperatur", kanon: "K" },
};

/** Faktoren nach bar; die Formel nennt denselben Faktor, den die Rechnung benutzt. */
const DRUCK_NACH_BAR: Record<string, { faktor: number; text: string }> = {
  mbar: { faktor: 0.001, text: "0,001" },
  Pa: { faktor: 0.00001, text: "0,00001" },
  kPa: { faktor: 0.01, text: "0,01" },
  MPa: { faktor: 10, text: "10" },
  psi: { faktor: 0.0689476, text: "0,0689476" },
};

function einheitErkennen(roh: string): EinheitInfo | null {
  const schluessel = roh.replace(/\s+/g, "").replace("º", "°").toLowerCase();
  return EINHEITEN[schluessel] ?? null;
}

/** Zahl aus Originalschreibweise; akzeptiert Dezimalkomma und typografisches Minus. */
function zahl(text: string): number {
  return Number(text.replace("−", "-").replace("+", "").replace(",", "."));
}

/** Signifikante Stellen der Originalangabe — die Normalisierung wird nie genauer als sie. */
export function signifikanteStellen(text: string): number {
  const ziffern = text.replace(/[+\-−]/g, "").replace(/[.,]/g, "");
  const ohneFuehrend = ziffern.replace(/^0+/, "");
  return Math.max(1, ohneFuehrend.length);
}

function aufStellen(wert: number, stellen: number, komma: boolean): string {
  if (wert === 0) return "0";
  // toPrecision behält nachgestellte Nullen („16.0") und zeigt damit die tatsächliche Genauigkeit.
  // Nur eine Exponentialschreibweise wird in Dezimalschreibweise zurückgeführt.
  const genau = wert.toPrecision(stellen);
  const text = genau.includes("e") ? Number(genau).toString() : genau;
  return komma ? text.replace(".", ",") : text;
}

export interface Normalisierung {
  einheit: string;
  von?: string;
  bis?: string;
  wert?: string;
  toleranz?: string;
  formel: string;
  stellen: number;
}

interface Umrechnung {
  nach: (x: number) => number;
  delta: (x: number) => number;
  ziel: string;
  formel: string;
}

function umrechnen(einheit: string): Umrechnung | null {
  if (einheit in DRUCK_NACH_BAR) {
    const f = DRUCK_NACH_BAR[einheit] as { faktor: number; text: string };
    return {
      nach: (x) => x * f.faktor,
      delta: (x) => x * f.faktor,
      ziel: "bar",
      formel: `p[bar] = p[${einheit}] × ${f.text}`,
    };
  }
  if (einheit === "°F") {
    return {
      nach: (x) => ((x - 32) * 5) / 9,
      delta: (x) => (x * 5) / 9,
      ziel: "°C",
      formel: "t[°C] = (t[°F] − 32) × 5/9",
    };
  }
  if (einheit === "K") {
    return {
      nach: (x) => x - 273.15,
      delta: (x) => x,
      ziel: "°C",
      formel: "t[°C] = T[K] − 273,15",
    };
  }
  return null;
}

// ------------------------------------------------------------------------------------------------
// Zellen lesen
// ------------------------------------------------------------------------------------------------

const ZAHL = String.raw`[+\-−]?\d+(?:[.,]\d+)?`;
const BEREICH = new RegExp(
  String.raw`^(${ZAHL})\s*([^\d\s.…–—+\-−][^\d…–—]*?)?\s*(?:\.\.\.|…|–|—|\bbis\b|\bto\b|-)\s*(${ZAHL})\s*(.*)$`,
  "i",
);
const EINZEL = new RegExp(String.raw`^(${ZAHL})\s*(.*)$`);
const TOLERANZ = /±\s*(\d+(?:[.,]\d+)?)\s*([^\s,;()]*)/;
const NENN = /^(PN|DN)\s*(\d+)$/i;

interface Zellinhalt {
  art: "zahl" | "bereich" | "text";
  von?: string;
  bis?: string;
  wert?: string;
  einheit: string | null;
  toleranz: string | null;
  bedingungen: string[];
}

function leseZelle(original: string): Zellinhalt {
  let rest = original.trim();
  const bedingungen: string[] = [];
  // Klammerzusätze und „bei …/at …/@ …" sind Bedingungen, die zum Wert gehören (AC02).
  for (const klammer of rest.match(/\(([^)]+)\)/g) ?? []) {
    bedingungen.push(klammer.slice(1, -1).trim());
  }
  rest = rest.replace(/\([^)]*\)/g, " ").trim();
  const bei = rest.split(/\s+(?:bei|at|@)\s+/i);
  if (bei.length > 1) {
    rest = (bei[0] ?? "").trim();
    bedingungen.push(...bei.slice(1).map((b) => b.trim()));
  }
  let toleranz: string | null = null;
  // „16 ±0,5 bar": die Einheit steht nur hinter der Toleranz und gilt dann auch für den Wert.
  let toleranzEinheit: string | null = null;
  const tol = rest.match(TOLERANZ);
  if (tol) {
    toleranz = `±${tol[1]}${tol[2] ? ` ${tol[2]}` : ""}`;
    toleranzEinheit = tol[2] || null;
    rest = rest.replace(TOLERANZ, " ").trim();
  }
  const nenn = rest.match(NENN);
  if (nenn) {
    return {
      art: "zahl",
      wert: nenn[2] as string,
      einheit: (nenn[1] as string).toUpperCase(),
      toleranz,
      bedingungen,
    };
  }
  const bereich = rest.match(BEREICH);
  if (bereich) {
    const e1 = (bereich[2] ?? "").trim();
    const e2 = (bereich[4] ?? "").trim();
    return {
      art: "bereich",
      von: bereich[1] as string,
      bis: bereich[3] as string,
      einheit: e2 || e1 || toleranzEinheit,
      toleranz,
      bedingungen,
    };
  }
  const einzel = rest.match(EINZEL);
  if (einzel) {
    const e = (einzel[2] ?? "").trim();
    return {
      art: "zahl",
      wert: einzel[1] as string,
      einheit: e || toleranzEinheit,
      toleranz,
      bedingungen,
    };
  }
  return { art: "text", einheit: null, toleranz, bedingungen };
}

/** „Druck (bar)", „Druck [bar]", „Druck in bar" → Merkmal und Kopfeinheit. */
function leseKopf(kopf: string): { merkmal: string; einheit: string | null } {
  const t = kopf.trim();
  const klammer = t.match(/^(.*?)\s*[([]\s*([^)\]]+)\s*[)\]]\s*$/);
  if (klammer) {
    return { merkmal: (klammer[1] as string).trim(), einheit: (klammer[2] as string).trim() };
  }
  const inEinheit = t.match(/^(.*?)\s+in\s+(\S+)$/i);
  if (inEinheit && einheitErkennen(inEinheit[2] as string)) {
    return { merkmal: (inEinheit[1] as string).trim(), einheit: (inEinheit[2] as string).trim() };
  }
  return { merkmal: t, einheit: null };
}

const MODELL_KOPF = /^(modell|model|typ|type|artikel|bezeichnung|ventil|valve|gerät|geraet)\b/i;
const VARIANTE_KOPF = /^(variante|variant|ausführung|ausfuehrung|version)\b/i;
const BEDINGUNG_KOPF = /(bedingung|condition|medium|prüf|pruef)/i;
const MERKMAL_KOPF =
  /^(merkmal|eigenschaft|parameter|kenngröße|kenngroesse|property|technische daten)\b/i;
const WERT_KOPF = /^(wert|value|angabe)\b/i;

// ------------------------------------------------------------------------------------------------
// Extraktion
// ------------------------------------------------------------------------------------------------

export interface Herkunft {
  art: BelegArt;
  url: string;
  abschnitt: string;
  anker?: string;
  /** 1-basierte Datenzeile innerhalb des Abschnitts (Kopf = 0). */
  zeile: number;
  spalte: string;
  fassung: string;
  abgerufenAm: string;
  stand?: string;
}

export type WertStatus = "uebernehmbar" | "in_klaerung";

export interface TechnischerWert {
  modell: string;
  variante: string | null;
  merkmal: string;
  /** Zellinhalt zeichengleich, wie erfasst. */
  original: string;
  art: "zahl" | "bereich" | "text";
  von?: string;
  bis?: string;
  wert?: string;
  einheit: string | null;
  einheitHerkunft: "zelle" | "spaltenkopf" | null;
  toleranz: string | null;
  bedingungen: string[];
  normalisierung: Normalisierung | null;
  status: WertStatus;
  herkunft: Herkunft;
}

export type KlaerungArt =
  | "einheit_fehlt"
  | "einheit_widerspruch"
  | "widerspruch"
  | "modell_fehlt"
  | "ziel_nicht_gefunden"
  | "schutzklasse_unbekannt";

export interface Klaerung {
  art: KlaerungArt;
  text: string;
  betrifft: Herkunft[];
}

export interface Extraktion {
  fassung: string;
  beleg: Omit<ErfassterAbschnitt, "kopf" | "zeilen">;
  werte: TechnischerWert[];
  klaerungen: Klaerung[];
}

function kennung(text: string): string {
  return text.toLowerCase().replace(/[\s\-_/.]+/g, "");
}

export function geraeteSchluessel(w: Pick<TechnischerWert, "modell" | "variante">): string {
  return `${kennung(w.modell)}|${kennung(w.variante ?? "")}`;
}

export function wertSchluessel(
  w: Pick<TechnischerWert, "modell" | "variante" | "merkmal">,
): string {
  return `${geraeteSchluessel(w)}|${kennung(w.merkmal)}`;
}

function normalisiere(
  z: Zellinhalt,
  einheit: string | null,
  original: string,
): Normalisierung | null {
  if (!einheit) return null;
  const info = einheitErkennen(einheit);
  if (!info) return null;
  const weg = umrechnen(info.kanon);
  if (!weg) return null;
  const komma = original.includes(",");
  const teile = [z.von, z.bis, z.wert].filter((t): t is string => t !== undefined);
  const stellen = Math.min(...teile.map(signifikanteStellen));
  const n: Normalisierung = { einheit: weg.ziel, formel: weg.formel, stellen };
  if (z.von !== undefined) n.von = aufStellen(weg.nach(zahl(z.von)), stellen, komma);
  if (z.bis !== undefined) n.bis = aufStellen(weg.nach(zahl(z.bis)), stellen, komma);
  if (z.wert !== undefined) n.wert = aufStellen(weg.nach(zahl(z.wert)), stellen, komma);
  if (z.toleranz) {
    const t = z.toleranz.match(/\d+(?:[.,]\d+)?/);
    if (t) n.toleranz = `±${aufStellen(weg.delta(zahl(t[0])), signifikanteStellen(t[0]), komma)}`;
  }
  return n;
}

interface Zelle {
  modell: string;
  variante: string | null;
  merkmal: string;
  kopfEinheit: string | null;
  original: string;
  zeile: number;
  spalte: string;
  zeilenBedingungen: string[];
}

/** Die Tabelle in Zellen zerlegen — zeilen- oder spaltenorientiert, ohne zu mischen (AC01). */
function zellen(b: ErfassterAbschnitt, ziel: Ziel): Zelle[] {
  const kopf = b.kopf.map((k) => k.trim());
  const ergebnis: Zelle[] = [];
  const modellSpalte = kopf.findIndex((k) => MODELL_KOPF.test(k));
  const varianteSpalte = kopf.findIndex((k) => VARIANTE_KOPF.test(k));
  const bedingungsSpalten = kopf
    .map((k, i) => (BEDINGUNG_KOPF.test(k) && i !== modellSpalte ? i : -1))
    .filter((i) => i >= 0);

  if (modellSpalte >= 0) {
    // Zeilenorientiert: jede Zeile ist ein Gerät/eine Variante.
    b.zeilen.forEach((zeile, z) => {
      const modell = (zeile[modellSpalte] ?? "").trim();
      const variante = varianteSpalte >= 0 ? (zeile[varianteSpalte] ?? "").trim() || null : null;
      const zeilenBedingungen = bedingungsSpalten
        .map((i) => `${kopf[i]}: ${(zeile[i] ?? "").trim()}`)
        .filter((t) => !t.endsWith(": "));
      kopf.forEach((k, s) => {
        if (s === modellSpalte || s === varianteSpalte || bedingungsSpalten.includes(s)) return;
        const original = (zeile[s] ?? "").trim();
        if (!original) return;
        const { merkmal, einheit } = leseKopf(k);
        ergebnis.push({
          modell,
          variante,
          merkmal,
          kopfEinheit: einheit,
          original,
          zeile: z + 1,
          spalte: k,
          zeilenBedingungen,
        });
      });
    });
    return ergebnis;
  }

  if (MERKMAL_KOPF.test(kopf[0] ?? "") && kopf.length >= 2) {
    // Spaltenorientiert: erste Spalte Merkmal, jede weitere Spalte ein Gerät — oder bei genau
    // „Merkmal | Wert" das Zielobjekt des Auftrags.
    const einzeln = kopf.length === 2 && WERT_KOPF.test(kopf[1] ?? "");
    b.zeilen.forEach((zeile, z) => {
      const merkmalRoh = (zeile[0] ?? "").trim();
      if (!merkmalRoh) return;
      const { merkmal, einheit } = leseKopf(merkmalRoh);
      for (let s = 1; s < kopf.length; s++) {
        const original = (zeile[s] ?? "").trim();
        if (!original) continue;
        ergebnis.push({
          modell: einzeln ? (ziel.objekt ?? "").trim() : (kopf[s] as string),
          variante: einzeln ? ziel.variante?.trim() || null : null,
          merkmal,
          kopfEinheit: einheit,
          original,
          zeile: z + 1,
          spalte: kopf[s] as string,
          zeilenBedingungen: [],
        });
      }
    });
  }
  return ergebnis;
}

/** Zwei Angaben in derselben Grösse vergleichbar machen: Basiswerte, auf gemeinsame Genauigkeit. */
function vergleichswerte(w: TechnischerWert): { werte: number[]; stellen: number } | null {
  if (w.art === "text") return null;
  const einheit = w.einheit ? einheitErkennen(w.einheit) : null;
  const roh = [w.von, w.bis, w.wert].filter((t): t is string => t !== undefined);
  const stellen = Math.min(...roh.map(signifikanteStellen));
  if (!einheit) return { werte: roh.map(zahl), stellen };
  const weg = umrechnen(einheit.kanon);
  return { werte: roh.map((t) => (weg ? weg.nach(zahl(t)) : zahl(t))), stellen };
}

/** Gleich im Rahmen der Genauigkeit beider Originale — nie genauer als die ungenauere Angabe. */
export function gleicheAngabe(a: TechnischerWert, b: TechnischerWert): boolean {
  if (a.art !== b.art) return false;
  if (a.art === "text") return a.original.trim().toLowerCase() === b.original.trim().toLowerCase();
  const ea = a.einheit ? einheitErkennen(a.einheit) : null;
  const eb = b.einheit ? einheitErkennen(b.einheit) : null;
  if ((ea?.groesse ?? a.einheit) !== (eb?.groesse ?? b.einheit)) return false;
  if (!ea && a.einheit !== b.einheit) return false;
  const va = vergleichswerte(a);
  const vb = vergleichswerte(b);
  if (!va || !vb || va.werte.length !== vb.werte.length) return false;
  const stellen = Math.min(va.stellen, vb.stellen);
  const gerundet = (x: number) => Number(x.toPrecision(stellen));
  return va.werte.every((x, i) => gerundet(x) === gerundet(vb.werte[i] as number));
}

/** Regelbasierte Extraktion eines Belegs. Kein Modellaufruf. */
export function extrahiere(b: ErfassterAbschnitt, ziel: Ziel = {}): Extraktion {
  const fassung = belegFassung(b);
  const beleg: Extraktion["beleg"] = {
    art: b.art,
    url: b.url,
    abschnitt: b.abschnitt,
    abgerufenAm: b.abgerufenAm,
    ...(b.anker ? { anker: b.anker } : {}),
    ...(b.titel ? { titel: b.titel } : {}),
    ...(b.stand ? { stand: b.stand } : {}),
  };
  const herkunft = (zeile: number, spalte: string): Herkunft => ({
    art: b.art,
    url: b.url,
    abschnitt: b.abschnitt,
    ...(b.anker ? { anker: b.anker } : {}),
    zeile,
    spalte,
    fassung,
    abgerufenAm: b.abgerufenAm,
    ...(b.stand ? { stand: b.stand } : {}),
  });
  const klaerungen: Klaerung[] = [];
  const werte: TechnischerWert[] = [];

  for (const z of zellen(b, ziel)) {
    const inhalt = leseZelle(z.original);
    const h = herkunft(z.zeile, z.spalte);
    let status: WertStatus = "uebernehmbar";
    let einheit = inhalt.einheit;
    let einheitHerkunft: TechnischerWert["einheitHerkunft"] = inhalt.einheit ? "zelle" : null;
    if (!einheit && z.kopfEinheit) {
      einheit = z.kopfEinheit;
      einheitHerkunft = "spaltenkopf";
    }
    const kanon = (e: string) => einheitErkennen(e)?.kanon ?? e.trim();
    if (inhalt.einheit && z.kopfEinheit && kanon(inhalt.einheit) !== kanon(z.kopfEinheit)) {
      status = "in_klaerung";
      klaerungen.push({
        art: "einheit_widerspruch",
        text: `Zelle nennt „${inhalt.einheit}", der Spaltenkopf „${z.kopfEinheit}".`,
        betrifft: [h],
      });
    }
    if (inhalt.art !== "text" && !einheit) {
      status = "in_klaerung";
      klaerungen.push({
        art: "einheit_fehlt",
        text: `„${z.merkmal}" für ${z.modell || "unbekanntes Modell"}: Zahl ohne Einheit — Einheit bleibt unbekannt.`,
        betrifft: [h],
      });
    }
    if (!z.modell) {
      status = "in_klaerung";
      klaerungen.push({
        art: "modell_fehlt",
        text: `Zeile ${z.zeile}: kein Modell angegeben — keinem Gerät zugeordnet.`,
        betrifft: [h],
      });
    }
    werte.push({
      modell: z.modell,
      variante: z.variante,
      merkmal: z.merkmal,
      original: z.original,
      art: inhalt.art,
      ...(inhalt.von !== undefined ? { von: inhalt.von } : {}),
      ...(inhalt.bis !== undefined ? { bis: inhalt.bis } : {}),
      ...(inhalt.wert !== undefined ? { wert: inhalt.wert } : {}),
      einheit,
      einheitHerkunft,
      toleranz: inhalt.toleranz,
      bedingungen: [...inhalt.bedingungen, ...z.zeilenBedingungen],
      normalisierung: status === "uebernehmbar" ? normalisiere(inhalt, einheit, z.original) : null,
      status,
      herkunft: h,
    });
  }

  // Zielauswahl: nur das genannte Objekt/die genannte Variante — gleichartige Werte anderer Geräte
  // werden weder übernommen noch zusammengelegt (AC06).
  let gewaehlt = werte;
  if (ziel.objekt?.trim()) {
    const objekt = kennung(ziel.objekt);
    const variante = ziel.variante?.trim() ? kennung(ziel.variante) : null;
    const passt = (w: TechnischerWert) =>
      kennung(w.modell) === objekt && (variante === null || kennung(w.variante ?? "") === variante);
    gewaehlt = werte.filter(passt);
    if (gewaehlt.length === 0) {
      klaerungen.push({
        art: "ziel_nicht_gefunden",
        text: `Im Abschnitt „${b.abschnitt}" steht kein Eintrag für ${ziel.objekt}${ziel.variante ? ` / ${ziel.variante}` : ""}.`,
        betrifft: [],
      });
    }
  }

  // Widerspruch innerhalb desselben Abschnitts: dasselbe Gerät, dasselbe Merkmal, verschiedene
  // Angaben. Keine der beiden wird verbindlich (AC04). Gleiche Angaben zweimal → eine.
  const nachSchluessel = new Map<string, TechnischerWert[]>();
  for (const w of gewaehlt) {
    if (!w.modell) continue;
    const s = wertSchluessel(w);
    nachSchluessel.set(s, [...(nachSchluessel.get(s) ?? []), w]);
  }
  const doppelt = new Set<TechnischerWert>();
  for (const gruppe of nachSchluessel.values()) {
    if (gruppe.length < 2) continue;
    const erster = gruppe[0] as TechnischerWert;
    if (gruppe.every((w) => gleicheAngabe(w, erster))) {
      for (const w of gruppe.slice(1)) doppelt.add(w);
      continue;
    }
    for (const w of gruppe) {
      w.status = "in_klaerung";
      w.normalisierung = null;
    }
    klaerungen.push({
      art: "widerspruch",
      text: `${erster.modell}${erster.variante ? ` / ${erster.variante}` : ""} · ${erster.merkmal}: ${gruppe
        .map((w) => `„${w.original}" (Zeile ${w.herkunft.zeile})`)
        .join(" gegen ")}.`,
      betrifft: gruppe.map((w) => w.herkunft),
    });
  }

  const gewaehlteHerkunft = new Set(gewaehlt.map((w) => w.herkunft));
  return {
    fassung,
    beleg,
    werte: gewaehlt.filter((w) => !doppelt.has(w)),
    klaerungen: klaerungen.filter(
      (k) => k.betrifft.length === 0 || k.betrifft.some((h) => gewaehlteHerkunft.has(h)),
    ),
  };
}

// ------------------------------------------------------------------------------------------------
// Belege vergleichen (AC05)
// ------------------------------------------------------------------------------------------------

/**
 * DIE BENANNTEN GEWICHTE. Die Prozentzahl ist eine BELEGBEWERTUNG nach genau diesen drei
 * Kriterien — keine Wahrscheinlichkeit, dass der Wert stimmt (G19, desired_behavior).
 */
export const BEWERTUNG = [
  {
    kriterium: "Dokumentart",
    gewicht: 40,
    regel: "verlinktes Datenblatt 1, HTML-Seite 0,5",
  },
  {
    kriterium: "Angabenvollständigkeit",
    gewicht: 30,
    regel: "Einheit und Bedingung 1, nur Einheit 0,5, sonst 0",
  },
  {
    kriterium: "Quellenstand",
    gewicht: 30,
    regel: "jüngerer angegebener Stand 1, älterer 0, nicht angegeben 0,5",
  },
] as const;

export const BEWERTUNG_ERKLAERUNG =
  "Belegbewertung von 0 bis 100 % nach Dokumentart (40), Angabenvollständigkeit (30) und Quellenstand (30). Sie bewertet die Belege, nicht die Wahrscheinlichkeit, dass ein Wert richtig ist. Übernommen wird keiner der Werte, bevor ein Mensch entschieden hat.";

/** Unterhalb dieses Abstands wird keiner der Belege empfohlen. */
export const EMPFEHLUNG_MINDESTABSTAND = 10;

export interface Belegbewertung {
  herkunft: Herkunft;
  original: string;
  prozent: number;
  teile: { kriterium: string; gewicht: number; erfuellung: number }[];
}

export interface Abweichung {
  modell: string;
  variante: string | null;
  merkmal: string;
  belege: Belegbewertung[];
  /** Empfohlener Beleg (Index in `belege`) oder `null`, wenn der Abstand nicht trägt. */
  empfehlung: number | null;
  begruendung: string;
}

function bewerte(w: TechnischerWert, juengsterStand: string | null): Belegbewertung {
  const vollstaendig = w.einheit ? (w.bedingungen.length > 0 ? 1 : 0.5) : 0;
  const stand = w.herkunft.stand
    ? juengsterStand !== null && w.herkunft.stand === juengsterStand
      ? 1
      : 0
    : 0.5;
  const dokumentart = w.herkunft.art === "datenblatt" ? 1 : 0.5;
  const teile = [
    { kriterium: "Dokumentart", gewicht: 40, erfuellung: dokumentart },
    { kriterium: "Angabenvollständigkeit", gewicht: 30, erfuellung: vollstaendig },
    { kriterium: "Quellenstand", gewicht: 30, erfuellung: stand },
  ];
  return {
    herkunft: w.herkunft,
    original: w.original,
    prozent: Math.round(teile.reduce((s, t) => s + t.gewicht * t.erfuellung, 0)),
    teile,
  };
}

/**
 * Vergleicht die Extraktionen VERSCHIEDENER Belege. Beide Belege bleiben sichtbar; abweichende
 * Werte werden `in_klaerung` gesetzt und mit begründeter Empfehlung versehen.
 */
export function vergleicheBelege(extraktionen: Extraktion[]): Abweichung[] {
  const gruppen = new Map<string, TechnischerWert[]>();
  for (const e of extraktionen) {
    for (const w of e.werte) {
      if (!w.modell) continue;
      const s = wertSchluessel(w);
      gruppen.set(s, [...(gruppen.get(s) ?? []), w]);
    }
  }
  const abweichungen: Abweichung[] = [];
  for (const gruppe of gruppen.values()) {
    const fassungen = new Set(gruppe.map((w) => w.herkunft.fassung));
    if (fassungen.size < 2) continue;
    const erster = gruppe[0] as TechnischerWert;
    if (gruppe.every((w) => gleicheAngabe(w, erster))) continue;
    const staende = gruppe.map((w) => w.herkunft.stand).filter((s): s is string => !!s);
    const juengster = staende.length > 0 ? ([...staende].sort().at(-1) as string) : null;
    const belege = gruppe.map((w) => bewerte(w, juengster));
    for (const w of gruppe) {
      w.status = "in_klaerung";
    }
    const sortiert = belege.map((b, i) => ({ b, i })).sort((x, y) => y.b.prozent - x.b.prozent);
    const bester = sortiert[0] as { b: Belegbewertung; i: number };
    const zweiter = sortiert[1] as { b: Belegbewertung; i: number };
    const traegt = bester.b.prozent - zweiter.b.prozent >= EMPFEHLUNG_MINDESTABSTAND;
    const name = (b: Belegbewertung) =>
      `${b.herkunft.art === "datenblatt" ? "Datenblatt" : "HTML-Seite"} „${b.herkunft.abschnitt}"`;
    abweichungen.push({
      modell: erster.modell,
      variante: erster.variante,
      merkmal: erster.merkmal,
      belege,
      empfehlung: traegt ? bester.i : null,
      begruendung: traegt
        ? `Empfehlung: ${name(bester.b)} (${bester.b.prozent} %) vor ${name(zweiter.b)} (${zweiter.b.prozent} %). ${BEWERTUNG_ERKLAERUNG}`
        : `Keine Empfehlung: die Belegbewertungen liegen mit ${bester.b.prozent} % und ${zweiter.b.prozent} % zu nah beieinander. Fachliche Prüfung nötig. ${BEWERTUNG_ERKLAERUNG}`,
    });
  }
  return abweichungen;
}

// ------------------------------------------------------------------------------------------------
// Ergebnis für den Entwurf
// ------------------------------------------------------------------------------------------------

export interface Uebernahme {
  extraktionen: Extraktion[];
  abweichungen: Abweichung[];
  klaerungen: Klaerung[];
  /** Je Gerät (Modell + Variante) getrennt — gleiche Werte verschiedener Geräte bleiben getrennt. */
  geraete: { modell: string; variante: string | null; werte: TechnischerWert[] }[];
}

export function uebernahmeAufbauen(belege: ErfassterAbschnitt[], ziel: Ziel): Uebernahme {
  const extraktionen = belege.map((b) => extrahiere(b, ziel));
  const abweichungen = vergleicheBelege(extraktionen);
  const klaerungen = extraktionen.flatMap((e) => e.klaerungen);
  const geraete = new Map<string, Uebernahme["geraete"][number]>();
  for (const w of extraktionen.flatMap((e) => e.werte)) {
    const s = w.modell ? geraeteSchluessel(w) : "?";
    const g = geraete.get(s) ?? { modell: w.modell, variante: w.variante, werte: [] };
    g.werte.push(w);
    geraete.set(s, g);
  }
  return { extraktionen, abweichungen, klaerungen, geraete: [...geraete.values()] };
}

/**
 * Vorgangskennung der Übernahme: dieselben Belegfassungen für dasselbe Ziel ergeben dieselbe
 * Kennung — eine Wiederholung legt keinen zweiten Entwurf an (AC06, G12).
 */
export function uebernahmeKennung(belege: ErfassterAbschnitt[], ziel: Ziel): string {
  const fassungen = belege.map(belegFassung).sort();
  const roh = JSON.stringify([fassungen, kennung(ziel.objekt ?? ""), kennung(ziel.variante ?? "")]);
  return `technische-daten:${createHash("sha256").update(roh, "utf8").digest("hex")}`;
}

function esc(t: string): string {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function belegAdresse(h: Pick<Herkunft, "url" | "anker">): string {
  // Dieselbe Schreibweise, die die Entwurfsablage speichert (getrimmt, sonst unverändert).
  if (!h.anker) return h.url.trim();
  const u = new URL(h.url);
  u.hash = h.anker;
  return u.toString();
}

function herkunftText(h: Herkunft): string {
  return `${h.art === "datenblatt" ? "Datenblatt" : "HTML-Seite"} · ${h.abschnitt} · Zeile ${h.zeile}, Spalte „${h.spalte}" · Fassung ${h.fassung.slice(0, 12)} · erfasst ${h.abgerufenAm}`;
}

/** Der lesbare Entwurfsrumpf: Originalwerte, Normalisierung mit Formel, Herkunft je Wert. */
export function entwurfHtml(u: Uebernahme, schutzklasseUnbekannt: boolean): string {
  const teile: string[] = [];
  teile.push(
    "<p><strong>Stand:</strong> Ungeprüfter Entwurf. Nicht fachlich freigegeben und noch nicht ins Wissen übernommen.</p>",
  );
  teile.push(
    "<p><strong>Verarbeitung:</strong> Regelbasierte Tabellenauswertung in Klarwerk, ohne KI-Anbieter.</p>",
  );
  if (schutzklasseUnbekannt) {
    teile.push(
      "<p><strong>Schutzklasse unbekannt:</strong> vorläufig streng vertraulich und privat, bis die Klasse geklärt ist.</p>",
    );
  }
  for (const g of u.geraete) {
    const name = g.modell
      ? `${g.modell}${g.variante ? ` / ${g.variante}` : ""}`
      : "Ohne Modellangabe";
    teile.push(`<h3>${esc(name)}</h3>`);
    const zeilen = g.werte
      .map((w) => {
        const norm = w.normalisierung
          ? `${esc([w.normalisierung.von, w.normalisierung.bis].filter(Boolean).join(" … ") || (w.normalisierung.wert ?? ""))} ${esc(w.normalisierung.einheit)}${w.normalisierung.toleranz ? ` ${esc(w.normalisierung.toleranz)}` : ""} (${esc(w.normalisierung.formel)}; ${w.normalisierung.stellen} signifikante Stellen wie im Original)`
          : "—";
        return `<tr><td>${esc(w.merkmal)}</td><td>${esc(w.original)}</td><td>${esc(w.einheit ?? "unbekannt")}</td><td>${esc(w.toleranz ?? "—")}</td><td>${esc(w.bedingungen.join("; ") || "—")}</td><td>${norm}</td><td>${w.status === "uebernehmbar" ? "übernehmbar" : "in Klärung"}</td><td><a href="${esc(belegAdresse(w.herkunft))}">${esc(herkunftText(w.herkunft))}</a></td></tr>`;
      })
      .join("");
    teile.push(
      `<table><thead><tr><th>Merkmal</th><th>Original</th><th>Einheit</th><th>Toleranz</th><th>Bedingungen</th><th>Normalisiert</th><th>Status</th><th>Beleg</th></tr></thead><tbody>${zeilen}</tbody></table>`,
    );
  }
  if (u.abweichungen.length > 0) {
    teile.push("<h3>Abweichende Belege</h3>");
    const eintraege = u.abweichungen.map((a) => {
      const belege = a.belege
        .map(
          (b) =>
            `<li>„${esc(b.original)}" — ${esc(herkunftText(b.herkunft))} — Belegbewertung ${b.prozent} % (${b.teile.map((t) => `${esc(t.kriterium)} ${t.gewicht} × ${String(t.erfuellung).replace(".", ",")}`).join(", ")})</li>`,
        )
        .join("");
      return `<li>${esc(a.modell)}${a.variante ? ` / ${esc(a.variante)}` : ""} · ${esc(a.merkmal)}<ul>${belege}</ul><p>${esc(a.begruendung)}</p></li>`;
    });
    teile.push(`<ul>${eintraege.join("")}</ul>`);
  }
  if (u.klaerungen.length > 0 || schutzklasseUnbekannt) {
    teile.push("<h3>Offene Klärungen</h3>");
    const eintraege = u.klaerungen.map((k) => `<li>${esc(k.text)}</li>`);
    if (schutzklasseUnbekannt) {
      eintraege.push("<li>Schutzklasse des Inhalts ist nicht angegeben.</li>");
    }
    teile.push(`<ul>${eintraege.join("")}</ul>`);
  }
  return teile.join("");
}

/** Die Fassungsmarke im Quellenauszug — dieselbe Schreibweise liest der Quellenabgleich zurück. */
export function fassungsMarke(fassung: string): string {
  return `Fassung sha256:${fassung}`;
}

export function fassungAusAuszug(auszug: string | undefined): string | null {
  const m = auszug?.match(/Fassung sha256:([0-9a-f]{64})/);
  return m ? (m[1] as string) : null;
}
