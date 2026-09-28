// ================================================================================================
// AUFNAHME 20260922 · SUCHSICHTBARKEIT BEI UNVOLLSTÄNDIGEN ALTDATEN — DER EINE SAATPLAN.
// ================================================================================================
//
// Die Zusatzfälle aus BEN 4359, getrennt vom abgeschlossenen SQL-Trim-Vertrag (BASIC 380) und vom
// Suchdeckelvertrag (JOB 4303/4359): fehlende/ungültige Altstufe, leerer Autor, `deletedAt` als
// Leerstring. Beide Prüfungen lesen NUR diesen Plan:
//
//   · `suchsichtbarkeit-altbestand-regel.test.ts`      — die Regel selbst, ohne Datenbank (schnelles Tor)
//   · `suchsichtbarkeit-altbestand-paritaet.integration.test.ts` — Speicher gegen echtes PostgreSQL
//
// ZUORDNUNG ZU DEN BESTEHENDEN PARITÄTSFÄLLEN (vor dieser Aufnahme):
//
//   Altfall                         | 380 (`listForSearch`/`list`) | 4359 (`findSearchHits`, Deckel)
//   --------------------------------|------------------------------|--------------------------------
//   Stufe fehlt                     | ja (STUFEN[0] = undefined)   | nein
//   Stufe null/leer/ungültig/Typ    | nein                         | nein
//   Autor ""                        | ja (AUTOREN[2])              | nein
//   Autor fehlt / null / " "        | nein                         | nein
//   Autor kein String               | nein                         | nein
//   Betrachter ohne Kennung         | ja (nur Autor "")            | nein
//   deletedAt ""                    | nein (nur benannt, sichtbarkeit.ts (3)) | nein
//   deletedAt null                  | nein                         | nein
//
// DIE REGEL STEHT VOR DER PRÜFUNG FEST (Feld `regel`) und ist die BESTEHENDE, nicht eine neue:
//
//   · Stufe: nur die Zeichenfolgen „vertraulich" und „streng_vertraulich" sind vertraulich; alles
//     andere — fehlend, null, leer, andere Schreibweise, anderer Typ — gilt als „intern"
//     (`isConfidential`/`normalizeConfidentiality`, confidentiality.ts; sichtbarkeit.ts:39-43).
//     Das ist KEINE Legitimierung durch diese Prüfung, sondern die dort benannte Grenze. Sie ist
//     hier fallweise festgehalten, damit eine Änderung an ihr sichtbar rot wird.
//   · Autor: Autorschaft nur bei einer NICHTLEEREN ZEICHENFOLGE, die gleich der Betrachterkennung
//     ist (`darfSehen`, sichtbarkeit.ts:74-76). Fehlend, null, leer, anderer Typ: keine Autorschaft.
//   · Papierkorb: die Referenz ist `!deletedAt` (`trifftZu`). Wo PostgreSQL nach Lesart des Codes
//     davon abweichen dürfte, steht das als HYPOTHESE im Plan (`ABWEICHUNGSHYPOTHESEN`) — mit
//     Datenfixture und Rollenbezug, ausdrücklich ungemessen.
import type { Confidentiality } from "../../services/knowledge-object";

export const BEGRIFF_ALT = "quarzwendel";
/** Die Hypothesenfälle tragen einen eigenen Begriff, damit sie die regelkonforme Parität nicht färben. */
export const BEGRIFF_BEFUND = "tuffkammer";

export const ANNA = "uanna20260922";
const BERT = "ubert20260922";
const CARL = "ucarl20260922";
/** Eine Betrachterkennung, die als Text genau dem Zahlenautor der Hypothese A1 entspricht. */
export const ZAHLKENNUNG = "4359";
/** Ein Betrachter ohne Kennung — er darf an einem leeren Autor keine Autorschaft finden. */
export const OHNE_KENNUNG = "";

export const BETRACHTER: readonly string[] = [ANNA, BERT, ZAHLKENNUNG, OHNE_KENNUNG];

