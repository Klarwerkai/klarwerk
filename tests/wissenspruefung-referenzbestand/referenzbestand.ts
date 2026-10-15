// ================================================================================================
// AUFNAHME 20260922 · REFERENZBESTAND-SOLLURTEILE (G3) — VORAB BENANNTE PAAR- UND MEHRFACHURTEILE.
// ================================================================================================
//
// Auftrag `aufnahme:20260922:referenzbestand-sollurteile` (Revision 1, Fachklärung). Meilenstein G3
// („Jedes verpflichtete Paar mit Kontext und tatsächlichem Ergebnis nachweisen · Zahlen, Einheiten,
// Varianten und Ausnahmen unterscheiden · Mehr-Aussagen-Konflikte gesondert prüfen; unklar bleibt
// offen"; Notizquelle `gespraech/wiki-start-20260915/VERTRAG-QUELLEN-VERSION-PRUEFSTAND.md`).
//
// WAS DIESE DATEI IST: ein kleiner Referenzbestand aus VORHANDENEN Quellen des Arbeitsbaums
// (Simulationskorpus, Demo-Korpus, Probe-Import, PX-17-Sollbestand). Jedes Urteil steht HIER mit
// Begründung und Herkunft, bevor irgendein Modell den Bestand sieht. Die Messung eines Modells gegen
// diese Urteile ist der gesonderte Auftrag `aufnahme:20260922:paarurteile-qualitaet`.
//
// WAS SIE NICHT IST: keine bestätigte Fachaussage. Jedes Urteil ist ein VORSCHLAG; bestätigt ist es
// erst, wenn Pedi (oder eine von Pedi benannte Fachperson) es mit Name, Datum und Beleg bestätigt.
// Diese Datei importiert nichts — auch nichts aus Reasoner, Konflikt- oder Dublettenerkennung —, und
// die Bestätigung darf keinen Modelllauf als Grundlage nennen (`referenzbestand.test.ts`, Teil U).
//
// Beschreibung und Fragen an Pedi: `docs/entscheidungen/wissenspruefung-referenzbestand.md`.

export const REFERENZBESTAND_FASSUNG = "RB-01-ENTWURF-v1";
export const REFERENZBESTAND_STAND = "2026-10-13";

export const ZUORDNUNG = {
  auftrag: "aufnahme:20260922:referenzbestand-sollurteile",
  revision: 1,
  meilenstein: "G3",
  notizquelle: "gespraech/wiki-start-20260915/VERTRAG-QUELLEN-VERSION-PRUEFSTAND.md",
  folgeauftrag: "aufnahme:20260922:paarurteile-qualitaet",
} as const;

/** Die drei Originalkriterien des Auftrags — wörtlich, unverändert. */
export const ORIGINALKRITERIEN = [
  "Quellen und erwartete Paar-/Mehrfachurteile sind mit fachlicher Begründung und Herkunft dokumentiert.",
  "Zahlen, Einheiten, Varianten, Ausnahmen und bewusst unklare Fälle sind vertreten.",
  "Sollurteile werden unabhängig vom zu testenden Modellergebnis bestätigt.",
] as const;

/**
 * Das erwartete fachliche Urteil über ein Paar:
 *   · `duplikat`     — dieselbe Aussage, ggf. anders formuliert, in anderer Sprache oder Notation.
 *   · `widerspruch`  — beide Aussagen gelten heute für denselben Gegenstand und schließen sich aus.
 *   · `variante`     — verwandte Aussagen, die sich heute nicht ausschließen (andere Geltung, anderer
 *                      Freigabestand); kein Befund, aber auch keine Dublette.
 *   · `kein_befund`  — keine fachliche Beziehung, die ein Prüfer melden müsste.
 *   · `offen`        — bewusst unklar: ohne Fachentscheidung ist weder Widerspruch noch Vereinbarkeit
 *                      belegt. Ein Prüfer, der hier fest urteilt, urteilt über die Quellen hinaus.
 */
