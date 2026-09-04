// ================================================================================================
// JOB 3061 · H2 — DER REITERZÄHLER SAGT NUR, WAS ER WEISS.
// ================================================================================================
//
// Auftrag §9: „Reiterzähler: erst nach frischem Abruf, sonst nur der Name; Cache mit laufender
// Auffrischung zeigt die alte Zahl gedämpft (#9AA2B1); gescheiterte Auffrischung: Name ohne Zahl."
//
// Und die Hausregel aus JOB 3027/3025/3037 (Regelwerk §7): eine gescheiterte HINTERGRUND-
// Auffrischung darf die zuletzt erfolgreich geholten Werte nicht löschen — sie darf sie nur als
// nicht mehr frisch kennzeichnen. Für eine ZAHL am Reiter gilt hier ausdrücklich das Strengere,
// weil der Auftrag es so verlangt: eine Zahl ist eine Tatsachenbehauptung über den Bestand, und
// „9 offen" nach einem gescheiterten Abruf wäre genau die starke Aussage ohne ihre Voraussetzung.
// Der Bestand selbst (die Warteschlange, die Karte) bleibt davon unberührt sichtbar — dafür sorgt
// die Seite, nicht dieser Zähler.
//
// DREI LAGEN, KEINE VIERTE:
//   frisch     — eine Antwort liegt vor und wird gerade nicht nachgeholt  → Zahl, normal
//   gedaempft  — eine Antwort liegt vor, die Auffrischung läuft            → Zahl, gedämpft
//   unbekannt  — nie eine Antwort ODER die Auffrischung ist gescheitert    → nur der Name

export type ZaehlerLage = "frisch" | "gedaempft" | "unbekannt";

export interface ReiterZaehler {
  lage: ZaehlerLage;
  /** Nur in den Lagen `frisch` und `gedaempft` gesetzt — sonst ausdrücklich `null`. */
  wert: number | null;
}

export interface ZaehlerQuelle {
  /** `query.data !== undefined` — „es gab jemals eine Antwort". */
  hatAntwort: boolean;
  /** `query.isError`. */
  gescheitert: boolean;
  /** `query.isFetching` — eine Auffrischung läuft gerade. */
  frischtAuf: boolean;
  /** Die aus der Antwort GEZÄHLTE Menge. Ohne Antwort `null` — nie eine geratene Zahl. */
  wert: number | null;
}

export function reiterZaehler(q: ZaehlerQuelle): ReiterZaehler {
  if (!q.hatAntwort || q.wert === null) {
    return { lage: "unbekannt", wert: null };
  }
  if (q.gescheitert) {
    return { lage: "unbekannt", wert: null };
  }
  if (q.frischtAuf) {
    return { lage: "gedaempft", wert: q.wert };
  }
  return { lage: "frisch", wert: q.wert };
}

/** Die Zählerquelle aus einer react-query-Lage über einer Liste — eine Stelle, vier Reiter. */
export function zaehlerQuelle(q: {
  data?: readonly unknown[] | undefined;
  isError: boolean;
  isFetching: boolean;
}): ZaehlerQuelle {
  return {
    hatAntwort: q.data !== undefined,
    gescheitert: q.isError,
    frischtAuf: q.isFetching,
    wert: q.data === undefined ? null : q.data.length,
  };
}

// ------------------------------------------------------------------------------------------------
// DIE LAGE DER FLÄCHE (Warteschlange, Kartenpaar) — dieselbe Frage, eine Ebene tiefer.
// ------------------------------------------------------------------------------------------------
//
// Auftrag §9: „Warteschlange laden = drei graue Platzhalterzeilen; leer = ein Satz; Fehler/offline =
// ein Satz + „Erneut laden"." Und der Sonderfall aus JOB 3027 R2/R3, der hier weiterlebt: liegt eine
// Antwort im Cache, ist ein Fehler die Aussage „die AUFFRISCHUNG ist gescheitert" und nicht „es gibt
// nichts zu zeigen". `undefined` heisst „nie eine Antwort gehabt", `[]` heisst „eine Antwort gehabt,
// sie war leer" — nur das Erste ist ein Erstfehler.

