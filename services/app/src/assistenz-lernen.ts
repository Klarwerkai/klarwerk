// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 — VORGEFÜHRTE ARBEIT LERNEN.
// ================================================================================================
//
// Der hostunabhängige Teil von BPA-06: Lernauftrag abgrenzen, Hostereignisse zweckgebunden und
// bereinigt als Lerntrace führen, zwei Vorführungen zu einer parametrisierten Lernnotiz verdichten,
// die Vorschau in einfacher Sprache erklären, die bestätigte persönliche Funktion von der bloßen
// Lernnotiz trennen und jeden Lauf vor der ersten Wirkung neu prüfen.
//
// WAS HIER BEWUSST NICHT STEHT (G03, „kein zweiter Kern"):
//   · KEINE Ablage. Lernnotiz, Funktion und Fassungen sind Werte; abgelegt werden sie im
//     persönlichen Funktions-/Routinenspeicher aus P06 (`produkt:20261011:peter-p06`).
//   · KEIN Zeitgeber. `Zeitplan` ist die Angabe, die die vorhandene Zeitsteuerung liest; ob
//     und wann ein Lauf fällig ist (Zeitzone, Sommerzeit, Nachholen), entscheidet sie.
//   · KEIN Hostzugriff. Ereignisse liefert ein Hostadapter (BPA-01 Chrome, BPA-04 Word/Finder);
//     ausgeführt wird über den vorhandenen Aktionskern. `planeLauf` sagt nur, WAS laufen darf.
//
// GRUNDSÄTZE:
//   · Lernen ist ein eigener Modus (G08). Ohne erkennbaren Lernauftrag, ohne freigegebene Anwendung
//     oder ohne abgegrenzten Vorgang beginnt nichts.
//   · Bereinigt wird VOR der Ablage im Trace (AC06): Kennwörter, Tokens, ausgeschlossene Felder und
//     Koordinaten erreichen den Trace nie. Ein Schritt ohne benanntes Ziel ist nicht erklärbar und
//     wird ein manueller Entscheidungspunkt — kein Klickmakro (AC07).
//   · Beispielwerte werden nicht wiederholt (AC02): was zwischen den Vorführungen wechselt, und
//     jeder Empfänger, wird Eingabe der Funktion — ohne Vorbelegung aus der Vorführung.
//   · Beobachten berechtigt nicht zum Ausführen (AC08). Folgenreiche Schritte brauchen je Lauf die
//     passende Bestätigung, auch wenn die Funktion sie erlaubt (AC09, G08).
//
// NACHARBEIT 1 (Bens Befunde zu Kandidat e458ce01):
//   · Fensterbilder kommen nie in den Trace, auch nicht mit Bildfreigabe (AC06).
//   · Funktion und Lauf sind an Mandant, Host, Anwendung, Zielobjekt und dessen Fassung gebunden;
//     die Rechte gelten objekt- und fassungsbezogen; `pruefeVorWirkung` vor jeder Wirkung (G04/G12).
//   · Eine geänderte Hostfassung ist selbst ein Entscheidungspunkt (AC07).
//   · Eine Außenbestätigung gilt nur für Funktion, Lauf und den Abdruck des gezeigten Inhalts (AC09).
import { createHash } from "node:crypto";

export type Wirkung =
  | "eingeben"
  | "speichern"
  | "senden"
  | "veroeffentlichen"
  | "loeschen"
  | "bestellen";

/** Wirkungen, die nie ohne passende Bestätigung des einzelnen Laufs geschehen. */
export const FOLGENREICH: readonly Wirkung[] = [
  "senden",
  "veroeffentlichen",
  "loeschen",
  "bestellen",
];

export type EreignisArt =
  | "oeffnen"
  | "eingabe"
  | "auswahl"
  | "klick"
  | "speichern"
  | "senden"
  | "veroeffentlichen"
  | "loeschen"
  | "bestellen";

const WIRKUNG_JE_ART: Record<EreignisArt, Wirkung> = {
  oeffnen: "eingeben",
  eingabe: "eingeben",
  auswahl: "eingeben",
  klick: "eingeben",
  speichern: "speichern",
  senden: "senden",
  veroeffentlichen: "veroeffentlichen",
  loeschen: "loeschen",
  bestellen: "bestellen",
};

/** G04: wem, wo und wann der Lernauftrag gehört. */
export interface Bindung {
  mandant: string;
  nutzer: string;
  sitzung: string;
  host: string;
  hostVersion: string;
  anwendung: string;
  fenster: string;
  objekt?: string;
  zeitpunkt: string;
}

export interface LernFreigabe {
  /** Gezielt freigegebene Anwendungen (G09). */
  anwendungen: readonly string[];
  /** Feldnamen, die nie in den Trace gelangen. */
  ausgeschlosseneFelder: readonly string[];
  /**
   * Gesonderte Bildfreigabe. Sie hebt keinen Feldausschluss auf; solange keine gesicherte
   * Schwärzung vorliegt, wird trotzdem kein Bild übernommen (`bereinige`).
   */
  fensterbild: boolean;
  /** Was ein Abbruch mit den bisherigen Vorführungen macht. */
  abbruchRegel: "rohdaten_verwerfen" | "abgeschlossene_behalten";
}

export interface Ziel {
  /** Zugänglichkeitsrolle des Bedienelements (Feld, Knopf, Menüpunkt …). */
  rolle: string;
  /** Zugänglichkeitsname — der Anker beim Wiederholen, nicht die Bildschirmposition. */
  name: string;
}

export interface HostEreignis {
  anwendung: string;
  fenster: string;
  art: EreignisArt;
  ziel?: Ziel;
  feld?: string;
  feldTyp?: string;
  wert?: string;
  koordinaten?: { x: number; y: number };
  bild?: string;
  zeitpunkt: string;
}

export interface TraceSchritt {
  art: EreignisArt;
  ziel?: Ziel;
  feld?: string;
  wert?: string;
  /** Der Wert ist absichtlich nicht im Trace. */
  ausgelassen?: "zugangsdaten" | "ausgeschlossen";
  /** Ohne benanntes Ziel nicht erklärbar → manueller Entscheidungspunkt. */
  unklar?: true;
  /**
   * Ein gemeldetes Fensterbild ist nicht übernommen. Es zeigt das ganze Fenster, also auch Felder,
   * die nicht Ziel dieses Ereignisses sind; eine Schwärzung aller geschützten Inhalte lässt sich hier
   * nicht gewährleisten (keine OCR/KI, G06). Darum bleibt das Bild draußen — auch mit Bildfreigabe.
   */
  bildAusgelassen?: "keine_gesicherte_schwaerzung";
}

export type LernStand = "laeuft" | "pausiert" | "beendet" | "abgebrochen";

export interface Lernauftrag {
  text: string;
  vorgang: string;
  anwendung: string;
  fenster: string;
}

export interface LernSitzung {
  id: string;
  auftrag: Lernauftrag;
  bindung: Bindung;
  freigabe: LernFreigabe;
  stand: LernStand;
  /** Abgeschlossene Vorführungen. */
  vorfuehrungen: TraceSchritt[][];
  /** Die laufende Vorführung. */
  aktuell: TraceSchritt[];
}

// ------------------------------------------------------------------------------------------------
// AC01 · Lernauftrag und Lernmodus.
// ------------------------------------------------------------------------------------------------

const LERNABSICHT = /\b(verfolge|beobachte|lerne?|schau\s+(mir\s+)?zu|merke?\s+dir)\b/i;
const VORGANG = /\b(?:diese[nsr]?|de[nm]|die|das|meine[nm]?|mein)\s+([A-ZÄÖÜ][\wäöüß-]*)/u;