export type Sollurteil = "duplikat" | "widerspruch" | "variante" | "kein_befund" | "offen";

export const SOLLURTEILE: readonly Sollurteil[] = [
  "duplikat",
  "widerspruch",
  "variante",
  "kein_befund",
  "offen",
];

/** Was ein Urteil fachlich schwer macht — die Abdeckungsmerkmale aus Kriterium 2 (plus Sprache). */
export type Merkmal = "zahl" | "einheit" | "variante" | "ausnahme" | "unklar" | "sprache";

export const MERKMALE: readonly Merkmal[] = [
  "zahl",
  "einheit",
  "variante",
  "ausnahme",
  "unklar",
  "sprache",
];

/** Wo die Quelle im Arbeitsbaum liegt. Der Text wird im Test aus genau dieser Stelle gelesen. */
export type Bestand =
  | "sim-korpus" // `SIM_CORPUS[].key`
  | "demo-korpus" // `DEMO_CORPUS[].pageId`, Sprache de
  | "probe-smoke" // Eintrag nach `title`
  | "px17-sollbestand"; // `QUELLEN[].quellId`

export const BESTANDSDATEI: Readonly<Record<Bestand, string>> = {
  "sim-korpus": "services/app/src/sim-corpus.ts",
  "demo-korpus": "tests/demo-korpus/demo-corpus.ts",
  "probe-smoke": "demo/testimports/kw-probe-smoke.de.json",
  "px17-sollbestand": "tests/beschaffung-px17/sollbestand.ts",
};

export interface Element {
  id: string;
  bestand: Bestand;
  /** Kennung in der Bestandsdatei (Schlüssel, pageId, Titel oder quellId). */
  schluessel: string;
  /** Kurzbezeichnung für Menschen; die Aussage selbst steht nur in der Quelle. */
  kurz: string;
}

