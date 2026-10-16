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
  /**
   * Kennung des tatsächlichen Falls. Eine fachlich identische Wiederholung zählt einmal; weichen
   * Einträge derselben Kennung ab, ist das Klärbedarf und es gibt keinen Betrag.
   */
  id: string;
  messart: Exclude<Messart, "system">;
  /** Gemessener vollständiger Aufwand ohne Klarwerk (Baseline), Minuten. */
  minutenOhne: number;
  /** Gemessener vollständiger Aufwand mit Klarwerk, Minuten — darf größer sein als ohne. */
  minutenMit: number;
  qualitaetVergleichbar: boolean;
}

/**
 * Wofür die Messung gilt (P13-AC03): EIN Messzeitraum für alle Fälle UND die Zusatzkosten, der
 * Arbeitskontext und die Messquelle mit ihrem Stand. Tage als `JJJJ-MM-TT`; `null` = nicht angegeben.
 */
export interface Messrahmen {
  von: string | null;
  bis: string | null;
  /** Arbeitsweg bzw. Bereich, in dem gemessen wurde. */
  kontext: string | null;
  /** Woher die Messwerte stammen (Protokoll, Prüfbericht …). */
  quelle: string | null;
  /** Stand der Quelle; er muss den ganzen Zeitraum abdecken (nicht vor `bis`). */
  quellenStand: string | null;
}

export const MESS_ANGABEN = ["von", "bis", "kontext", "quelle", "quellenStand"] as const;
export type MessAngabe = (typeof MESS_ANGABEN)[number];

export interface GeldwertEingabe {
  faelle: readonly GemessenerFall[];
  /** Vereinbarter Kostensatz €/Stunde; `null` = nicht vereinbart. */
  kostensatzEurProStunde: number | null;
  /**
   * Zusätzliche Pflege-, Betriebs- und Prüfkosten, €, im Messzeitraum des Rahmens — derselbe
   * Zeitraum wie die Fälle; `null` = nicht erhoben.
   */
  zusatzkostenEur: number | null;
  rahmen: Messrahmen;
  /** Heutiger Tag (`JJJJ-MM-TT`) für die Prüfung „nicht in der Zukunft“; Vorgabe: Systemuhr. */
  heute?: string;
}

export type GeldwertGrund =
  | "keine_faelle"
  | "widerspruch_fallkennung"
  | "messart_gemischt"
  | "ungueltige_messung"
  | "qualitaet_nicht_vergleichbar"
  | "kostensatz_fehlt"
  | "zusatzkosten_fehlt"
  | "angaben_fehlen"
  | "messzeitraum_ungueltig"
  | "quellenstand_ungueltig";

export type Geldwert =
  | {
      lage: "nicht_berechenbar";
      grund: GeldwertGrund;
      /** Nur bei `widerspruch_fallkennung`: die Kennungen mit abweichenden Einträgen (Klärbedarf). */
      widersprueche?: string[];
      /** Nur bei `angaben_fehlen`: welche Angaben des Messrahmens fehlen. */
      fehlend?: MessAngabe[];
      version: typeof BERECHNUNGSVERSION;
    }
  | {
      lage: "berechnet";
      /** Zeitraum, Kontext und Quelle mit Stand, für die dieser Betrag gilt. */
      rahmen: { [K in MessAngabe]: string };
      messart: GemessenerFall["messart"];
      /** Gezählte Fälle nach Zusammenfassen fachlich identischer Wiederholungen. */
      fallzahl: number;
      /** Wie viele Einträge einen bereits gezählten Fall identisch wiederholten. */
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

/** Ein Kalendertag `JJJJ-MM-TT`, der tatsächlich existiert. */
function istTag(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }
  const d = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

/** Zwei Einträge derselben Kennung beschreiben fachlich denselben Fall. */
function gleicherFall(a: GemessenerFall, b: GemessenerFall): boolean {
  return (
    a.messart === b.messart &&
    Object.is(a.minutenOhne, b.minutenOhne) &&
    Object.is(a.minutenMit, b.minutenMit) &&
    a.qualitaetVergleichbar === b.qualitaetVergleichbar
  );
}

export function geldwert(e: GeldwertEingabe): Geldwert {
  const nicht = (grund: GeldwertGrund): Geldwert => ({
    lage: "nicht_berechenbar",
    grund,
    version: BERECHNUNGSVERSION,
  });
  // P13-AC05: erst alle Einträge je Kennung sammeln, dann vergleichen. Nur identische
  // Wiederholungen werden zusammengefasst; ein Widerspruch wird nie durch die Reihenfolge entschieden.
  const jeKennung = new Map<string, GemessenerFall[]>();
  for (const f of e.faelle) {
    const id = f.id.trim();
    if (id !== "") {
      jeKennung.set(id, [...(jeKennung.get(id) ?? []), f]);
    }
  }
  if (jeKennung.size === 0) {
    return nicht("keine_faelle");
  }
  const widersprueche = [...jeKennung]
    .filter(([, eintraege]) => eintraege.some((x) => !gleicherFall(x, eintraege[0] ?? x)))
    .map(([id]) => id);
  if (widersprueche.length > 0) {
    return {
      lage: "nicht_berechenbar",
      grund: "widerspruch_fallkennung",
      widersprueche,
      version: BERECHNUNGSVERSION,
    };
  }
  const faelle = [...jeKennung.values()].flatMap((eintraege) => eintraege.slice(0, 1));
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
  // P13-AC03/AC06: ohne Zeitraum, Kontext und Quelle mit Stand ist ein Betrag nicht belegt.
  const r = e.rahmen;
  const text = (v: string | null): string => (v ?? "").trim();
  const fehlend = MESS_ANGABEN.filter((k) => text(r[k]) === "");
  if (fehlend.length > 0) {
    return {
      lage: "nicht_berechenbar",
      grund: "angaben_fehlen",
      fehlend,
      version: BERECHNUNGSVERSION,
    };
  }
  const heute = e.heute ?? new Date().toISOString().slice(0, 10);
  const [von, bis, stand] = [text(r.von), text(r.bis), text(r.quellenStand)];
  if (!istTag(von) || !istTag(bis) || von > bis || bis > heute) {
    return nicht("messzeitraum_ungueltig");
  }
  if (!istTag(stand) || stand < bis || stand > heute) {
    return nicht("quellenstand_ungueltig");
  }
  const minutenDifferenz = faelle.reduce((s, f) => s + (f.minutenOhne - f.minutenMit), 0);
  const bruttoEur = Math.round((minutenDifferenz / 60) * satz * 100) / 100;
  return {
    lage: "berechnet",
    rahmen: { von, bis, kontext: text(r.kontext), quelle: text(r.quelle), quellenStand: stand },
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
