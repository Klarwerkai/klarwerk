import { gapCompareKey, normalizeGapQuestion } from "./gap-text";

// ================================================================================================
// R-0773 — „DAS SYSTEM ZEIGT, WONACH GESUCHT WURDE, OHNE DASS ETWAS GEFUNDEN WURDE."
// ================================================================================================
//
// Ein direkter Hinweis, wo Wissen fehlt — unabhängig davon, ob jemand eine Frage gestellt hat. Das
// Lückenboard zählt nur UNBEANTWORTETE FRAGEN; diese Ablage zählt erfolglose SUCHEN. Beide bleiben
// getrennt (Landkarte v3 führt sie getrennt, und so auch hier).
//
// WAS ALS NULLTREFFER GILT — die Route entscheidet, hier steht nur die Form:
//   · ein NICHT-LEERER Suchbegriff (eine leere Abfrage ist ein Blick in den Bestand, keine Suche),
//   · und NACH dem Sichtbarkeitsschnitt leer — gemessen an dem, was DER SUCHENDE sehen darf.
// Ein technischer Fehler der Suche wirft und erreicht die Erfassung gar nicht.
//
// DIE EINGRENZUNG REIST MIT (BEN, Nacharbeit 3): eine erfolglose Suche MIT Filter (Art, Status,
// Kategorie, Schlagwort) wird ebenfalls vermerkt — aber mit ihrem Suchkontext. Sie sagt nur etwas
// über diese Auswahl, nicht über den ganzen Bestand; die Fläche kennzeichnet das. Derselbe Begriff
// mit und ohne Eingrenzung sind deshalb zwei Einträge, nie einer.
//
// WER ES SIEHT — dieselbe Regel wie beim Fragetext einer Lücke (R-0585: „Was jemand gefragt hat,
// sieht nur er selbst und der Zuständige"). Ein Suchbegriff ist Nutzer-Freitext ohne
// Vertraulichkeitsstufe; die Ablage ist deshalb JE PERSON geschlüsselt, und gelesen wird nur die
// eigene Liste. Eine Sicht über die Suchen ANDERER (etwa für Fachverantwortliche) ist eine
// Produktentscheidung über die Sichtbarkeit fremder Suchbegriffe und hier ausdrücklich NICHT gebaut.
//
// DATENSPARSAM: gespeichert wird der normalisierte, auf `NULLTREFFER_BEGRIFF_MAX` begrenzte Begriff,
// je Person und Begriff EIN Eintrag mit Zähler und letztem Zeitpunkt — kein Verlauf jeder Eingabe.

/** Längenbegrenzung des gespeicherten Begriffs (dieselbe Kürzungsregel wie beim Lückentext). */
const NULLTREFFER_BEGRIFF_MAX = 120;

/** So viele Einträge liefert die eigene Liste höchstens — die jüngsten zuerst. */
export const NULLTREFFER_DECKEL = 20;

export interface NulltrefferErfassung {
  readonly userId: string;
  /** Formnormalisiert wie `gapCompareKey` — „Pumpe!" und „pumpe" sind ein Eintrag. */
  readonly vergleichsschluessel: string;
  /** Der Begriff, wie er angezeigt wird (normalisiert und begrenzt). */
  readonly begriff: string;
  /** Kanonische Eingrenzung (`nulltrefferEingrenzung`); "" heisst: ohne Filter gesucht. */
  readonly eingrenzung: string;
  readonly zeitpunkt: string;
}

export interface NulltrefferSuche {
  readonly begriff: string;
  readonly anzahl: number;
  readonly zuletzt: string;
  /** Die Filter der Suche, Feld → Wert; leer heisst: im ganzen sichtbaren Bestand gesucht. */
  readonly eingrenzung: Readonly<Record<string, string>>;
}

const BEGRENZUNG = NULLTREFFER_BEGRIFF_MAX;

/** Die Filterfelder der Bibliothekssuche (`KoFilter`), in fester Reihenfolge. */
const NULLTREFFER_FILTERFELDER =["type", "status", "category", "tag"] as const;