export const ELEMENTE: readonly Element[] = [
  {
    id: "E-REIFEN-A",
    bestand: "probe-smoke",
    schluessel: "Auslieferung: Bereifung (A)",
    kurz: "4 Reifen (Ziffer)",
  },
  {
    id: "E-REIFEN-B",
    bestand: "probe-smoke",
    schluessel: "Auslieferung: Bereifung (B)",
    kurz: "vier Reifen (Wort)",
  },
  {
    id: "E-KAFFEE",
    bestand: "probe-smoke",
    schluessel: "Kaffeeküche: Reinigung",
    kurz: "Kaffeeküche freitags",
  },
  {
    id: "E-WARN-BLAU",
    bestand: "demo-korpus",
    schluessel: "kwdemo-warnfarbe-blau",
    kurz: "Warnschilder Halle 7 blau",
  },
  {
    id: "E-WARN-ROT",
    bestand: "demo-korpus",
    schluessel: "kwdemo-warnfarbe-rot",
    kurz: "Warnschilder Halle 7 Rot",
  },
  {
    id: "E-BACKUP-TAG",
    bestand: "demo-korpus",
    schluessel: "kwdemo-backup-taeglich",
    kurz: "Backup täglich",
  },
  {
    id: "E-BACKUP-WOCHE",
    bestand: "demo-korpus",
    schluessel: "kwdemo-backup-woechentlich",
    kurz: "Backup nur wöchentlich",
  },
  {
    id: "E-NACHLAUF-DE",
    bestand: "sim-korpus",
    schluessel: "p-nachlauf-de",
    kurz: "MK-5 Kühlung 30 Minuten",
  },
  {
    id: "E-NACHLAUF-EN",
    bestand: "sim-korpus",
    schluessel: "p-nachlauf-en",
    kurz: "MK-5 cooling 10 minutes",
  },
  {
    id: "E-RK8-DE",
    bestand: "sim-korpus",
    schluessel: "v-rueckschlag-de",
    kurz: "RK-8 alle 12 Monate (Hersteller)",
  },
  {
    id: "E-RK8-NL",
    bestand: "sim-korpus",
    schluessel: "v-rueckschlag-nl",
    kurz: "RK-8 elke 6 maanden (Praxis)",
  },
  {
    id: "E-KETTE-DE",
    bestand: "sim-korpus",
    schluessel: "w-kette-de",
    kurz: "KF-2 vor jeder Schicht",
  },
  {
    id: "E-KETTE-EN",
    bestand: "sim-korpus",
    schluessel: "w-kette-en",
    kurz: "KF-2 only every 200 h",
  },
  {
    id: "E-SV200-DE",
    bestand: "sim-korpus",
    schluessel: "v-sicherheitsventil-de",
    kurz: "SV-200 11,5 bar",
  },
  {
    id: "E-SV200-EN",
    bestand: "sim-korpus",
    schluessel: "v-sicherheitsventil-en",
    kurz: "SV-200 11.5 bar",
  },
  {
    id: "E-DP3-DE",
    bestand: "sim-korpus",
    schluessel: "p-dichtung-de",
    kurz: "DP-3 alle 8.000 h",
  },
  {
    id: "E-DP3-EN",
    bestand: "sim-korpus",
    schluessel: "p-dichtung-en",
    kurz: "DP-3 every 8,000 h",
  },
  {
    id: "E-FILTER-DE",
    bestand: "sim-korpus",
    schluessel: "w-filter-de",
    kurz: "HP-1 Filter bei 2,5 bar",
  },
  {
    id: "E-KP110-DE",
    bestand: "sim-korpus",
    schluessel: "p-entlueften-de",
    kurz: "KP-110 vor Anfahren entlüften",
  },
  {
    id: "E-KP110-DUBL",
    bestand: "sim-korpus",
    schluessel: "p-entlueften-dublette-de",
    kurz: "KP-110 nie unentlüftet starten",
  },
  {
    id: "E-LECK-DE",
    bestand: "sim-korpus",
    schluessel: "w-druckluft-de",
    kurz: "3-mm-Leckage 2.000 Euro",
  },
  {
    id: "E-LECK-EN",
    bestand: "sim-korpus",
    schluessel: "w-druckluft-en",
    kurz: "3 mm leak 2,000 euros",
  },
  {
    id: "E-AS40-DE",
    bestand: "sim-korpus",
    schluessel: "v-schieber-de",
    kurz: "AS-40 nur AUF oder ZU",
  },
  {
    id: "E-AS40-EN",
    bestand: "sim-korpus",
    schluessel: "v-schieber-en",
    kurz: "AS-40 fully OPEN or CLOSED",
  },
  {
    id: "E-AS40-NL",
    bestand: "sim-korpus",
    schluessel: "v-schieber-nl",
    kurz: "AS-40 volledig OPEN of DICHT",
  },
  {
    id: "E-AS40-DUBL",
    bestand: "sim-korpus",
    schluessel: "v-schieber-dublette-en",
    kurz: "AS-40 do not throttle",
  },
  {
    id: "E-PX-PB",
    bestand: "px17-sollbestand",
    schluessel: "BES-PX17-PB",
    kurz: "PB-1 Innenmaß 120 × 80 × 40 mm",
  },
  {
    id: "E-PX-MB",
    bestand: "px17-sollbestand",
    schluessel: "BES-PX17-MB-BETA",
    kurz: "Beta-Maßblatt 125 × 80 × 40 mm",
  },
  {
    id: "E-PX-V2",
    bestand: "px17-sollbestand",
    schluessel: "BES-PX17-V2",
    kurz: "Vorgabe V2 80 % (heute)",
  },
  {
    id: "E-PX-V3",
    bestand: "px17-sollbestand",
    schluessel: "BES-PX17-V3",
    kurz: "Vorgabe V3 90 % (ab 2027)",
  },
  {
    id: "E-PX-D2",
    bestand: "px17-sollbestand",
    schluessel: "BES-PX17-D2",
    kurz: "Design D2 mit Fenster (abgelöst)",
  },
  {
    id: "E-PX-D3",
    bestand: "px17-sollbestand",
    schluessel: "BES-PX17-D3",
    kurz: "Design D3 (freigegeben)",
  },
  {
    id: "E-PX-D4",
    bestand: "px17-sollbestand",
    schluessel: "BES-PX17-D4",
    kurz: "Design D4 (Entwurf)",
  },
];