export type LernAblehnung = "kein_lernauftrag" | "anwendung_nicht_freigegeben" | "vorgang_unklar";

export type LernBeginn =
  | { ok: true; sitzung: LernSitzung }
  | { ok: false; grund: LernAblehnung; text: string };

export function beginneLernen(
  id: string,
  text: string,
  bindung: Bindung,
  freigabe: LernFreigabe,
): LernBeginn {
  if (!LERNABSICHT.test(text)) {
    return {
      ok: false,
      grund: "kein_lernauftrag",
      text: "Das ist kein Lernauftrag. Beispiel: „Verfolge, wie ich diesen Bericht erstelle.“",
    };
  }
  const freigegeben = freigabe.anwendungen.some((a) => gleich(a, bindung.anwendung));
  if (!freigegeben) {
    return {
      ok: false,
      grund: "anwendung_nicht_freigegeben",
      text: `${bindung.anwendung} ist zum Lernen nicht freigegeben. Es wird nichts beobachtet.`,
    };
  }
  const vorgang = VORGANG.exec(text)?.[1] ?? bindung.objekt;
  if (!vorgang) {
    return {
      ok: false,
      grund: "vorgang_unklar",
      text: "Welchen Vorgang soll ich lernen? Nenne ihn oder öffne ihn zuerst.",
    };
  }
  return {
    ok: true,
    sitzung: {
      id,
      auftrag: { text, vorgang, anwendung: bindung.anwendung, fenster: bindung.fenster },
      bindung,
      freigabe,
      stand: "laeuft",
      vorfuehrungen: [],
      aktuell: [],
    },
  };
}

export type LernSteuerung =
  | "pause"
  | "fortsetzen"
  | "naechste_vorfuehrung"
  | "beenden"
  | "abbrechen";

export interface LernAnzeige {
  modus: "Lernen";
  zustand: string;
  /** Die erste Steuerung ist immer die sofortige Pause bzw. das Fortsetzen. */
  steuerung: readonly LernSteuerung[];
  mikrofon: false;
  /** Wird ein Fensterbild gespeichert? Derzeit nie. */
  fensterbild: false;
}

/** Was der Host sichtbar zeigen muss, solange gelernt wird (G10). */
export function lernAnzeige(s: LernSitzung): LernAnzeige {
  const was = `${s.auftrag.vorgang} in ${s.auftrag.anwendung}`;
  // Fensterbilder werden nie in den Trace übernommen (`bereinige`); die Anzeige sagt das so.
  const fensterbild = false;
  if (s.stand === "laeuft") {
    return {
      modus: "Lernen",
      zustand: `Lernt gerade: ${was} (Vorführung ${s.vorfuehrungen.length + 1})`,
      steuerung: ["pause", "naechste_vorfuehrung", "beenden", "abbrechen"],
      mikrofon: false,
      fensterbild,
    };
  }
  if (s.stand === "pausiert") {
    return {
      modus: "Lernen",
      zustand: `Lernen pausiert: ${was}. Es wird nichts beobachtet.`,
      steuerung: ["fortsetzen", "beenden", "abbrechen"],
      mikrofon: false,
      fensterbild,
    };
  }
  const ende = s.stand === "beendet" ? "beendet" : "abgebrochen";
  return {
    modus: "Lernen",
    zustand: `Lernen ${ende}: ${was}`,
    steuerung: [],
    mikrofon: false,
    fensterbild: false,
  };
}

export function pausiereLernen(s: LernSitzung): LernSitzung {
  return s.stand === "laeuft" ? { ...s, stand: "pausiert" } : s;
}

export function setzeLernenFort(s: LernSitzung): LernSitzung {
  return s.stand === "pausiert" ? { ...s, stand: "laeuft" } : s;
}

export function naechsteVorfuehrung(s: LernSitzung): LernSitzung {
  if (s.stand !== "laeuft" || s.aktuell.length === 0) {
    return s;
  }
  return { ...s, vorfuehrungen: [...s.vorfuehrungen, s.aktuell], aktuell: [] };
}

export function beendeLernen(s: LernSitzung): LernSitzung {
  if (s.stand !== "laeuft" && s.stand !== "pausiert") {
    return s;
  }
  const vorfuehrungen = s.aktuell.length > 0 ? [...s.vorfuehrungen, s.aktuell] : s.vorfuehrungen;
  return { ...s, stand: "beendet", vorfuehrungen, aktuell: [] };
}

/** Abbruch ist kein Beenden: die laufende Vorführung verfällt immer, der Rest nach Regel. */
export function brichLernenAb(s: LernSitzung): LernSitzung {
  const behalten = s.freigabe.abbruchRegel === "abgeschlossene_behalten";
  const vorfuehrungen = behalten ? s.vorfuehrungen : [];
  return { ...s, stand: "abgebrochen", vorfuehrungen, aktuell: [] };
}

// ------------------------------------------------------------------------------------------------
// AC06 / AC07 · Bereinigen vor der Ablage.
// ------------------------------------------------------------------------------------------------

const GEHEIME_FELDNAMEN: readonly RegExp[] = [
  /passw|kennwort|passcode|passphrase|zugangsdaten|credential/i,
  /\b(pin|tan|otp|2fa)\b/i,
  /token|secret|geheim|api[-_ ]?key|schl(ü|ue)ssel/i,
];

/** Werte, die nach Zugangsdaten aussehen, auch wenn das Feld harmlos heißt. */
export function siehtGeheimAus(wert: string): boolean {
  const w = wert.trim();
  if (
    /\b(?:passw(?:ort|ord)?|kennwort|passphrase|token|api[-_ ]?key|secret|pin|tan|otp)\s*[:=]\s*\S+/i.test(
      w,
    ) ||
    /\bbearer\s+\S+/i.test(w)
  ) {
    return true;
  }
  if (/^eyJ[\w-]+\.[\w-]+\.[\w-]*$/.test(w)) {
    return true;
  }
  if (/\b(sk|pk|ghp|gho|xoxb|xoxp|AKIA)[-_]?[A-Za-z0-9]{16,}/.test(w)) {
    return true;
  }
  // Lang, gemischt, ohne Leerzeichen und ohne Dateiendung: Schlüssel, nicht Dateiname.
  return (
    w.length >= 32 &&
    /^[\w+/=.-]+$/.test(w) &&
    /[0-9]/.test(w) &&
    /[a-z]/.test(w) &&
    /[A-Z]/.test(w) &&
    !/\.[a-z]{2,4}$/i.test(w)
  );
}

type Auslassung = "zugangsdaten" | "ausgeschlossen";

function auslassung(e: HostEreignis, freigabe: LernFreigabe): Auslassung | null {
  const namen = [e.feld, e.ziel?.name].filter((n): n is string => typeof n === "string");
  const ausgeschlossen = (n: string) => freigabe.ausgeschlosseneFelder.some((a) => gleich(a, n));
  if (namen.some(ausgeschlossen)) {
    return "ausgeschlossen";
  }
  const geheimerName = namen.some((n) => GEHEIME_FELDNAMEN.some((r) => r.test(n)));
  if (e.feldTyp?.toLowerCase() === "password" || geheimerName) {
    return "zugangsdaten";
  }
  if (typeof e.wert === "string" && siehtGeheimAus(e.wert)) {
    return "zugangsdaten";
  }
  return null;
}

