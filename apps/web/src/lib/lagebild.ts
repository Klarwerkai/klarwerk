// ================================================================================================
// PETER-20261011-P13 · LAGEBILD UND WISSENSKAPITAL — REGELN, DIE KEINE ZAHL ERFINDEN.
// ================================================================================================
//
// produkt:20261011:peter-p13 (Phase: Konzept jetzt, Messung im PoC). Rein und DOM-frei; die
// Kapitalsicht (`pages/Stufe2.tsx`) und die Tests lesen dieselben Regeln.
//
// Entscheidung 50 (11.10.2026): „Reifegrade an Belege knüpfen, Wissenskapital nicht aus Textmenge
// monetarisieren." Daraus:
//
//   REIFEGRAD je ARBEITSWEG, nie pauschal für die Firma. Eine Stufe gilt erst, wenn JEDER für sie
//   verlangte Nachweis einen Beleg dieses Arbeitswegs hat und alle Stufen darunter gelten. Ein
//   Beleg eines anderen Arbeitswegs zählt nicht.
//
//   AGENT ≠ MENSCH. Agentenprüfungen (fiktive Testdaten) belegen höchstens „Technisch geprüft".
//   „Im echten Alltag belegt" verlangt Belege mit Messart `mensch`; ein Agentenbeleg dafür wird
//   als „nicht anrechenbar" geführt, nicht still verworfen.
//
//   QUOTE nur mit bekannter Grundgesamtheit. Fehlt der Sollbestand, gibt es keine Prozentzahl —
//   „unbekannt" ist eine eigene Aussage, keine 0 und keine 100.
//
//   GELDWERT nur aus gemessenen Fällen: Fallzahl × gemessene Zeitdifferenz × vereinbarter
//   Kostensatz, abzüglich zusätzlicher Pflege-, Betriebs- und Prüfkosten. Eine negative
//   Zeitdifferenz bleibt negativ; ein Fall ohne vergleichbare Bearbeitungsqualität verhindert den
//   Wert (sonst ließen sich ungünstige Fälle aussortieren); derselbe Fall zählt einmal. Es gibt
//   keine Vorgabewerte — fehlt eine Annahme, gibt es keinen Wert. Ersparnis ist kein Umsatz.

/** Die Fassung dieser Rechenregeln; steht an jedem Ergebnis, damit Änderungen erklärbar bleiben. */
export const BERECHNUNGSVERSION = "p13-lagebild-v1";

// ── Reifegrad je Arbeitsweg ─────────────────────────────────────────────────────────────────────

export const REIFESTUFEN = [
  "erfasst",
  "geordnet",
  "fachlich_bestaetigt",
  "technisch_geprueft",
  "alltag_belegt",
] as const;
export type Reifestufe = (typeof REIFESTUFEN)[number];

/** Was eine Stufe tatsächlich verlangt — je Nachweis ein Beleg. */
export const STUFEN_NACHWEISE = {
  erfasst: ["ursprung", "version", "verantwortlichkeit", "einstufung"],
  geordnet: ["kontext", "verknuepfung", "rechte"],
  fachlich_bestaetigt: ["befugnis", "entscheidung", "geltung"],
  technisch_geprueft: ["arbeitsweg_vollstaendig", "positivfaelle", "negativfaelle"],
  alltag_belegt: ["reale_anwender", "reale_aufgaben", "gesamtaufwand", "ergebnis"],
} as const satisfies Record<Reifestufe, readonly string[]>;
export type Nachweis = (typeof STUFEN_NACHWEISE)[Reifestufe][number];

/**
 * Wer den Beleg erbracht hat. `system`: aus dem Bestand (Ursprung, Rechte …); `agent`:
 * Agentenprüfung mit fiktiven Testdaten; `mensch`: echte Anwender mit echten Aufgaben.
 */
export type Messart = "system" | "agent" | "mensch";

export interface Beleg {
  arbeitsweg: string;
  nachweis: Nachweis;
  messart: Messart;
  /** Woher der Beleg stammt (Prüfbericht, Vorgang, Fassung) — nie leer. */
  quelle: string;
  /** Zeitpunkt des Belegs (ISO). */
  stand: string;
  /** Nur bei Prüfbelegen: ein nicht bestandener Lauf ist ein Beleg — aber kein Nachweis. */
  bestanden?: boolean;
}