/** Eine Wertstelle: das wörtliche Stück der Aussage, an dem das Urteil hängt. */
export interface Wertstelle {
  element: string;
  text: string;
}

/**
 * Bestätigung eines Sollurteils. `vorgeschlagen` ist der Stand dieser Fassung. `bestaetigt` und
 * `abgelehnt` verlangen eine Person, ein Datum und einen Beleg (Gesprächsnotiz, Protokoll) — nie
 * einen Modelllauf.
 */
export type Bestaetigung =
  | { stand: "vorgeschlagen" }
  | { stand: "bestaetigt"; durch: string; am: string; beleg: string }
  | { stand: "abgelehnt"; durch: string; am: string; beleg: string; ersatz: Sollurteil };

const VORGESCHLAGEN: Bestaetigung = { stand: "vorgeschlagen" };

export interface Paarurteil {
  a: string;
  b: string;
  soll: Sollurteil;
  begruendung: string;
}

export interface Fall {
  id: string;
  art: "paar" | "mehrfach";
  /** Alle beteiligten Elemente; bei `mehrfach` mindestens drei. */
  elemente: readonly string[];
  /** Je ungeordnetem Paar der Elemente genau ein Urteil. */
  paare: readonly Paarurteil[];
  merkmale: readonly Merkmal[];
  wertstellen: readonly Wertstelle[];
  /** Woher das Urteil kommt: vorhandene Sollangabe der Quelle oder fachliche Lesart dieses Bestands. */
  herkunft: string;
  bestaetigung: Bestaetigung;
}

function paar(
  id: string,
  a: string,
  b: string,
  soll: Sollurteil,
  begruendung: string,
  rest: { merkmale: Merkmal[]; wertstellen?: Wertstelle[]; herkunft: string },
): Fall {
  return {
    id,
    art: "paar",
    elemente: [a, b],
    paare: [{ a, b, soll, begruendung }],
    merkmale: rest.merkmale,
    wertstellen: rest.wertstellen ?? [],
    herkunft: rest.herkunft,
    bestaetigung: VORGESCHLAGEN,
  };
}

const W = (element: string, text: string): Wertstelle => ({ element, text });