/** Ein Hostereignis, wie es in den Trace darf. Koordinaten gelangen nie hinein. */
export function bereinige(e: HostEreignis, freigabe: LernFreigabe): TraceSchritt {
  const schritt: TraceSchritt = { art: e.art };
  if (e.ziel?.name.trim()) {
    schritt.ziel = { rolle: e.ziel.rolle, name: e.ziel.name.trim() };
  } else {
    // Nur Koordinaten: nicht erklärbar.
    schritt.unklar = true;
  }
  if (e.feld) {
    schritt.feld = e.feld;
  }
  const ausgelassen = auslassung(e, freigabe);
  if (ausgelassen) {
    schritt.ausgelassen = ausgelassen;
  } else if (typeof e.wert === "string") {
    schritt.wert = e.wert;
  }
  // Die Bildfreigabe hebt keinen Feldausschluss auf: ohne gesicherte Schwärzung kein Bild.
  if (e.bild) {
    schritt.bildAusgelassen = "keine_gesicherte_schwaerzung";
  }
  return schritt;
}

/** Nimmt ein Ereignis auf — nur im laufenden Lernmodus und nur aus dem abgegrenzten Fenster. */
export function nimmAuf(s: LernSitzung, e: HostEreignis): LernSitzung {
  if (s.stand !== "laeuft") {
    return s;
  }
  if (!gleich(e.anwendung, s.auftrag.anwendung) || e.fenster !== s.auftrag.fenster) {
    return s;
  }
  return { ...s, aktuell: [...s.aktuell, bereinige(e, s.freigabe)] };
}

// ------------------------------------------------------------------------------------------------
// AC02 / AC03 · Lernnotiz: parametrisieren, erklären, ändern.
// ------------------------------------------------------------------------------------------------

export type ParameterArt = "text" | "empfaenger" | "datum" | "zahl";

export interface FunktionsParameter {
  name: string;
  beschriftung: string;
  art: ParameterArt;
}

export type SchrittWert = { konstante: string } | { parameter: string };

export interface FunktionsSchritt {
  nr: number;
  art: EreignisArt | "entscheidung";
  ziel?: Ziel;
  feld?: string;
  wert?: SchrittWert;
  /** Bei `entscheidung`: was die Person selbst entscheidet. */
  frage?: string;
  wirkung?: Wirkung;
  /**
   * EQF-06-K03: nur bei einem Entscheidungspunkt, der entstand, weil der Schritt nicht in jeder
   * Vorführung vorkam — was dort beobachtet wurde, OHNE Wert (kein Beispielwert). Sagt die Person
   * „gehört immer dazu“, wird daraus wieder ein fester Schritt; ein Wert wird dann je Lauf erfragt.
   */
  vorlage?: SchrittVorlage;
}

export interface SchrittVorlage {
  art: EreignisArt;
  ziel?: Ziel;
  feld?: string;
  wirkung: Wirkung;
  /** Ob der beobachtete Schritt einen Wert hatte — er wird dann Eingabe, nie Festwert. */
  mitWert: boolean;
}

/** EQF-06-K03: wie eine Korrektur der Person gemeint ist. */
export type KorrekturBedeutung = "einmaligkeit" | "regel" | "entscheidungspunkt";

/** EQF-06-K03: die zugeordnete Quelle einer Korrektur — wer sie wann mit welchen Worten gab. */
export interface KorrekturQuelle {
  bedeutung: KorrekturBedeutung;
  /** Der Satz der Person (gekürzt, geprüft auf Zugangsdaten). */
  wortlaut: string;
  /** Wann die Korrektur kam (ISO 8601). */
  am: string;
  /** Der betroffene Schritt in Worten, wie er zum Zeitpunkt der Korrektur hieß. */
  schritt: string;
  /** Die Nummer des Schritts zum Zeitpunkt der Korrektur. */
  nr: number;
}

export interface FunktionsDefinition {
  name: string;
  zweck: string;
  ergebnis: string;
  anwendung: string;
  /** Die Hostfassung, an der gelernt wurde. */
  hostVersion: string;
  parameter: FunktionsParameter[];
  schritte: FunktionsSchritt[];
}

/** Die unbestätigte Lernnotiz. Sie startet nichts (AC04). */
export interface Lernnotiz {
  stand: "lernnotiz";
  eigentuemer: string;
  definition: FunktionsDefinition;
  herkunft: { sitzung: string; vorfuehrungen: number; bindung: Bindung };
  /** Bei Überarbeitung einer bestehenden Funktion: deren Fassung. */
  basisVersion?: number;
}

const EMPFAENGER = /^(an|cc|bcc|to|empf(ä|ae)nger(in)?|recipient|adressat)$/i;
const DATUM = /^\d{1,4}[-./]\d{1,2}[-./]\d{1,4}$/;
const ZAHL = /^-?[\d.,\s]+%?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Spalte = (TraceSchritt | null)[];

function schluessel(t: TraceSchritt): string {
  return [t.art, t.ziel?.rolle ?? "", t.ziel?.name ?? "", t.feld ?? ""].join("|");
}

/** Längste gemeinsame Teilfolge über die Schrittschlüssel; `null` = fehlt auf dieser Seite. */
function ausrichten(a: readonly string[], b: readonly string[]): [number | null, number | null][] {
  const n = a.length;
  const m = b.length;
  const l: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const wert = (i: number, j: number): number => l[i]?.[j] ?? 0;
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      const zeile = l[i] as number[];
      zeile[j] = a[i] === b[j] ? wert(i + 1, j + 1) + 1 : Math.max(wert(i + 1, j), wert(i, j + 1));
    }
  }
  const paare: [number | null, number | null][] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      paare.push([i, j]);
      i += 1;
      j += 1;
    } else if (j >= m || (i < n && wert(i + 1, j) >= wert(i, j + 1))) {
      paare.push([i, null]);
      i += 1;
    } else {
      paare.push([null, j]);
      j += 1;
    }
  }
  return paare;
}

function parameterArt(t: TraceSchritt, werte: readonly string[]): ParameterArt {
  const namen = [t.feld, t.ziel?.name].filter((n): n is string => typeof n === "string");
  const empfaengerFeld = namen.some((n) => EMPFAENGER.test(n.trim()));
  if (t.art === "senden" || empfaengerFeld || werte.some((w) => EMAIL.test(w.trim()))) {
    return "empfaenger";
  }
  if (werte.every((w) => DATUM.test(w.trim()))) {
    return "datum";
  }
  if (werte.every((w) => ZAHL.test(w.trim()))) {
    return "zahl";
  }
  return "text";
}

function parameterName(basis: string, vergeben: Set<string>): string {
  const umschrieben = basis
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
  const roh = umschrieben.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "eingabe";
  let name = roh;
  for (let k = 2; vergeben.has(name); k += 1) {
    name = `${roh}_${k}`;
  }
  vergeben.add(name);
  return name;
}

/** Richtet alle Vorführungen aneinander aus: je Position die Schritte aller Vorführungen. */
function spaltenAus(vorfuehrungen: readonly TraceSchritt[][]): Spalte[] {
  const [erste, ...weitere] = vorfuehrungen;
  let spalten: Spalte[] = (erste ?? []).map((t) => [t]);
  let breite = 1;
  for (const v of weitere) {
    const vertreter = spalten.map((sp) => schluessel(sp.find((t) => t !== null) as TraceSchritt));
    const neu: Spalte[] = [];
    for (const [i, j] of ausrichten(vertreter, v.map(schluessel))) {
      const alt = (i === null ? undefined : spalten[i]) ?? new Array<null>(breite).fill(null);
      const dazu = j === null ? null : v[j];
      neu.push([...alt, dazu ?? null]);
    }
    spalten = neu;
    breite += 1;
  }
  return spalten;
}

