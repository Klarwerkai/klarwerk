// ================================================================================================
// JOB 3112 · V3 — DIE STUFENFRAGE BEIM FREIGEBEN: GEFRAGT, NICHT ERZWUNGEN.
// ================================================================================================
//
// PEDIS ENTSCHEIDUNG 32 (06.09.2026 04:22, UEBERGABE.md:738-740), wörtlich: „die Stufenfrage beim
// Validieren erscheint wieder (2623 D1 §2: gefragt, nicht erzwungen)". Der Auftrag 2623 D1 §2
// Punkt 2 sagt dazu: „Die Stufe wird bei der Freigabe verlangt. Wer validiert, wird nach der Stufe
// gefragt. Nicht erzwungen (§3), aber gefragt — so dass Vergessen auffällt."
//
// WAS DIESE DATEI IST UND WAS NICHT. Sie ist die REGEL: wann gefragt wird und was zur Wahl steht.
// Sie ist DOM-frei, kennt keine Texte (nur die Wertemenge) und setzt selbst nichts — sie sagt der
// Fläche, ob eine Frage ansteht. Der Ablauf (zuerst die Stufe schreiben, dann freigeben) wohnt in
// `pages/Validation.tsx`, weil er Mutationen und Rollen braucht.
//
// WARUM AUCH BEI „AUSKUNFT FEHLT" GEFRAGT WIRD. Die Prüfkarte kennt drei Lagen
// (`boardAuskunft.ts:40-41`): `eingestuft` · `nicht_eingestuft` · `auskunft_fehlt`.
//   · `nicht_eingestuft` ist der Fall, den 2623 D1 §2 meint: der Server sagt ausdrücklich, dass
//     niemand hier je eingestuft hat.
//   · `auskunft_fehlt` heisst: DIESE Antwort trägt die Einstufung nicht (ein Cache-Stand von vor
//     JOB 3003 zum Beispiel). Wir wissen also nicht, ob eine Stufe existiert. Zu SCHWEIGEN hiesse
//     dann, „es ist alles in Ordnung" zu behaupten; automatisch zu setzen hiesse, eine Einstufung
//     zu erfinden. Die Frage zu STELLEN ist die einzige ehrliche Möglichkeit: sie behauptet nichts,
//     sie fragt — und der Mensch kann sie mit einem Klick übergehen.
//   · `eingestuft` wird NICHT gefragt. Sonst wäre aus „gefragt" eine Belästigung geworden, und der
//     heutige Weg (ein Klick, sofort freigegeben) bliebe nicht erhalten.
import type { Confidentiality } from "../api/types";
import type { StufenLage } from "./boardAuskunft";
// NUR die Wertemenge, nicht die glättende `confidentialityOf`: eine zweite Aufzählung der Stufen
// wäre eine zweite Wahrheit — dieselbe Begründung wie in `boardAuskunft.ts:36-38`.
import { CONFIDENTIALITY_LEVELS } from "./confidentiality";

/**
 * DIE ZUSICHERUNG DIESES JOBS, ALS LESBARES DATUM (Hausidiom wie `A28_SIGNAL_GRENZE`,
 * `services/app/src/duplicate-signal.ts:149-166`). Sie steht hier, damit sie ein Test lesen kann
 * und nicht nur ein Mensch einen Kommentar.
 *
 *   fragt              — es wird gefragt, sobald keine Stufe belegt ist.
 *   erzwingt           — es gibt KEINE Sperre: „Ohne Stufe freigeben" ist ein Klick.
 *   setztNiemalsSelbst — keine Vorauswahl, keine „intern"-Annahme, kein Standardwert. Eine Stufe
 *                        entsteht ausschliesslich aus einer Wahl eines Menschen.
 */
export const STUFENFRAGE_VERTRAG = {
  fragt: true,
  erzwingt: false,
  setztNiemalsSelbst: true,
} as const;

/** Der Übergeh-Weg als eigener, benannter Wert — ausdrücklich keine vierte Stufe. */
export const OHNE_STUFE = "ohne_stufe";

/** Was ein Mensch auf die Frage antworten kann: eine der drei Stufen, oder „übergehen". */
export type StufenAntwort = Confidentiality | typeof OHNE_STUFE;

/**
 * Die Wahlmöglichkeiten der Frage, in der Reihenfolge, in der sie dastehen. Die drei Stufen kommen
 * aus `CONFIDENTIALITY_LEVELS` — wird dort eine vierte ergänzt, steht sie hier ohne Zutun.
 */
export const STUFENFRAGE_WAHLEN: readonly StufenAntwort[] = [...CONFIDENTIALITY_LEVELS, OHNE_STUFE];

