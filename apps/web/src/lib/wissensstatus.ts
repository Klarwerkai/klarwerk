// ================================================================================================
// NUTZERENTSCHEID ANTWORT 54 (11.10.2026) — „FACHLICH BESTÄTIGT" STATT „VALIDIERT"/„GESICHERT".
// ================================================================================================
//
// Der sichtbare Name des freigegebenen Wissensstatus ist „Fachlich bestätigt". „Gesichert" liess
// sich mit einer Datensicherung verwechseln (Begründung im Entscheid). Der INTERNE Wert bleibt
// `validiert`; Statuslogik, Bewertungsregeln und Schnittstellen ändern sich nicht.
//
// WARUM EIN SCHLÜSSELWECHSEL UND KEIN NEUER WERT FÜR `status.validiert`: der Grundbestand steht
// unter dem Umzugsnachweis von JOB 4367 (`tests/i18n-textmodule/bestand-unveraendert.test.ts`), und
// ein Textmodul darf keinen Grundschlüssel überschreiben (`texte/intern/pruefung.ts`, Regel 6). Der
// neue Begriff liegt deshalb im Textmodul `texte/pruefablauf.ts`; jede Anzeigestelle eines
// Wissensstatus fragt ihren Schlüssel HIER ab — eine Stelle, keine Abschrift je Fläche.
//
// QUELLENWIDERSPRUCH, DOKUMENTIERT: R-0230 nennt „Gesichert" als Qualitätswort, R-1079 spricht von
// „gesichertem Wissen". Der jüngere Nutzerentscheid geht vor; die Originalkriterien bleiben im
// Auftrag stehen. EN/NL behalten ihre Statuswörter (der Entscheid betrifft den deutschen Begriff).
// Eine Folge, ausdrücklich benannt: der Führungspunkt „secured" der Startseite (`kg.secured.label`,
// DE „Gesichert", EN „Verified", NL „Geborgd") trägt jetzt denselben Statusnamen — DE „Fachlich
// bestätigt", EN „Validated", NL „Gevalideerd". Ein zweites Wort für denselben Status wäre genau
// die Verwechslung, die der Entscheid beseitigt.
//
// DAS WORD-PANEL zeigt denselben Wissensstatus (`askStatusValidiert` in
// `public/word-addin/taskpane.js`) und trägt dort dasselbe deutsche Wort — Web und Panel messen
// gegen EINE Tabelle (`tests/erfassungs-konfliktpruefung/pruefstand-wortlaut.test.tsx`).
//
// BEWUSST NICHT UMBENANNT, weil sie keinen Wissensstatus benennen:
//   · die Einstufung einer ANTWORT (`ask.status.verified`, `ask.knowledgeClass.gesichert`) und die
//     Ergebnisstufe einer Antwort (`ergebnisStufe.validiert`, lib/kiHerkunft.ts);
//   · das Vertrauenswort des Balkens (`quality.assured`, R-0230 „Vorläufig/Belastbar/Gesichert") —
//     ein Prüfsignal in Prozent, kein Status;
//   · die Kennzahl-/Spaltenwörter der Verwaltung (`mgmt.*`) und die Wissensnetz-Leiste
//     („freigegeben"). Ob auch sie dem Entscheid folgen sollen, ist offen und nicht entschieden.

/** Der Textschlüssel des sichtbaren Namens eines Wissensstatus. */
export function statusSchluessel(status: string): string {
  return status === "validiert" ? WISSENSSTATUS_BESTAETIGT : `status.${status}`;
}

/** „Fachlich bestätigt" — für Stellen, die den freigegebenen Status direkt benennen. */
export const WISSENSSTATUS_BESTAETIGT = "pruefablauf.wissensstatus.validiert";