/**
 * Verdichtet die Vorführungen einer beendeten Sitzung zur Lernnotiz. Gleiche Schritte werden über
 * Art und benanntes Ziel ausgerichtet; was nur in einer Vorführung vorkommt, ist eine fachliche
 * Verzweigung und wird Entscheidungspunkt.
 */
export function entwerfeLernnotiz(s: LernSitzung): Lernnotiz | { fehler: string } {
  if (s.stand !== "beendet") {
    return { fehler: "Erst das Lernen beenden, dann entsteht die Vorschau." };
  }
  if ((s.vorfuehrungen[0] ?? []).length === 0) {
    return { fehler: "Es wurde nichts vorgeführt." };
  }
  const vergeben = new Set<string>();
  const parameter: FunktionsParameter[] = [];
  const schritte: FunktionsSchritt[] = [];
  const mehrere = s.vorfuehrungen.length >= 2;
  for (const spalte of spaltenAus(s.vorfuehrungen)) {
    const vorhanden = spalte.filter((t): t is TraceSchritt => t !== null);
    const t = vorhanden[0] as TraceSchritt;
    const nr = schritte.length + 1;
    const benennung = t.ziel?.name ?? t.feld ?? t.art;
    if (vorhanden.length < spalte.length) {
      const frage = `Nicht in jeder Vorführung: „${benennung}“. Du entscheidest, ob er nötig ist.`;
      const entscheidung: FunktionsSchritt = { nr, art: "entscheidung", frage };
      // EQF-06-K03: was beobachtet wurde, ohne Wert — nur für ein späteres „gehört immer dazu“.
      // Unklare Handlungen und geschützte Felder werden nie wieder zu einem festen Schritt.
      if (!vorhanden.some((v) => v.unklar || v.ausgelassen)) {
        const vorlage: SchrittVorlage = {
          art: t.art,
          wirkung: WIRKUNG_JE_ART[t.art],
          mitWert: vorhanden.some((v) => typeof v.wert === "string"),
        };
        if (t.ziel) {
          vorlage.ziel = t.ziel;
        }
        if (t.feld) {
          vorlage.feld = t.feld;
        }
        entscheidung.vorlage = vorlage;
      }
      schritte.push(entscheidung);
      continue;
    }
    if (vorhanden.some((v) => v.unklar)) {
      const frage = "Eine Handlung ohne erkennbares Ziel. Du führst sie selbst aus.";
      schritte.push({ nr, art: "entscheidung", frage });
      continue;
    }
    if (vorhanden.some((v) => v.ausgelassen)) {
      // Zugangsdaten werden nie Teil der Funktion: die Person gibt sie beim Lauf selbst ein.
      const frage = `„${benennung}“ ist ein geschütztes Feld. Du füllst es beim Lauf selbst aus.`;
      schritte.push({ nr, art: "entscheidung", frage });
      continue;
    }
    const schritt: FunktionsSchritt = { nr, art: t.art, wirkung: WIRKUNG_JE_ART[t.art] };
    if (t.ziel) {
      schritt.ziel = t.ziel;
    }
    if (t.feld) {
      schritt.feld = t.feld;
    }
    const werte = vorhanden.map((v) => v.wert).filter((w): w is string => typeof w === "string");
    if (werte.length > 0 && werte.length === vorhanden.length) {
      const art = parameterArt(t, werte);
      const verschieden = new Set(werte.map((w) => w.trim())).size > 1;
      if (!mehrere || verschieden || art === "empfaenger" || art === "datum") {
        const name = parameterName(benennung, vergeben);
        parameter.push({ name, beschriftung: benennung, art });
        schritt.wert = { parameter: name };
      } else {
        schritt.wert = { konstante: werte[0] as string };
      }
    }
    schritte.push(schritt);
  }
  const { vorgang, anwendung } = s.auftrag;
  return {
    stand: "lernnotiz",
    eigentuemer: s.bindung.nutzer,
    definition: {
      name: vorgang,
      zweck: `${vorgang} in ${anwendung} erstellen, wie vorgeführt.`,
      ergebnis: `Ein ${vorgang} in ${anwendung}.`,
      anwendung,
      hostVersion: s.bindung.hostVersion,
      parameter,
      schritte,
    },
    herkunft: { sitzung: s.id, vorfuehrungen: s.vorfuehrungen.length, bindung: s.bindung },
  };
}

export interface Vorschau {
  titel: string;
  abschnitte: { ueberschrift: string; zeilen: string[] }[];
}

function wertText(w: SchrittWert | undefined, d: FunktionsDefinition): string {
  if (!w) {
    return "";
  }
  if ("konstante" in w) {
    return ` mit „${w.konstante}“`;
  }
  const p = d.parameter.find((x) => x.name === w.parameter);
  return ` mit deiner Eingabe „${p?.beschriftung ?? w.parameter}“`;
}

function schrittText(s: FunktionsSchritt, d: FunktionsDefinition): string {
  const ziel = s.ziel ? `„${s.ziel.name}“` : "";
  switch (s.art) {
    case "entscheidung":
      return `Hier halte ich an. ${s.frage ?? "Du entscheidest selbst."}`;
    case "oeffnen":
      return `${ziel} öffnen`;
    case "eingabe":
      return `${ziel} ausfüllen${wertText(s.wert, d)}`;
    case "auswahl":
      return `In ${ziel} auswählen${wertText(s.wert, d)}`;
    case "klick":
      return `${ziel} wählen`;
    case "speichern":
      return `Speichern (${ziel || d.anwendung})`;
    default:
      return `${ziel || s.art}: ${s.art}, nur nach deiner Bestätigung in diesem Lauf`;
  }
}

function rechteText(d: FunktionsDefinition): string[] {
  const wirkungen = new Set(d.schritte.map((s) => s.wirkung));
  const rechte: string[] = [];
  if (wirkungen.has("eingeben") || wirkungen.has("speichern")) {
    const schreiben = `Schreiben in ${d.anwendung} — wird vor jedem Lauf neu geprüft.`;
    rechte.push(`${schreiben} Zuschauen allein genügt nicht.`);
  }
  for (const w of FOLGENREICH) {
    if (wirkungen.has(w)) {
      const wort = `${w[0]?.toUpperCase()}${w.slice(1)}`;
      rechte.push(`${wort}: nur mit deiner Bestätigung im jeweiligen Lauf.`);
    }
  }
  return rechte.length > 0 ? rechte : ["Keine Wirkung außer Anzeigen."];
}

function oderKeine(zeilen: string[]): string[] {
  return zeilen.length > 0 ? zeilen : ["Keine."];
}