/**
 * Die Eingrenzung einer Suche in kanonischer Form: nur bekannte Filterfelder mit nicht-leerem
 * Wert, in fester Reihenfolge, als JSON-Text — "" ohne Filter. Kanonisch, damit dieselbe
 * Eingrenzung immer derselbe Schlüssel ist; begrenzt wie der Begriff.
 */
export function nulltrefferEingrenzung(filter: object): string {
  const felder = filter as Record<string, unknown>;
  const paare: [string, string][] = [];
  for (const feld of NULLTREFFER_FILTERFELDER) {
    const wert = felder[feld];
    const text = typeof wert === "string" ? normalizeGapQuestion(wert, BEGRENZUNG) : "";
    if (text) {
      paare.push([feld, text]);
    }
  }
  return paare.length > 0 ? JSON.stringify(Object.fromEntries(paare)) : "";
}

/** Die gespeicherte Eingrenzung zurück in Feld → Wert; Unlesbares wird zu „ohne Angabe". */
export function leseEingrenzung(text: string): Record<string, string> {
  if (!text) {
    return {};
  }
  try {
    const roh = JSON.parse(text) as unknown;
    if (!roh || typeof roh !== "object") {
      return {};
    }
    const ergebnis: Record<string, string> = {};
    for (const feld of NULLTREFFER_FILTERFELDER) {
      const wert = (roh as Record<string, unknown>)[feld];
      if (typeof wert === "string" && wert) {
        ergebnis[feld] = wert;
      }
    }
    return ergebnis;
  } catch {
    return {};
  }
}

export interface NulltrefferRepo {
  /** Neu anlegen oder — bei gleichem Schlüssel derselben Person — Zähler und Zeitpunkt fortschreiben. */
  erfasse(eintrag: NulltrefferErfassung): Promise<void>;
  /** Die eigenen Nulltreffer-Suchen dieser Person, die jüngsten zuerst, höchstens `deckel`. */
  fuer(userId: string, deckel: number): Promise<NulltrefferSuche[]>;
}

/**
 * Aus einem Suchbegriff die zu speichernde Form — oder `null`, wenn er nichts trägt (leer, nur
 * Satzzeichen). Ein leerer Schlüssel ist kein Schlüssel (dieselbe Regel wie bei `gapCompareKey`).
 */
export function nulltrefferBegriff(
  q: string,
): { readonly begriff: string; readonly vergleichsschluessel: string } | null {
  const begriff = normalizeGapQuestion(q, NULLTREFFER_BEGRIFF_MAX);
  const vergleichsschluessel = gapCompareKey(q, NULLTREFFER_BEGRIFF_MAX);
  return begriff.length > 0 && vergleichsschluessel.length > 0
    ? { begriff, vergleichsschluessel }
    : null;
}

interface Gespeichert {
  readonly userId: string;
  readonly begriff: string;
  readonly anzahl: number;
  readonly zuletzt: string;
  readonly eingrenzung: string;
}

export class InMemoryNulltrefferRepo implements NulltrefferRepo {
  private readonly eintraege = new Map<string, Gespeichert>();

  async erfasse(eintrag: NulltrefferErfassung): Promise<void> {
    const teile = [eintrag.userId, eintrag.vergleichsschluessel, eintrag.eingrenzung];
    const schluessel = teile.join("\u0000");
    const vorhanden = this.eintraege.get(schluessel);
    this.eintraege.set(schluessel, {
      userId: eintrag.userId,
      begriff: eintrag.begriff,
      anzahl: (vorhanden?.anzahl ?? 0) + 1,
      zuletzt: eintrag.zeitpunkt,
      eingrenzung: eintrag.eingrenzung,
    });
  }

  async fuer(userId: string, deckel: number): Promise<NulltrefferSuche[]> {
    return [...this.eintraege.values()]
      .filter((e) => e.userId === userId)
      .sort((a, b) => (a.zuletzt < b.zuletzt ? 1 : a.zuletzt > b.zuletzt ? -1 : 0))
      .slice(0, Math.max(0, deckel))
      .map(({ begriff, anzahl, zuletzt, eingrenzung }) => ({
        begriff,
        anzahl,
        zuletzt,
        eingrenzung: leseEingrenzung(eingrenzung),
      }));
  }
}