export const FAELLE: readonly Fall[] = [
  paar(
    "RB-01",
    "E-REIFEN-A",
    "E-REIFEN-B",
    "duplikat",
    "Dieselbe Aussage über dieselbe Sache; „4“ als Ziffer und „vier“ als Wort sind derselbe Wert, „jedes auto“ und „Alle autos“ dieselbe Allaussage.",
    {
      merkmale: ["zahl", "variante"],
      wertstellen: [W("E-REIFEN-A", "4 reifen"), W("E-REIFEN-B", "vier reifen")],
      herkunft:
        "Erwartung „Duplikat“ (reifen-Paar) in demo/testimports/README.md, Abschnitt 3; fachlich übernommen.",
    },
  ),
  paar(
    "RB-02",
    "E-WARN-BLAU",
    "E-WARN-ROT",
    "widerspruch",
    "Beide regeln die Farbe aller Warnschilder in Halle 7; „müssen blau“ und „ausschließlich in Rot“ können nicht zugleich gelten.",
    {
      merkmale: [],
      wertstellen: [W("E-WARN-BLAU", "blau"), W("E-WARN-ROT", "ausschließlich in Rot")],
      herkunft:
        "Eingebautes Konfliktpaar `warnfarbe` (blau ↔ Rot) in tests/demo-korpus/demo-corpus.ts; fachlich übernommen.",
    },
  ),
  paar(
    "RB-03",
    "E-BACKUP-TAG",
    "E-BACKUP-WOCHE",
    "widerspruch",
    "Gleicher Gegenstand (Rhythmus der Datenbackups); „täglich“ und „nur wöchentlich“ schließen sich durch das „nur“ aus.",
    {
      merkmale: [],
      wertstellen: [W("E-BACKUP-TAG", "täglich"), W("E-BACKUP-WOCHE", "nur wöchentlich")],
      herkunft:
        "Eingebautes Konfliktpaar Rhythmus (täglich ↔ wöchentlich) in tests/demo-korpus/demo-corpus.ts; fachlich übernommen.",
    },
  ),
  paar(
    "RB-04",
    "E-NACHLAUF-DE",
    "E-NACHLAUF-EN",
    "widerspruch",
    "Dieselbe Pumpe MK-5, dieselbe Maßnahme (Kühlung nach Abschalten). 30 gegen 10 Minuten, und die englische Fassung lehnt längere Nachläufe ausdrücklich ab — sprachübergreifender Zahlenwiderspruch.",
    {
      merkmale: ["zahl", "einheit", "sprache"],
      wertstellen: [W("E-NACHLAUF-DE", "30 Minuten"), W("E-NACHLAUF-EN", "10 minutes")],
      herkunft:
        "Kommentar „GEWOLLTER KONFLIKT“ (30 ↔ 10 Minuten) in services/app/src/sim-corpus.ts; fachlich übernommen.",
    },
  ),
  paar(
    "RB-05",
    "E-RK8-DE",
    "E-RK8-NL",
    "offen",
    "Gleiches Ventil, 12 gegen 6 Monate. Ein 6-Monats-Rhythmus hält das 12-Monats-Intervall ein; widersprüchlich ist das Paar nur, wenn „alle 12 Monate“ als festes Intervall gemeint ist. Ob die Praxisbeobachtung (NL) die Herstellerfreigabe (DE) ablöst oder als strengere Hausregel daneben steht, ist eine Fachentscheidung.",
    {
      merkmale: ["zahl", "einheit", "unklar", "sprache"],
      wertstellen: [W("E-RK8-DE", "alle 12 Monate"), W("E-RK8-NL", "elke 6 maanden")],
      herkunft:
        "Abweichung vom Korpuskommentar „GEWOLLTER KONFLIKT“ in services/app/src/sim-corpus.ts: dieser Bestand schlägt „offen“ vor (Frage F1 an Pedi).",
    },
  ),
  paar(
    "RB-06",
    "E-KETTE-DE",
    "E-KETTE-EN",
    "widerspruch",
    "Dieselbe Kette KF-2. Die Bezugsgrößen sind verschieden (Schicht gegen Betriebsstunden) und nicht umrechenbar; der Widerspruch folgt aus „only every 200 operating hours“ und der Begründung gegen häufigeres Ölen, nicht aus einem Zahlenvergleich.",
    {
      merkmale: ["zahl", "einheit", "sprache"],
      wertstellen: [
        W("E-KETTE-DE", "vor jeder Schicht"),
        W("E-KETTE-EN", "only every 200 operating hours"),
      ],
      herkunft:
        "Kommentar „GEWOLLTER KONFLIKT“ (Schicht ↔ 200 h) in services/app/src/sim-corpus.ts; Begründung dieses Bestands.",
    },
  ),
  paar(
    "RB-07",
    "E-SV200-DE",
    "E-SV200-EN",
    "duplikat",
    "Gleiche Aussage in zwei Sprachen. „11,5 bar“ und „11.5 bar“ sind derselbe Wert in deutscher und englischer Dezimalschreibweise — kein Zahlenwiderspruch.",
    {
      merkmale: ["zahl", "einheit", "variante", "sprache"],
      wertstellen: [W("E-SV200-DE", "11,5 bar"), W("E-SV200-EN", "11.5 bar")],
      herkunft:
        "Drilling `v-sicherheitsventil` (Kommentar „Cross-Sprach-Duplikate“) in services/app/src/sim-corpus.ts; fachlich übernommen.",
    },
  ),
  paar(
    "RB-08",
    "E-DP3-DE",
    "E-DP3-EN",
    "duplikat",
    "Gleiche Aussage in zwei Sprachen. „8.000“ (deutscher Tausenderpunkt) und „8,000“ (englisches Tausenderkomma) sind beide 8000 Stunden; wer die Trennzeichen falsch liest, sieht 8 gegen 8000.",
    {
      merkmale: ["zahl", "einheit", "variante", "sprache"],
      wertstellen: [W("E-DP3-DE", "8.000 Betriebsstunden"), W("E-DP3-EN", "8,000 operating")],
      herkunft:
        "Drilling `p-dichtung` (DE/EN/NL) in services/app/src/sim-corpus.ts; Begründung der Trennzeichen dieses Bestands.",
    },
  ),
  paar(
    "RB-09",
    "E-FILTER-DE",
    "E-SV200-DE",
    "kein_befund",
    "Beide nennen einen Druck in bar, aber für verschiedene Gegenstände und Größen: Differenzdruck am Hydraulikfilter der Presse HP-1 gegen Ansprechdruck des Sicherheitsventils SV-200. Gleiche Einheit ist kein gemeinsamer Gegenstand.",
    {
      merkmale: ["zahl", "einheit"],
      wertstellen: [W("E-FILTER-DE", "2,5 bar Differenzdruck"), W("E-SV200-DE", "11,5 bar")],
      herkunft:
        "Fachliche Lesart dieses Bestands (Gegenprobe; in services/app/src/sim-corpus.ts nicht als Paar benannt).",
    },
  ),
  paar(
    "RB-10",
    "E-KAFFEE",
    "E-REIFEN-A",
    "kein_befund",
    "Keine gemeinsame Sache (Reinigung der Kaffeeküche gegen Bereifung bei Auslieferung).",
    {
      merkmale: [],
      herkunft:
        "Kontrollseite Kaffeeküche „bleibt ohne Befund“ in demo/testimports/README.md, Abschnitt 3; fachlich übernommen.",
    },
  ),
  paar(
    "RB-11",
    "E-KP110-DE",
    "E-KP110-DUBL",
    "duplikat",
    "Gleiche Regel für die KP-110, einmal als Gebot („vor jedem Anfahren entlüften“), einmal als Verbot („darf nie ohne Entlüftung anlaufen“); dieselbe Begründung (Gleitringdichtung in Minuten zerstört).",
    {
      merkmale: ["variante"],
      wertstellen: [
        W("E-KP110-DE", "vor jedem Anfahren"),
        W("E-KP110-DUBL", "darf nie ohne Entlüftung anlaufen"),
      ],
      herkunft:
        "Kommentar „Sprachinterne NAHE DUBLETTE“ in services/app/src/sim-corpus.ts; fachlich übernommen (Gebot ↔ Verbot).",
    },
  ),
  paar(
    "RB-12",
    "E-PX-V2",
    "E-PX-V3",
    "variante",
    "80 % gegen 90 % Altpapier — aber V3 gilt erst ab 01.03.2027. Heute gilt V2; die Geltungsausnahme macht aus dem Zahlenunterschied keinen heutigen Widerspruch. Ab Geltung löst V3 V2 ab.",
    {
      merkmale: ["zahl", "einheit", "ausnahme"],
      wertstellen: [
        W("E-PX-V2", "mindestens 80 % Altpapier"),
        W("E-PX-V3", "gültig erst ab 01.03.2027"),
      ],
      herkunft:
        "Sollurteile `verwendbar_nach_fachpruefung` (V2) und `nicht_heute_gueltig` (V3) in tests/beschaffung-px17/sollbestand.ts.",
    },
  ),
  paar(
    "RB-13",
    "E-PX-PB",
    "E-PX-MB",
    "widerspruch",
    "Innenmaß derselben Schachtel: 120 gegen 125 mm in der ersten Abmessung, die übrigen gleich. Keine Rundungs- oder Toleranzangabe in den Quellen, die beides vereinbar machte.",
    {
      merkmale: ["zahl", "einheit"],
      wertstellen: [W("E-PX-PB", "120 × 80 × 40 mm"), W("E-PX-MB", "125 × 80 × 40 mm")],
      herkunft:
        "Sollurteil `klaeren` und Fall BES-F-WIDERSPRUCH in tests/beschaffung-px17/sollbestand.ts; fachlich übernommen.",
    },
  ),
  paar(
    "RB-14",
    "E-PX-D3",
    "E-PX-D4",
    "variante",
    "Zwei Fassungen desselben Druckdesigns. D4 ist jünger, aber Entwurf; heute gilt D3. Abweichende Gestaltung ist kein Widerspruch, solange D4 nicht freigegeben ist.",
    {
      merkmale: ["variante", "ausnahme"],
      wertstellen: [W("E-PX-D4", "Noch nicht freigegeben")],
      herkunft:
        "Sollurteile `verwendbar_nach_fachpruefung` (D3) und `nicht_heute_gueltig` (D4) in tests/beschaffung-px17/sollbestand.ts.",
    },
  ),
  paar(
    "RB-15",
    "E-LECK-DE",
    "E-LECK-EN",
    "duplikat",
    "Gleiche Aussage in zwei Sprachen; „3-mm-Leckage“ und „3 mm leak“ sowie „rund 2.000 Euro“ und „about 2,000 euros“ sind dieselben Werte in anderer Schreibweise.",
    {
      merkmale: ["zahl", "einheit", "variante", "sprache"],
      wertstellen: [
        W("E-LECK-DE", "3-mm-Leckage"),
        W("E-LECK-EN", "3 mm leak"),
        W("E-LECK-DE", "2.000 Euro"),
        W("E-LECK-EN", "2,000 euros"),
      ],
      herkunft:
        "Drilling `w-druckluft` (Kommentar „Cross-Sprach-Duplikate“) in services/app/src/sim-corpus.ts; fachlich übernommen.",
    },
  ),
  {
    id: "RB-M1",
    art: "mehrfach",
    elemente: ["E-AS40-DE", "E-AS40-EN", "E-AS40-NL", "E-AS40-DUBL"],
    paare: [
      {
        a: "E-AS40-DE",
        b: "E-AS40-EN",
        soll: "duplikat",
        begruendung: "Gleiche Regel, Übersetzung.",
      },
      {
        a: "E-AS40-DE",
        b: "E-AS40-NL",
        soll: "duplikat",
        begruendung: "Gleiche Regel, Übersetzung.",
      },
      {
        a: "E-AS40-EN",
        b: "E-AS40-NL",
        soll: "duplikat",
        begruendung: "Gleiche Regel, Übersetzung.",
      },
      {
        a: "E-AS40-DE",
        b: "E-AS40-DUBL",
        soll: "duplikat",
        begruendung:
          "„nur AUF oder ZU“ und „Do not throttle … fully open or fully closed“ sind dieselbe Regel; Sprache und Satzbau verschieden.",
      },
      {
        a: "E-AS40-EN",
        b: "E-AS40-DUBL",
        soll: "duplikat",
        begruendung: "Gleiche Sprache, gleiche Regel, andere Formulierung.",
      },
      {
        a: "E-AS40-NL",
        b: "E-AS40-DUBL",
        soll: "duplikat",
        begruendung: "Gleiche Regel, andere Sprache und Formulierung.",
      },
    ],
    merkmale: ["variante", "sprache"],
    wertstellen: [W("E-AS40-DE", "nur AUF oder ZU"), W("E-AS40-DUBL", "Do not throttle")],
    herkunft:
      "Drilling `v-schieber` und Kommentar „Nahe EN-Dublette“ in services/app/src/sim-corpus.ts. Die Gruppe ist EINE Dublettengruppe aus vier Aussagen, nicht vier Einzelbefunde.",
    bestaetigung: VORGESCHLAGEN,
  },
  {
    id: "RB-M2",
    art: "mehrfach",
    elemente: ["E-PX-V2", "E-PX-V3", "E-PX-D2"],
    paare: [
      {
        a: "E-PX-V2",
        b: "E-PX-V3",
        soll: "variante",
        begruendung: "Wie RB-12: V3 gilt erst ab 01.03.2027.",
      },
      {
        a: "E-PX-V2",
        b: "E-PX-D2",
        soll: "kein_befund",
        begruendung:
          "D2 nennt ein Kunststofffenster, V2 verbietet es. D2 ist aber abgelöst (seit D3, 20.08.2026); ein Widerspruch zum Altstand ist kein heutiger Befund.",
      },
      {
        a: "E-PX-V3",
        b: "E-PX-D2",
        soll: "kein_befund",
        begruendung:
          "Künftige Vorgabe gegen abgelösten Altstand: keine gemeinsame Geltung, also kein heutiger Befund.",
      },
    ],
    merkmale: ["zahl", "einheit", "ausnahme"],
    wertstellen: [
      W("E-PX-V2", "mindestens 80 % Altpapier"),
      W("E-PX-V3", "mindestens 90 % Altpapieranteil"),
      W("E-PX-D2", "mit Kunststofffenster"),
      W("E-PX-V2", "ohne Kunststofffenster"),
    ],
    herkunft:
      "Freigabestände `freigegeben`/`zukuenftig`/`abgeloest` in tests/beschaffung-px17/sollbestand.ts; Gruppenurteil dieses Bestands. Ein reiner Textvergleich sähe V2 ↔ D2 als Widerspruch.",
    bestaetigung: VORGESCHLAGEN,
  },
];