export interface Reifegrad {
  arbeitsweg: string;
  /** Höchste lückenlos belegte Stufe; `null` = nicht einmal „Erfasst" ist belegt. */
  stufe: Reifestufe | null;
  /** Die nächste Stufe und genau die Nachweise, die ihr fehlen; `null` = alle Stufen belegt. */
  naechste: { stufe: Reifestufe; fehlend: Nachweis[] } | null;
  /** Belege dieses Arbeitswegs, die für ihre Stufe nicht zählen dürfen (Agent für den Alltag). */
  nichtAnrechenbar: Beleg[];
  version: typeof BERECHNUNGSVERSION;
}

/** Darf dieser Beleg für den Nachweis dieser Stufe zählen? */
function anrechenbar(stufe: Reifestufe, b: Beleg): boolean {
  if (b.bestanden === false || b.quelle.trim() === "") {
    return false;
  }
  return stufe === "alltag_belegt" ? b.messart === "mensch" : true;
}

export function reifegrad(arbeitsweg: string, belege: readonly Beleg[]): Reifegrad {
  const eigene = belege.filter((b) => b.arbeitsweg === arbeitsweg);
  const stufeVon = (n: Nachweis): Reifestufe =>
    REIFESTUFEN.find((s) => (STUFEN_NACHWEISE[s] as readonly Nachweis[]).includes(n)) ?? "erfasst";
  // Über ALLE Stufen gesammelt: ein Agentenbeleg für den Alltag wird auch dann benannt, wenn der
  // Arbeitsweg noch weiter unten steht.
  const nichtAnrechenbar = eigene.filter(
    (b) => b.bestanden !== false && !anrechenbar(stufeVon(b.nachweis), b),
  );
  let stufe: Reifestufe | null = null;
  let naechste: Reifegrad["naechste"] = null;
  for (const s of REIFESTUFEN) {
    const verlangt: readonly Nachweis[] = STUFEN_NACHWEISE[s];
    const fuerStufe = eigene.filter((b) => verlangt.includes(b.nachweis));
    const fehlend = verlangt.filter(
      (n) => !fuerStufe.some((b) => b.nachweis === n && anrechenbar(s, b)),
    );
    if (fehlend.length > 0) {
      naechste = { stufe: s, fehlend: [...fehlend] };
      break;
    }
    stufe = s;
  }
  return { arbeitsweg, stufe, naechste, nichtAnrechenbar, version: BERECHNUNGSVERSION };
}

// ── Quote mit offengelegter Grundgesamtheit ─────────────────────────────────────────────────────

export type QuotenGrund = "berechnet" | "grundgesamtheit_unbekannt" | "nenner_null" | "ungueltig";

export interface Quote {
  /** Prozent mit einer Nachkommastelle; `null`, wenn die Grundgesamtheit das nicht trägt. */
  wert: number | null;
  grund: QuotenGrund;
  zaehler: number;
  /** `null` = Sollbestand/Grundgesamtheit nicht festgelegt. */
  nenner: number | null;
}

/**
 * Eine Quote nur über eine FESTGELEGTE Grundgesamtheit. `nenner: null` heißt „nicht festgelegt" —
 * dann gibt es keine Prozentzahl, auch keine aus der Zahl der gerade bekannten Einträge.
 */
export function quote(zaehler: number, nenner: number | null): Quote {
  if (nenner === null) {
    return { wert: null, grund: "grundgesamtheit_unbekannt", zaehler, nenner };
  }
  if (nenner === 0) {
    return { wert: null, grund: "nenner_null", zaehler, nenner };
  }
  if (zaehler < 0 || nenner < 0 || zaehler > nenner) {
    return { wert: null, grund: "ungueltig", zaehler, nenner };
  }
  return { wert: Math.round((zaehler / nenner) * 1000) / 10, grund: "berechnet", zaehler, nenner };
}

// ── Geldwert aus gemessenen Fällen ──────────────────────────────────────────────────────────────

export interface GemessenerFall {
  /** Kennung des tatsächlichen Falls; dieselbe Kennung zählt nur einmal. */
  id: string;
  messart: Exclude<Messart, "system">;
  /** Gemessener vollständiger Aufwand ohne Klarwerk (Baseline), Minuten. */
  minutenOhne: number;
  /** Gemessener vollständiger Aufwand mit Klarwerk, Minuten — darf größer sein als ohne. */
  minutenMit: number;
  qualitaetVergleichbar: boolean;
}