/** AC03: einfache Sprache — Zweck, Eingaben, Schritte, Ergebnis, Rechte, Haltepunkte. */
export function vorschau(n: Lernnotiz | PersoenlicheFunktion): Vorschau {
  const d = n.definition;
  const stand =
    n.stand === "lernnotiz"
      ? "Lernnotiz — noch nicht bestätigt, läuft nie von selbst."
      : `Meine Funktion · Fassung ${n.version} · ${n.stand} · nur in ${n.bindung.objekt}`;
  const eingaben = d.parameter.map((p) =>
    p.art === "empfaenger"
      ? `${p.beschriftung} (Empfänger — wird nie aus der Vorführung übernommen)`
      : p.beschriftung,
  );
  const entscheidungen = d.schritte.filter((s) => s.art === "entscheidung");
  const halte = entscheidungen.map((s) => `Schritt ${s.nr}: ${s.frage ?? ""}`);
  const schritte = d.schritte.map((s) => `${s.nr}. ${schrittText(s, d)}`);
  return {
    titel: d.name,
    abschnitte: [
      { ueberschrift: "Stand", zeilen: [stand] },
      { ueberschrift: "Zweck", zeilen: [d.zweck] },
      { ueberschrift: "Deine Eingaben bei jedem Lauf", zeilen: oderKeine(eingaben) },
      { ueberschrift: "Schritte", zeilen: schritte },
      { ueberschrift: "Ergebnis", zeilen: [d.ergebnis] },
      { ueberschrift: "Rechte", zeilen: rechteText(d) },
      { ueberschrift: "Hier entscheidest du selbst", zeilen: oderKeine(halte) },
    ],
  };
}

export type Aenderung = (
  | { art: "name" | "zweck" | "ergebnis"; wert: string }
  | { art: "beschriftung"; parameter: string; wert: string }
  | { art: "schritt_entfernen"; nr: number }
  | { art: "als_entscheidung"; nr: number; frage: string }
  | { art: "als_eingabe"; nr: number; beschriftung: string }
  // EQF-06-K03: „gehört immer dazu“ — ein Entscheidungspunkt mit Vorlage wird fester Schritt.
  | { art: "als_regel"; nr: number }
  | { art: "hostfassung"; wert: string }
) & {
  /** EQF-06-K03: kam die Änderung aus einem Satz der Person, steht hier, woher. */
  quelle?: KorrekturQuelle;
};

function nummeriere(schritte: FunktionsSchritt[]): FunktionsSchritt[] {
  return schritte.map((s, i) => ({ ...s, nr: i + 1 }));
}

function ersetzeSchritt(
  schritte: readonly FunktionsSchritt[],
  nr: number,
  neu: (s: FunktionsSchritt) => FunktionsSchritt,
): FunktionsSchritt[] {
  return schritte.map((s) => (s.nr === nr ? neu(s) : s));
}

function genutzteParameter(schritte: readonly FunktionsSchritt[]): Set<string> {
  const namen = new Set<string>();
  for (const s of schritte) {
    if (s.wert && "parameter" in s.wert) {
      namen.add(s.wert.parameter);
    }
  }
  return namen;
}

/** AC03: Ändern vor der Aktivierung. Eine aktive Funktion wird über `ueberarbeite` geändert. */
export function aendere(n: Lernnotiz, a: Aenderung): Lernnotiz {
  const d = n.definition;
  let neu: FunktionsDefinition = d;
  switch (a.art) {
    case "name":
    case "zweck":
    case "ergebnis":
      neu = { ...d };
      neu[a.art] = a.wert.trim() || d[a.art];
      break;
    case "beschriftung": {
      const wert = a.wert.trim();
      const parameter = d.parameter.map((p) =>
        p.name === a.parameter && wert ? { ...p, beschriftung: wert } : p,
      );
      neu = { ...d, parameter };
      break;
    }
    case "schritt_entfernen": {
      const schritte = nummeriere(d.schritte.filter((s) => s.nr !== a.nr));
      const genutzt = genutzteParameter(schritte);
      neu = { ...d, schritte, parameter: d.parameter.filter((p) => genutzt.has(p.name)) };
      break;
    }
    case "als_entscheidung": {
      const entscheidung: FunktionsSchritt = { nr: a.nr, art: "entscheidung", frage: a.frage };
      neu = { ...d, schritte: ersetzeSchritt(d.schritte, a.nr, () => entscheidung) };
      break;
    }
    case "als_eingabe": {
      const ziel = d.schritte.find((s) => s.nr === a.nr);
      if (!ziel?.wert || !("konstante" in ziel.wert)) {
        break;
      }
      const name = parameterName(a.beschriftung, new Set(d.parameter.map((p) => p.name)));
      const wert: SchrittWert = { parameter: name };
      const schritte = ersetzeSchritt(d.schritte, a.nr, (s) => ({ ...s, wert }));
      const neuer: FunktionsParameter = { name, beschriftung: a.beschriftung, art: "text" };
      neu = { ...d, schritte, parameter: [...d.parameter, neuer] };
      break;
    }
    case "als_regel": {
      // EQF-06-K03: nur ein Entscheidungspunkt mit Vorlage wird wieder fester Schritt. Ein Wert
      // wird nie aus der einen Vorführung übernommen, sondern je Lauf erfragt (EQF-06-K04).
      const alt = d.schritte.find((s) => s.nr === a.nr);
      const v = alt?.art === "entscheidung" ? alt.vorlage : undefined;
      if (!v) {
        break;
      }
      const regel: FunktionsSchritt = { nr: a.nr, art: v.art, wirkung: v.wirkung };
      if (v.ziel) {
        regel.ziel = v.ziel;
      }
      if (v.feld) {
        regel.feld = v.feld;
      }
      let parameter = d.parameter;
      if (v.mitWert) {
        const beschriftung = v.ziel?.name ?? v.feld ?? v.art;
        const name = parameterName(beschriftung, new Set(d.parameter.map((p) => p.name)));
        const art: ParameterArt = v.art === "senden" ? "empfaenger" : "text";
        regel.wert = { parameter: name };
        parameter = [...d.parameter, { name, beschriftung, art }];
      }
      neu = { ...d, schritte: ersetzeSchritt(d.schritte, a.nr, () => regel), parameter };
      break;
    }
    case "hostfassung":
      // Nach einem Hostwechsel: die Person hat die Schritte an der neuen Fassung geprüft.
      neu = { ...d, hostVersion: a.wert.trim() || d.hostVersion };
      break;
  }
  return { ...n, definition: neu };
}

// ------------------------------------------------------------------------------------------------
// AC04 / AC05 / AC09 · Bestätigen, Zeitplan, Pausieren, Löschen.
// ------------------------------------------------------------------------------------------------

/**
 * Die Angabe für die VORHANDENE Zeitsteuerung. Fälligkeit, Sommerzeit und Nachholen rechnet sie,
 * nicht dieses Modul. Hier wird nur geprüft, dass nichts davon offen bleibt.
 */
export type Zeitplan =
  | { art: "sofort" }
  | { art: "ab_datum"; start: string; zeitzone: string }
  | {
      art: "woechentlich";
      wochentag: 1 | 2 | 3 | 4 | 5 | 6 | 7;
      uhrzeit: string;
      ab?: string;
      zeitzone: string;
      nachholen: "einmal_nachholen" | "auslassen";
    }
  // EQF-06-K05: bei einem Ereignis der EIGENEN Arbeit in Klarwerk (Katalog unten).
  | { art: "bei_ereignis"; ereignis: RoutinenEreignis };

/**
 * EQF-06-K05 — die Ereignisse, auf die eine Routine warten kann. Quelle ist das vorhandene
 * Prüfprotokoll; es zählen nur Einträge, die die Person SELBST ausgelöst hat (eigene Arbeit, keine
 * fremden Inhalte). Die Zeitsteuerung prüft sie in ihrem Takt — kein zweiter Scheduler.
 */