/** Offene Fragen an Pedi, die über diesen Entwurf entscheiden (Dokument, Abschnitt 4). */
export const FRAGEN_AN_PEDI = [
  {
    id: "F1",
    fall: "RB-05",
    frage:
      "RK-8: Ist „alle 12 Monate“ ein festes oder ein Höchstintervall, und ersetzt die Praxisbeobachtung (6 Monate) die Herstellerfreigabe? Bis dahin bleibt das Paar „offen“.",
  },
  {
    id: "F2",
    fall: "RB-M2",
    frage:
      "Soll ein Widerspruch zu einem abgelösten Stand (D2) als „kein Befund“ gelten oder als eigener historischer Hinweis gemeldet werden?",
  },
  {
    id: "F3",
    fall: null,
    frage:
      "Die vorhandenen Quellen enthalten keinen echten Widerspruch zwischen drei Aussagen und kein Paar mit gleichem Wert in verschiedenen Einheiten (z. B. bar ↔ kPa). Sollen solche Fälle mit Pedi neu formuliert werden? Dieser Entwurf erfindet sie nicht.",
  },
  {
    id: "F4",
    fall: null,
    frage:
      "Wer bestätigt die Urteile (Pedi selbst oder eine benannte Fachperson), und in welchem Beleg (Gesprächsnotiz unter gespraech/wissenspruefung-referenzbestand)?",
  },
] as const;

export function element(id: string): Element {
  const e = ELEMENTE.find((x) => x.id === id);
  if (!e) {
    throw new Error(`Unbekanntes Referenzelement ${id}`);
  }
  return e;
}

/** Alle Paarurteile über alle Fälle, flach. */
export function allePaarurteile(): Paarurteil[] {
  return FAELLE.flatMap((f) => [...f.paare]);
}