export type FlaechenLage = "laedt" | "erstfehler" | "leer" | "bestand";

export interface FlaechenZustand {
  lage: FlaechenLage;
  /** Wahr, wenn Zeilen da sind UND die letzte Auffrischung gescheitert ist. */
  auffrischungGescheitert: boolean;
}

/**
 * Der ZWEITE Abruf, ohne den der Befund nicht darstellbar ist (bens Korrekturpflicht 2, Runde 4).
 *
 * DER BEFUND: „Konflikte", „Duplikate" und „Erneut" zeigen einen Befund (Konflikt, Überschneidung,
 * Fälligkeit), der nur aus IDs besteht. Titel, Aussage, Bereich und Datum stehen in den
 * Wissensobjekten — einem eigenen Abruf (`useKos`). Die Flächen bestimmten ihre Lage bis hierher
 * NUR aus dem Befundabruf und lasen die Objekte mit `kos.data ?? []`. Solange dieser zweite Abruf
 * noch lief, war die Ersatzliste leer, und die Fläche sagte zweimal „Objekt entfernt" — und bot
 * darunter die Entscheidungsknöpfe an. Das ist genau der Fehler aus Regelwerk §7: eine
 * Tatsachenaussage („dieses Objekt gibt es nicht mehr") ohne ihre Voraussetzung (ein
 * ABGESCHLOSSENER Objektabruf). Wer sie glaubte, entschied über etwas, das er nicht sah.
 *
 * DIE REGEL: Solange der abhängige Abruf nie eine Antwort hatte, ist die Fläche `laedt` (bzw.
 * `erstfehler`, wenn er gescheitert ist) — nicht `bestand`. Erst nach einer Antwort darf „Objekt
 * entfernt" stehen; DANN ist der Satz wahr, denn das Objekt fehlt in einer vollständigen Liste.
 * Eine gescheiterte AUFFRISCHUNG bei vorhandener Antwort löscht nichts — sie meldet sich über
 * `auffrischungGescheitert`, wie bei der Befundliste auch (JOB 3027 R2/R3).
 */
export interface AbhaengigeQuelle {
  /** `query.data !== undefined` — „es gab jemals eine Antwort". */
  hatAntwort: boolean;
  isError: boolean;
}

export function abhaengigeQuelle(q: {
  data?: unknown;
  isError: boolean;
}): AbhaengigeQuelle {
  return { hatAntwort: q.data !== undefined, isError: q.isError };
}

export function flaechenZustand(
  q: {
    data?: readonly unknown[] | undefined;
    isLoading: boolean;
    isError: boolean;
  },
  abhaengig?: AbhaengigeQuelle,
): FlaechenZustand {
  const hatAntwort = q.data !== undefined;
  if (q.isError && !hatAntwort) {
    return { lage: "erstfehler", auffrischungGescheitert: false };
  }
  if (!hatAntwort) {
    return { lage: q.isLoading ? "laedt" : "erstfehler", auffrischungGescheitert: false };
  }
  const gescheitert = q.isError;
  if ((q.data as readonly unknown[]).length === 0) {
    // Leer heisst leer — dafür braucht es die Objekte nicht. Ein „Nichts offen." ist auch dann
    // wahr, wenn der Objektabruf noch läuft.
    return { lage: "leer", auffrischungGescheitert: gescheitert };
  }
  if (abhaengig && !abhaengig.hatAntwort) {
    return {
      lage: abhaengig.isError ? "erstfehler" : "laedt",
      auffrischungGescheitert: false,
    };
  }
  return {
    lage: "bestand",
    auffrischungGescheitert: gescheitert || (abhaengig?.isError ?? false),
  };
}