export const ROUTINEN_EREIGNISSE = {
  wissen_angelegt: {
    aktion: "ko.created",
    text: "Wenn du ein Wissensobjekt anlegst",
    muster: /\b(an(ge)?leg|neu(es|en)?\b|erstell)/i,
  },
  wissen_ueberarbeitet: {
    aktion: "ko.revised",
    text: "Wenn du ein Wissensobjekt überarbeitest",
    muster: /(überarbeit|ueberarbeit|änder|aender|neue fassung|aktualisier)/i,
  },
} as const;
export type RoutinenEreignis = keyof typeof ROUTINEN_EREIGNISSE;

export function istRoutinenEreignis(wert: unknown): wert is RoutinenEreignis {
  return typeof wert === "string" && Object.hasOwn(ROUTINEN_EREIGNISSE, wert);
}

/**
 * EQF-06-K05: welches Ereignis die Worte der Person meinen — nur wenn GENAU eines passt. Sonst
 * `null`: dann wird gezielt mit dem Katalog nachgefragt, nicht geraten.
 */
export function ereignisAusText(text: string): RoutinenEreignis | null {
  // Ohne genanntes Objekt (Wissensobjekt, Artikel) ist die Quelle unklar — etwa „wenn ich einen
  // Bericht erstelle“: das wird nachgefragt.
  if (!/(wissen|artikel)/i.test(text)) {
    return null;
  }
  const treffer = (Object.keys(ROUTINEN_EREIGNISSE) as RoutinenEreignis[]).filter((e) =>
    ROUTINEN_EREIGNISSE[e].muster.test(text),
  );
  return treffer.length === 1 ? (treffer[0] ?? null) : null;
}

export function pruefeZeitplan(z: Zeitplan): string | undefined {
  if (z.art === "sofort") {
    return undefined;
  }
  if (z.art === "bei_ereignis") {
    return istRoutinenEreignis(z.ereignis) ? undefined : "Unbekanntes Ereignis.";
  }
  try {
    new Intl.DateTimeFormat("de-DE", { timeZone: z.zeitzone });
  } catch {
    return `Unbekannte Zeitzone „${z.zeitzone}“.`;
  }
  if (z.art === "ab_datum") {
    const gueltig = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(z.start);
    return gueltig ? undefined : "Startzeit als JJJJ-MM-TTThh:mm (Ortszeit) angeben.";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(z.uhrzeit)) {
    return "Uhrzeit als hh:mm angeben.";
  }
  if (z.ab !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(z.ab)) {
    return "Startdatum als JJJJ-MM-TT angeben.";
  }
  return undefined;
}

export interface Fassung {
  version: number;
  definition: FunktionsDefinition;
  erlaubteWirkungen: Wirkung[];
  bestaetigtVon: string;
  bestaetigtAm: string;
}

/** G04: woran eine bestätigte Funktion gebunden ist. Ein Lauf woanders ist kein Lauf von ihr. */
export interface ZielBindung {
  mandant: string;
  host: string;
  anwendung: string;
  /** Das bestätigte Zielobjekt (Dokument, Vorlage oder Ordner) — nicht nur der Anwendungsname. */
  objekt: string;
}

export interface PersoenlicheFunktion {
  id: string;
  eigentuemer: string;
  bindung: ZielBindung;
  stand: "aktiv" | "pausiert" | "geloescht";
  version: number;
  definition: FunktionsDefinition;
  erlaubteWirkungen: Wirkung[];
  zeitplan: Zeitplan | null;
  fassungen: Fassung[];
  /** Kennungen echter Ergebnisse. Sie gehören nicht der Funktion und bleiben beim Löschen. */
  ergebnisse: string[];
  /** EQF-06-K06: wie die Person die Arbeit übergeben hat. Fehlt: `selbststaendig`. */
  ausfuehrung?: Ausfuehrungsmodus;
}

/**
 * EQF-06-K06 — die drei Übergabearten einer bestätigten Funktion, unterschieden im Aktionskern:
 *   · `selbststaendig`: die Assistenz führt jeden Planschritt ohne weitere Rückfrage aus.
 *   · `zur_pruefung`: dazu ein zweiter Planschritt „Ergebnis zur Prüfung öffnen“; der Auftrag ist
 *     erst abgeschlossen, wenn die Person das Ergebnis geöffnet hat.
 *   · `schrittweise`: dieselben zwei Planschritte, keiner läuft ohne den Klick der Person; kein
 *     Zeitplan und kein Hostlauf in einem Zug.
 * Fachliche Regeln (Anlagerecht, Pause, Fassung, Halt an Außenwirkung) gelten in jeder Art.
 */
export const AUSFUEHRUNGSMODI = ["selbststaendig", "zur_pruefung", "schrittweise"] as const;
export type Ausfuehrungsmodus = (typeof AUSFUEHRUNGSMODI)[number];

export interface Bestaetigung {
  person: string;
  am: string;
  erlaubteWirkungen: Wirkung[];
  zeitplan: Zeitplan | null;
  /** Das bestätigte Zielobjekt. Ohne Angabe: das der bisherigen Fassung bzw. der Vorführung. */
  objekt?: string;
}

/** AC04: Erst die ausdrückliche Bestätigung der Eigentümerin macht die Lernnotiz zur Funktion. */
export function bestaetige(
  id: string,
  n: Lernnotiz,
  b: Bestaetigung,
  bisher?: PersoenlicheFunktion,
): PersoenlicheFunktion | { fehler: string } {
  if (b.person !== n.eigentuemer) {
    return { fehler: "Nur die Person, die vorgeführt hat, kann ihre Funktion bestätigen." };
  }
  if (n.definition.schritte.length === 0) {
    return { fehler: "Die Funktion hat keine Schritte." };
  }
  if (b.erlaubteWirkungen.length === 0) {
    return { fehler: "Lege fest, was die Funktion tun darf." };
  }
  const zeitplanFehler = b.zeitplan ? pruefeZeitplan(b.zeitplan) : undefined;
  if (zeitplanFehler) {
    return { fehler: zeitplanFehler };
  }
  if (bisher && (bisher.stand === "geloescht" || bisher.version !== n.basisVersion)) {
    return { fehler: "Die Funktion wurde inzwischen geändert oder gelöscht. Bitte neu ansetzen." };
  }
  const herkunft = n.herkunft.bindung;
  if (bisher && bisher.bindung.mandant !== herkunft.mandant) {
    return { fehler: "Die Überarbeitung stammt aus einem anderen Mandanten." };
  }
  const objekt = b.objekt ?? bisher?.bindung.objekt ?? herkunft.objekt;
  if (!objekt) {
    return { fehler: "Bestätige, in welchem Dokument oder Ordner die Funktion arbeitet." };
  }
  const bindung: ZielBindung = {
    mandant: herkunft.mandant,
    host: herkunft.host,
    anwendung: n.definition.anwendung,
    objekt,
  };
  const version = (bisher?.version ?? 0) + 1;
  const fassung: Fassung = {
    version,
    definition: n.definition,
    erlaubteWirkungen: [...b.erlaubteWirkungen],
    bestaetigtVon: b.person,
    bestaetigtAm: b.am,
  };
  return {
    id: bisher?.id ?? id,
    eigentuemer: n.eigentuemer,
    bindung,
    stand: "aktiv",
    version,
    definition: n.definition,
    erlaubteWirkungen: [...b.erlaubteWirkungen],
    zeitplan: b.zeitplan,
    fassungen: [...(bisher?.fassungen ?? []), fassung],
    ergebnisse: bisher?.ergebnisse ?? [],
  };
}

/** Eine bestehende Funktion als Lernnotiz zur Überarbeitung; die aktive Fassung gilt weiter. */
export function ueberarbeite(f: PersoenlicheFunktion, herkunft: Lernnotiz["herkunft"]): Lernnotiz {
  return {
    stand: "lernnotiz",
    eigentuemer: f.eigentuemer,
    definition: f.definition,
    herkunft,
    basisVersion: f.version,
  };
}