type AltFeld = "confidentiality" | "author" | "deletedAt";

/** Die Altform: ein Feld wird entfernt oder roh überschrieben — so, wie es eine Altzeile trägt. */
export type Altform =
  | { readonly feld: AltFeld; readonly entfernt: true }
  | { readonly feld: AltFeld; readonly wert: unknown };

/**
 * Wer das Objekt nach der BESTEHENDEN Regel sieht:
 *   `jeder`         — jede Rolle, jeder Betrachter
 *   `nurValidate`   — nur `ko.validate` (controller/admin)
 *   `validateOderAnna` — `ko.validate` oder ANNA als Autorin
 */
export type Regel = "jeder" | "nurValidate" | "validateOderAnna";

export interface AltSaat {
  readonly marke: string;
  readonly begriff: string;
  /** Anlage über den echten Produktweg … */
  readonly autor: string;
  readonly stufe: Confidentiality;
  readonly trust: number;
  /** … danach die Altform, roh über `KoRepo.update` in beide Ablagen geschrieben. */
  readonly altform?: Altform;
  readonly regel: Regel;
  /** Woher die Regel für diesen Fall stammt — Fundstelle im Code. */
  readonly quelle: string;
}

export const BESTAND: readonly AltSaat[] = [
  // ── Autor-Altfälle: vertraulich, Autorfeld unbrauchbar. Höchster Trust, damit sie ohne Trim den
  //    Deckel füllen würden (die Lage aus JOB 4271).
  {
    marke: "autorLeer",
    begriff: BEGRIFF_ALT,
    autor: CARL,
    stufe: "vertraulich",
    trust: 99,
    altform: { feld: "author", wert: "" },
    regel: "nurValidate",
    quelle: "sichtbarkeit.ts:74-76",
  },
  {
    marke: "autorFehlt",
    begriff: BEGRIFF_ALT,
    autor: CARL,
    stufe: "vertraulich",
    trust: 98,
    altform: { feld: "author", entfernt: true },
    regel: "nurValidate",
    quelle: "sichtbarkeit.ts:74-76",
  },
  {
    marke: "autorNull",
    begriff: BEGRIFF_ALT,
    autor: CARL,
    stufe: "vertraulich",
    trust: 97,
    altform: { feld: "author", wert: null },
    regel: "nurValidate",
    quelle: "sichtbarkeit.ts:74-76",
  },
  {
    marke: "autorLeerzeichen",
    begriff: BEGRIFF_ALT,
    autor: CARL,
    stufe: "vertraulich",
    trust: 96,
    altform: { feld: "author", wert: " " },
    // Ein Leerzeichen ist nicht leer — aber gleich keiner der Betrachterkennungen hier.
    regel: "nurValidate",
    quelle: "sichtbarkeit.ts:74-76",
  },
  {
    marke: "kontrolleVertraulich",
    begriff: BEGRIFF_ALT,
    autor: CARL,
    stufe: "vertraulich",
    trust: 95,
    regel: "nurValidate",
    quelle: "sichtbarkeit.ts:67-77",
  },
  {
    marke: "eigenVertraulich",
    begriff: BEGRIFF_ALT,
    autor: ANNA,
    stufe: "vertraulich",
    trust: 90,
    regel: "validateOderAnna",
    quelle: "sichtbarkeit.ts:74-76",
  },
  // ── Stufen-Altfälle: vertraulich angelegt, dann roh überschrieben. Nach bestehender Regel
  //    „intern" — die benannte Grenze aus sichtbarkeit.ts:39-43.
  {
    marke: "stufeFehlt",
    begriff: BEGRIFF_ALT,
    autor: CARL,
    stufe: "vertraulich",
    trust: 89,
    altform: { feld: "confidentiality", entfernt: true },
    regel: "jeder",
    quelle: "confidentiality.ts:4 (fehlendes Feld = intern)",
  },
  {
    marke: "stufeNull",
    begriff: BEGRIFF_ALT,
    autor: CARL,
    stufe: "vertraulich",
    trust: 88,
    altform: { feld: "confidentiality", wert: null },
    regel: "jeder",
    quelle: "confidentiality.ts isConfidential",
  },
  {
    marke: "stufeLeer",
    begriff: BEGRIFF_ALT,
    autor: CARL,
    stufe: "vertraulich",
    trust: 87,
    altform: { feld: "confidentiality", wert: "" },
    regel: "jeder",
    quelle: "confidentiality.ts isConfidential",
  },
  {
    marke: "stufeGrossschreibung",
    begriff: BEGRIFF_ALT,
    autor: CARL,
    stufe: "vertraulich",
    trust: 86,
    altform: { feld: "confidentiality", wert: "Vertraulich" },
    regel: "jeder",
    quelle: "confidentiality.ts isConfidential (zeichengenau)",
  },
  {
    marke: "stufeUnbekannt",
    begriff: BEGRIFF_ALT,
    autor: CARL,
    stufe: "vertraulich",
    trust: 85,
    altform: { feld: "confidentiality", wert: "geheim" },
    regel: "jeder",
    quelle: "sichtbarkeit.ts:39-43",
  },
  {
    marke: "stufeZahl",
    begriff: BEGRIFF_ALT,
    autor: CARL,
    stufe: "vertraulich",
    trust: 84,
    altform: { feld: "confidentiality", wert: 2 },
    regel: "jeder",
    quelle: "confidentiality.ts isConfidential",
  },
  {
    marke: "stufeListe",
    begriff: BEGRIFF_ALT,
    autor: CARL,
    stufe: "vertraulich",
    trust: 83,
    altform: { feld: "confidentiality", wert: ["vertraulich"] },
    regel: "jeder",
    quelle: "confidentiality.ts isConfidential",
  },
  {
    marke: "kontrolleIntern",
    begriff: BEGRIFF_ALT,
    autor: CARL,
    stufe: "intern",
    trust: 80,
    regel: "jeder",
    quelle: "sichtbarkeit.ts:67-70",
  },
  // ── Hypothesenfälle: eigener Begriff. `regel` ist die Referenz (`trifftZu` = `!deletedAt &&
  //    darfSehen`) und zugleich die Abnahmeerwartung an PostgreSQL. Die aus dem Code abgeleitete,
  //    noch ungemessene Abweichung steht in `ABWEICHUNGSHYPOTHESEN` unten.
  {
    marke: "befundAutorZahl",
    begriff: BEGRIFF_BEFUND,
    autor: CARL,
    stufe: "vertraulich",
    trust: 79,
    altform: { feld: "author", wert: 4359 },
    regel: "nurValidate",
    quelle: "sichtbarkeit.ts:76 (typeof author === 'string')",
  },
  {
    marke: "befundGeloeschtLeer",
    begriff: BEGRIFF_BEFUND,
    autor: CARL,
    stufe: "intern",
    trust: 78,
    altform: { feld: "deletedAt", wert: "" },
    regel: "jeder",
    quelle: "sichtbarkeit.ts:204 (!ko.deletedAt), benannt in (3)",
  },
  {
    marke: "befundGeloeschtNull",
    begriff: BEGRIFF_BEFUND,
    autor: CARL,
    stufe: "intern",
    trust: 77,
    altform: { feld: "deletedAt", wert: null },
    regel: "jeder",
    quelle: "sichtbarkeit.ts:204 (!ko.deletedAt)",
  },
  {
    marke: "befundKontrolle",
    begriff: BEGRIFF_BEFUND,
    autor: CARL,
    stufe: "intern",
    trust: 76,
    regel: "jeder",
    quelle: "sichtbarkeit.ts:67-70",
  },
];