/**
 * Wird gefragt? Genau dann, wenn die Karte keine belegte Stufe zeigt.
 *
 * Bewusst über die LAGE und nicht über das rohe Feld `confidentiality`: die Lage ist die bereits
 * gezogene, geprüfte Auskunft der Karte (`stufenAuskunft`, boardAuskunft.ts:120-147). Wer hier das
 * Rohfeld noch einmal auslegte, hätte eine zweite Lesart derselben Antwort — genau das, was JOB
 * 3027 beendet hat.
 */
export function brauchtStufenfrage(lage: StufenLage): boolean {
  // `STUFENFRAGE_VERTRAG.fragt` steht hier WIRKSAM und nicht als Zierat: die Zusicherung ist die
  // Regel selbst. Würde sie je auf `false` gesetzt, fragte die Fläche nicht mehr — es gibt keinen
  // zweiten Ort, an dem dieselbe Entscheidung noch einmal getroffen wird. Der Aufrufer-Wächter
  // (`tests/capture/aufrufer-waechter.test.ts`) hat genau das eingefordert: „Ein Test ist kein
  // Aufrufer" — eine Konstante, die nur ein Test liest, ist ein Kommentar mit Speicherbedarf.
  return STUFENFRAGE_VERTRAG.fragt && lage !== "eingestuft";
}

/**
 * Was aus einer Antwort GESCHRIEBEN wird. `null` heisst: kein `confidentiality`-Aufruf, gar keiner
 * — weder mit einem Ersatzwert noch mit dem bisherigen. Das ist die Stelle, an der
 * `STUFENFRAGE_VERTRAG.setztNiemalsSelbst` wirksam wird.
 */
export function stufeAusAntwort(antwort: StufenAntwort): Confidentiality | null {
  return antwort === OHNE_STUFE ? null : antwort;
}

// ================================================================================================
// DER TEILERFOLG — RUNDE 2, KORREKTURPFLICHT 2 (Ben, 06.09.2026).
// ================================================================================================
//
// Der Freigabeweg besteht aus ZWEI Serveraufrufen (erst die Stufe, dann die Freigabe). Bens Messung:
// „Nach erfolgreichem `confidentiality` und fehlgeschlagenem `rate` bleibt die Einstufung
// gespeichert, während i18n.ts:554 ‚Nicht gespeichert' meldet." Das ist die Unwahrheit, die dieser
// Typ beendet: ein geworfener Fehler trägt fortan MIT, was VOR ihm bereits am Server angekommen ist.
//
// Warum ein eigener Fehlertyp und kein React-Zustand: der Zwischenstand entsteht INNERHALB des einen
// `mutationFn`-Laufs. Ein daneben geführtes `useState` wäre eine zweite Buchführung über denselben
// Vorgang und liefe bei zwei schnell aufeinanderfolgenden Versuchen auseinander. Der Fehler ist das
// Ding, das den Lauf verlässt — also trägt er die Auskunft.

/** Welcher der beiden Aufrufe gescheitert ist. */
export type FreigabeSchritt = "stufe" | "freigabe";

/**
 * Der Fehler des zweistufigen Freigabewegs. Er ERSETZT die Ursache nicht, er umhüllt sie
 * (`ursache`), damit der Administratorweg weiterhin die Servermeldung anzeigen kann.
 */
export class FreigabeFehler extends Error {
  readonly schritt: FreigabeSchritt;
  /** Die Stufe, die vor dem Fehler bereits gespeichert wurde — `null`, wenn keine ankam. */
  readonly gespeicherteStufe: Confidentiality | null;
  readonly ursache: unknown;

  constructor(
    schritt: FreigabeSchritt,
    gespeicherteStufe: Confidentiality | null,
    ursache: unknown,
  ) {
    super(ursache instanceof Error ? ursache.message : "Freigabe fehlgeschlagen");
    this.name = "FreigabeFehler";
    this.schritt = schritt;
    this.gespeicherteStufe = gespeicherteStufe;
    this.ursache = ursache;
  }
}

/**
 * Was von einem gescheiterten Freigabeversuch TROTZDEM am Server steht. `null` heisst: nichts —
 * dann und nur dann darf die Fläche „Nicht gespeichert" sagen. Ein fremder Fehler (Netz, Absturz vor
 * dem ersten Aufruf) fällt bewusst auf `null`: wir behaupten keine Speicherung, die wir nicht sahen.
 */
export function gespeicherteStufeAusFehler(fehler: unknown): Confidentiality | null {
  return fehler instanceof FreigabeFehler ? fehler.gespeicherteStufe : null;
}

/** Die Ursache hinter der Hülle — für Meldungen, die den Servertext zeigen (Administratorweg). */
export function freigabeFehlerUrsache(fehler: unknown): unknown {
  return fehler instanceof FreigabeFehler ? fehler.ursache : fehler;
}