export interface GeldwertEingabe {
  faelle: readonly GemessenerFall[];
  /** Vereinbarter Kostensatz €/Stunde; `null` = nicht vereinbart. */
  kostensatzEurProStunde: number | null;
  /** Zusätzliche Pflege-, Betriebs- und Prüfkosten im Zeitraum, €; `null` = nicht erhoben. */
  zusatzkostenEur: number | null;
}

export type GeldwertGrund =
  | "keine_faelle"
  | "messart_gemischt"
  | "ungueltige_messung"
  | "qualitaet_nicht_vergleichbar"
  | "kostensatz_fehlt"
  | "zusatzkosten_fehlt";

export type Geldwert =
  | { lage: "nicht_berechenbar"; grund: GeldwertGrund; version: typeof BERECHNUNGSVERSION }
  | {
      lage: "berechnet";
      messart: GemessenerFall["messart"];
      /** Gezählte Fälle nach Entfernen doppelter Kennungen. */
      fallzahl: number;
      /** Wie viele Einträge eine bereits gezählte Kennung wiederholten. */
      doppelt: number;
      /** Summe (ohne − mit) über die Fälle; negativ heißt Mehraufwand. */
      minutenDifferenz: number;
      /** Fälle, in denen Klarwerk mehr Zeit kostete. */
      faelleMitMehraufwand: number;
      bruttoEur: number;
      zusatzkostenEur: number;
      /** brutto − Zusatzkosten; darf negativ sein. */
      nettoEur: number;
      kostensatzEurProStunde: number;
      version: typeof BERECHNUNGSVERSION;
    };

const endlich = (n: number): boolean => typeof n === "number" && Number.isFinite(n);

export function geldwert(e: GeldwertEingabe): Geldwert {
  const nicht = (grund: GeldwertGrund): Geldwert => ({
    lage: "nicht_berechenbar",
    grund,
    version: BERECHNUNGSVERSION,
  });
  const gesehen = new Set<string>();
  const faelle: GemessenerFall[] = [];
  for (const f of e.faelle) {
    const id = f.id.trim();
    if (id !== "" && !gesehen.has(id)) {
      gesehen.add(id);
      faelle.push(f);
    }
  }
  if (faelle.length === 0) {
    return nicht("keine_faelle");
  }
  const messarten = new Set(faelle.map((f) => f.messart));
  if (messarten.size > 1) {
    return nicht("messart_gemischt");
  }
  if (faelle.some((f) => !endlich(f.minutenOhne) || !endlich(f.minutenMit))) {
    return nicht("ungueltige_messung");
  }
  if (faelle.some((f) => f.minutenOhne < 0 || f.minutenMit < 0)) {
    return nicht("ungueltige_messung");
  }
  if (faelle.some((f) => !f.qualitaetVergleichbar)) {
    return nicht("qualitaet_nicht_vergleichbar");
  }
  const satz = e.kostensatzEurProStunde;
  if (satz === null || !endlich(satz) || satz <= 0) {
    return nicht("kostensatz_fehlt");
  }
  const zusatz = e.zusatzkostenEur;
  if (zusatz === null || !endlich(zusatz) || zusatz < 0) {
    return nicht("zusatzkosten_fehlt");
  }
  const minutenDifferenz = faelle.reduce((s, f) => s + (f.minutenOhne - f.minutenMit), 0);
  const bruttoEur = Math.round((minutenDifferenz / 60) * satz * 100) / 100;
  return {
    lage: "berechnet",
    messart: faelle[0]?.messart ?? "agent",
    fallzahl: faelle.length,
    doppelt: e.faelle.filter((f) => f.id.trim() !== "").length - faelle.length,
    minutenDifferenz,
    faelleMitMehraufwand: faelle.filter((f) => f.minutenMit > f.minutenOhne).length,
    bruttoEur,
    zusatzkostenEur: zusatz,
    nettoEur: Math.round((bruttoEur - zusatz) * 100) / 100,
    kostensatzEurProStunde: satz,
    version: BERECHNUNGSVERSION,
  };
}

/** Euro mit Vorzeichen — ein negativer Wert bleibt als solcher lesbar. */
export function formatEur(wert: number, sprache: string): string {
  return new Intl.NumberFormat(sprache, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(wert);
}