/**
 * ABGELEITETE ABWEICHUNGSHYPOTHESEN — AUS DEM CODE GELESEN, NOCH NICHT GEGEN POSTGRESQL GEMESSEN.
 *
 * Stand dieser Aufnahme: kein Lauf gegen eine echte Datenbank (lokaler Docker-Daemon ohne Antwort,
 * kein freigegebener Integrationsweg für diesen Arbeitsbaum). Jede Zeile hier ist deshalb eine
 * Vorhersage mit Herleitung, KEIN Messbeleg. Die Integrationstests erwarten sie NICHT: dort wird
 * für jeden dieser Fälle die Kriterienparität strikt verlangt. Trifft eine Hypothese zu, wird
 * genau ihr Abnahmefall rot, und die Meldung nennt Fixture, Betrachter, Rolle und diese Herleitung
 * — das ist die Reproduktion. Behoben wird hier nichts (Änderung am abgeschlossenen
 * Trim-/Suchvertrag, nicht Teil dieser Aufnahme).
 *
 *   `pgZeigt` — PostgreSQL liefert das Objekt vermutlich, die Referenz nicht (fail-OPEN, ein Leck).
 *   `pgVerbirgt` — PostgreSQL verbirgt vermutlich, die Referenz zeigt (fail-closed, falscher Zählwert).
 */