export function pausiere(f: PersoenlicheFunktion): PersoenlicheFunktion {
  return f.stand === "aktiv" ? { ...f, stand: "pausiert" } : f;
}

export function setzeFort(f: PersoenlicheFunktion): PersoenlicheFunktion {
  return f.stand === "pausiert" ? { ...f, stand: "aktiv" } : f;
}

function ohneSchritte(d: FunktionsDefinition): FunktionsDefinition {
  return { ...d, parameter: [], schritte: [] };
}

/**
 * Löschen nimmt die Funktion aus jeder künftigen Zeitsteuerung und verwirft ihre Schritte. Echte
 * Ergebnisse und freigegebenes Firmenwissen gehören nicht der Funktion; ihre Kennungen bleiben.
 */
export function loesche(f: PersoenlicheFunktion): PersoenlicheFunktion {
  return {
    ...f,
    stand: "geloescht",
    zeitplan: null,
    definition: ohneSchritte(f.definition),
    fassungen: f.fassungen.map((x) => ({ ...x, definition: ohneSchritte(x.definition) })),
  };
}

/** Darf die Zeitsteuerung diese Funktion jetzt überhaupt anstoßen? */
export function darfStarten(f: PersoenlicheFunktion | Lernnotiz): boolean {
  return f.stand === "aktiv";
}

// ------------------------------------------------------------------------------------------------
// AC07 / AC08 / AC09 · Jeden Lauf vor der ersten Wirkung neu prüfen.
// ------------------------------------------------------------------------------------------------

/** Ein Objekt in einer bestimmten Fassung. */
export interface ObjektStand {
  kennung: string;
  fassung: string;
}

/** Die AKTUELLEN Rechte der Person an genau diesem Objekt in genau dieser Fassung (G04). */
export interface LaufRechte {
  objekt: string;
  fassung: string;
  beobachten: boolean;
  schreiben: boolean;
}

/**
 * Die Bestätigung einer folgenreichen Wirkung. Sie gilt nur für diese Funktion, diesen Lauf, diese
 * Fassung, diesen Schritt und genau den Inhalt, der ihr gezeigt wurde (`abdruck` aus
 * `aussenwirkung`). Ein geänderter Bericht hat einen anderen Abdruck.
 */
export interface LaufBestaetigung {
  funktion: string;
  lauf: string;
  version: number;
  nr: number;
  wirkung: Wirkung;
  abdruck: string;
}

export interface LaufAnfrage {
  /** Kennung dieses Laufs. Eine Bestätigung aus einem anderen Lauf gilt hier nicht. */
  lauf: string;
  /** Die gebundene Fassung — eine Wiederaufnahme läuft nur auf ihr weiter. */
  version: number;
  person: string;
  mandant: string;
  sitzung: string;
  eingaben: Record<string, string>;
  host: { kennung: string; anwendung: string; hostVersion: string; ziele: readonly Ziel[] };
  /** Das Objekt, in dem jetzt gewirkt würde, mit seiner aktuellen Fassung. */
  objekt: ObjektStand;
  rechte: LaufRechte;
  bestaetigungen: readonly LaufBestaetigung[];
}

export interface LaufSchritt {
  nr: number;
  ausfuehrung: "automatisch" | "angehalten";
  ziel?: Ziel;
  art: FunktionsSchritt["art"];
  wert?: string;
  grund?: string;
}

export interface LaufErgebnis {
  stand: "vollstaendig" | "haelt_an";
  lauf: string;
  sitzung: string;
  version: number;
  /** Objekt und Fassung, an denen Rechte und Ziel geprüft wurden. */
  objekt: ObjektStand;
  schritte: LaufSchritt[];
  haltBei?: number;
}

export type LaufPlan = { stand: "abgelehnt"; grund: string; text: string } | LaufErgebnis;

function abgelehnt(grund: string, text: string): LaufPlan {
  return { stand: "abgelehnt", grund, text };
}

/** G04: Mandant, Host, Anwendung, Objekt und objektbezogene Rechte des Laufs. */
function bindungsFehler(f: PersoenlicheFunktion, a: LaufAnfrage): LaufPlan | null {
  const z = f.bindung;
  if (a.mandant !== z.mandant) {
    return abgelehnt("anderer_mandant", "Die Funktion gehört zu einem anderen Mandanten.");
  }
  if (a.host.kennung !== z.host) {
    return abgelehnt("anderer_host", `Die Funktion arbeitet nur in ${z.host}.`);
  }
  if (!gleich(a.host.anwendung, z.anwendung)) {
    return abgelehnt("andere_anwendung", `Die Funktion arbeitet nur in ${z.anwendung}.`);
  }
  if (a.objekt.kennung !== z.objekt) {
    // Gleiche Anwendung und gleich benannte Felder machen ein anderes Dokument nicht zum Ziel.
    return abgelehnt("anderes_objekt", "Das geöffnete Dokument ist nicht das bestätigte Ziel.");
  }
  const r = a.rechte;
  if (r.objekt !== a.objekt.kennung || r.fassung !== a.objekt.fassung) {
    return abgelehnt("rechte_nicht_aktuell", "Die Rechte gelten nicht für die aktuelle Fassung.");
  }
  return null;
}

/** Vorbedingungen eines Laufs: Stand, Person, Fassung, Bindung, Rechte, Eingaben. */
function vorpruefung(f: PersoenlicheFunktion, a: LaufAnfrage): LaufPlan | null {
  const d = f.definition;
  if (f.stand === "pausiert") {
    return abgelehnt("pausiert", "Die Funktion ist pausiert.");
  }
  if (f.stand === "geloescht") {
    return abgelehnt("geloescht", "Die Funktion ist gelöscht.");
  }
  if (a.person !== f.eigentuemer) {
    return abgelehnt("fremde_person", "Eine persönliche Funktion läuft nur für ihre Eigentümerin.");
  }
  if (a.version !== f.version) {
    return abgelehnt("fassung_geaendert", `Die Funktion steht jetzt auf Fassung ${f.version}.`);
  }
  const bindung = bindungsFehler(f, a);
  if (bindung) {
    return bindung;
  }
  const schreibt = d.schritte.some((s) => s.wirkung !== undefined);
  if (schreibt && !a.rechte.schreiben && a.rechte.beobachten) {
    return abgelehnt("nur_beobachtung", "Zuschauen ist freigegeben, Schreiben nicht. Kein Lauf.");
  }
  if (schreibt && !a.rechte.schreiben) {
    return abgelehnt("schreibrecht_fehlt", `Kein Schreibrecht in ${d.anwendung}. Kein Lauf.`);
  }
  for (const p of d.parameter) {
    const w = a.eingaben[p.name];
    if (w === undefined || !w.trim()) {
      return abgelehnt("eingabe_fehlt", `Es fehlt die Eingabe „${p.beschriftung}“.`);
    }
    if (siehtGeheimAus(w)) {
      const text = `„${p.beschriftung}“ sieht nach Zugangsdaten aus. Die werden nicht übernommen.`;
      return abgelehnt("zugangsdaten_als_eingabe", text);
    }
  }
  return null;
}

function aufgeloest(s: FunktionsSchritt, a: LaufAnfrage): string | undefined {
  if (!s.wert) {
    return undefined;
  }
  return "konstante" in s.wert ? s.wert.konstante : a.eingaben[s.wert.parameter];
}