export interface Abweichungshypothese {
  readonly kennung: string;
  readonly marke: string;
  readonly stand: "abgeleitet, ungemessen";
  readonly richtung: "pgZeigt" | "pgVerbirgt";
  /** Für welche Betrachter die Abweichung erwartet wird: nur ohne `ko.validate` oder für jede Rolle. */
  readonly betrifft: { readonly kennung: string; readonly nurOhneValidate: boolean } | "jeder";
  readonly herleitung: string;
}

export const ABWEICHUNGSHYPOTHESEN: readonly Abweichungshypothese[] = [
  {
    kennung: "A1",
    marke: "befundAutorZahl",
    stand: "abgeleitet, ungemessen",
    richtung: "pgZeigt",
    betrifft: { kennung: ZAHLKENNUNG, nurOhneValidate: true },
    herleitung:
      "author_key = data->>'author' (repo-pg.ts KO_SICHTBARKEIT_SCHEMA) macht aus der JSON-Zahl 4359 " +
      "den Text '4359'; der SQL-Trim vergleicht ihn mit der Betrachterkennung, `darfSehen` verlangt typeof string.",
  },
  {
    kennung: "A2",
    marke: "befundGeloeschtLeer",
    stand: "abgeleitet, ungemessen",
    richtung: "pgVerbirgt",
    betrifft: "jeder",
    herleitung:
      "deleted_at_key IS NULL scheitert an '' und der Such-JOIN prüft NOT (data ? 'deletedAt') " +
      "(search-projection-repo-pg.ts AKTIVE_VERSION); die Referenz `!deletedAt` wertet '' als lebend.",
  },
  {
    kennung: "A3",
    marke: "befundGeloeschtNull",
    stand: "abgeleitet, ungemessen",
    richtung: "pgVerbirgt",
    betrifft: "jeder",
    herleitung:
      "Der Such-JOIN (AKTIVE_VERSION, search-projection-repo-pg.ts) prüft die SCHLÜSSELEXISTENZ " +
      "NOT (data ? 'deletedAt'); ein JSON-null-Schlüssel ist vorhanden. Die Referenz wertet null als lebend.",
  },
];

/** Die Altform auf ein gespeichertes Objekt anwenden — ohne sonst etwas anzufassen. */
export function mitAltform<T extends object>(ko: T, altform: Altform): T {
  // Bewusst untypisiert: die Altform ist gerade ein Wert, den `KnowledgeObject` nicht erlaubt.
  const roh = { ...ko } as unknown as Record<string, unknown>;
  if ("entfernt" in altform) {
    delete roh[altform.feld];
  } else {
    roh[altform.feld] = altform.wert;
  }
  return roh as T;
}

/** Sieht dieser Betrachter das Objekt nach der festgelegten Regel? */
export function siehtNachRegel(regel: Regel, betrachter: string, mitValidate: boolean): boolean {
  if (regel === "jeder" || mitValidate) {
    return true;
  }
  return regel === "validateOderAnna" && betrachter === ANNA;
}