/** Was eine folgenreiche Wirkung konkret tut — das, was die Person vor ihrer Bestätigung sieht. */
export interface Aussenwirkung {
  funktion: string;
  lauf: string;
  version: number;
  nr: number;
  wirkung: Wirkung;
  ziel: string;
  objekt: ObjektStand;
  /** Der vollständige Inhalt des Laufs: je Schritt das Bedienelement und der gesetzte Wert. */
  inhalt: Record<string, string>;
  /** SHA-256 über alles oben; die Bestätigung trägt genau diesen Wert. */
  abdruck: string;
}

/** AC09: die zu bestätigende Außenwirkung eines Schritts in diesem Lauf, oder `null`. */
export function aussenwirkung(
  f: PersoenlicheFunktion,
  a: LaufAnfrage,
  nr: number,
): Aussenwirkung | null {
  const s = f.definition.schritte.find((x) => x.nr === nr);
  if (!s?.wirkung || !FOLGENREICH.includes(s.wirkung)) {
    return null;
  }
  const inhalt: Record<string, string> = {};
  for (const x of f.definition.schritte) {
    const wert = aufgeloest(x, a);
    if (wert !== undefined) {
      inhalt[`${x.nr} ${x.ziel?.name ?? x.art}`] = wert;
    }
  }
  const basis = {
    funktion: f.id,
    lauf: a.lauf,
    version: f.version,
    nr,
    wirkung: s.wirkung,
    ziel: s.ziel?.name ?? "",
    objekt: { kennung: a.objekt.kennung, fassung: a.objekt.fassung },
    inhalt,
  };
  const abdruck = createHash("sha256").update(JSON.stringify(basis)).digest("hex");
  return { ...basis, abdruck };
}

/** Hält dieser Schritt an? Liefert den Grund oder `null`. */
function haltGrund(s: FunktionsSchritt, f: PersoenlicheFunktion, a: LaufAnfrage): string | null {
  if (s.art === "entscheidung" || !s.wirkung) {
    return s.frage ?? "Hier entscheidest du selbst.";
  }
  if (!f.erlaubteWirkungen.includes(s.wirkung)) {
    return `„${s.wirkung}“ hast du dieser Funktion nicht erlaubt.`;
  }
  const ziel = s.ziel;
  if (ziel && !a.host.ziele.some((z) => z.rolle === ziel.rolle && z.name === ziel.name)) {
    return `„${ziel.name}“ ist nicht da.`;
  }
  const erwartet = aussenwirkung(f, a, s.nr);
  if (!erwartet) {
    return null;
  }
  const passt = a.bestaetigungen.some(
    (b) =>
      b.funktion === erwartet.funktion &&
      b.lauf === erwartet.lauf &&
      b.version === erwartet.version &&
      b.nr === erwartet.nr &&
      b.wirkung === erwartet.wirkung &&
      b.abdruck === erwartet.abdruck,
  );
  if (passt) {
    return null;
  }
  const was = erwartet.ziel || erwartet.wirkung;
  return `„${was}“ wirkt nach außen. Erst nach deiner Bestätigung genau dieses Inhalts.`;
}

/**
 * Was ein Lauf tun darf. Harmlose, erlaubte Schritte laufen ohne Einzelrückfrage; der Plan hält am
 * ersten Schritt an, der eine Entscheidung, eine fehlende Bestätigung oder ein verschwundenes Ziel
 * hat. Was danach kommt, läuft nicht. Eine geänderte Hostfassung hält VOR dem ersten Schritt —
 * auch wenn alle Bedienelemente noch gleich heißen (AC07).
 */
export function planeLauf(f: PersoenlicheFunktion, a: LaufAnfrage): LaufPlan {
  const abgewiesen = vorpruefung(f, a);
  if (abgewiesen) {
    return abgewiesen;
  }
  const kopf = { lauf: a.lauf, sitzung: a.sitzung, version: f.version, objekt: a.objekt };
  const d = f.definition;
  const schritte: LaufSchritt[] = [];
  for (const s of d.schritte) {
    const schritt: LaufSchritt = { nr: s.nr, art: s.art, ausfuehrung: "automatisch" };
    if (s.ziel) {
      schritt.ziel = s.ziel;
    }
    const wert = aufgeloest(s, a);
    if (wert !== undefined) {
      schritt.wert = wert;
    }
    let grund = haltGrund(s, f, a);
    if (schritte.length === 0 && a.host.hostVersion !== d.hostVersion) {
      const wechsel = `${d.hostVersion} → ${a.host.hostVersion}`;
      grund = `${d.anwendung} hat sich seit dem Lernen geändert (${wechsel}). Prüfe die Schritte.`;
    }
    if (grund) {
      schritte.push({ ...schritt, ausfuehrung: "angehalten", grund });
      return { stand: "haelt_an", ...kopf, schritte, haltBei: s.nr };
    }
    schritte.push(schritt);
  }
  return { stand: "vollstaendig", ...kopf, schritte };
}

/**
 * G12: unmittelbar vor der tatsächlichen Wirkung eines Schritts. Der Plan gilt nur, solange das Ziel
 * in der geprüften Fassung vorliegt — oder in einer Fassung, die dieser Lauf selbst erzeugt hat —
 * und die Rechte für genau diese Fassung weiter bestehen. Sonst nichts überschreiben.
 */
export function pruefeVorWirkung(
  plan: LaufPlan,
  nr: number,
  jetzt: { objekt: ObjektStand; rechte: LaufRechte },
  eigeneFassungen: readonly string[] = [],
): string | null {
  if (plan.stand === "abgelehnt") {
    return "Der Lauf war abgelehnt.";
  }
  const schritt = plan.schritte.find((s) => s.nr === nr);
  if (schritt?.ausfuehrung !== "automatisch") {
    return `Schritt ${nr} ist nicht freigegeben.`;
  }
  if (jetzt.objekt.kennung !== plan.objekt.kennung) {
    return "Das Ziel ist ein anderes Dokument als geprüft.";
  }
  const bekannt = [plan.objekt.fassung, ...eigeneFassungen];
  if (!bekannt.includes(jetzt.objekt.fassung)) {
    return "Das Dokument wurde inzwischen von anderer Seite geändert. Nichts wird überschrieben.";
  }
  const r = jetzt.rechte;
  if (r.objekt !== jetzt.objekt.kennung || r.fassung !== jetzt.objekt.fassung || !r.schreiben) {
    return "Für die aktuelle Fassung fehlt das Schreibrecht.";
  }
  return null;
}

/** AC08: Ergebnisprüfung — jede automatisch gesetzte Eingabe steht im tatsächlichen Ergebnis. */
export function pruefeErgebnis(
  plan: LaufPlan,
  ergebnis: { kennung: string; felder: Record<string, string> },
): { ok: boolean; abweichungen: string[] } {
  if (plan.stand === "abgelehnt") {
    return { ok: false, abweichungen: ["Der Lauf war abgelehnt."] };
  }
  const abweichungen: string[] = [];
  for (const s of plan.schritte) {
    const gesetzt = s.ausfuehrung === "automatisch" && s.art === "eingabe";
    if (!gesetzt || !s.ziel || s.wert === undefined) {
      continue;
    }
    if (ergebnis.felder[s.ziel.name] !== s.wert) {
      abweichungen.push(`„${s.ziel.name}“ weicht im Ergebnis ${ergebnis.kennung} ab.`);
    }
  }
  return { ok: abweichungen.length === 0, abweichungen };
}

function gleich(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
