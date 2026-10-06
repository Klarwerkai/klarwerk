// KI-WAHL-BETRIEBSABNAHME · N-0070 — WER FÜHRT DAS AUS? DOM-frei und testbar (Muster
// `reasonerTaskInfo.ts`); die Anzeige-Komponente (`AiAusfuehrerZeile`) rendert nur das Ergebnis.
//
// QUELLE IST NUR EINE AUFGABENBEZOGENE AUSKUNFT. Die Adminsicht (`/reasoner/config`, users.manage)
// trägt je Aufgabe die wirksame Stufe (`effectiveProvider`) und den Anbieter (`effectiveAnbieter`)
// — daraus `aiTaskInfo`. Für alle anderen gibt es KEINE solche Auskunft: der öffentliche Status
// (`/reasoner/status`) trägt je Aufgabe nur Nutzbarkeit und Kostenpflicht als Booleans, und sein
// `mode` ist ausdrücklich die HAUSWEITE Stufe (`services/reasoner/src/service.ts`, Kommentar an
// `taskBillable`: „Eine Installation kann Cloud verdrahtet haben und `structure` trotzdem
// ausdrücklich lokal stellen"). Die erste Fassung gab für Nicht-Admins diesen hausweiten `mode`
// als Ausführer JEDER Aufgabe aus — bei globaler Cloud und lokal gestellter Aufgabe also „Cloud-KI",
// obwohl lokal gerechnet wird (BEN, Nacharbeit 5). Deshalb sagt die Zeile jetzt für Nicht-Admins
// ausdrücklich, dass die konkrete Ausführung hier nicht bekannt ist.
//
// WAS DAMIT NICHT ENTSCHIEDEN IST: ob Nicht-Admins Stufe oder Anbieter je Aufgabe sehen sollen. Die
// öffentliche Sicht nennt die Stufe je Aufgabe bewusst nicht (vip2-gate, mega67); sie hier
// einzuführen wäre eine Produktentscheidung und bleibt offen (README N-0070).
import type { ReasonerConfigStatus, ReasonerTask } from "../api/types";
import { anbieterUndModell } from "./aiOverview";
import { aiTaskInfo } from "./reasonerTaskInfo";

/** „Hier nicht bekannt" — der Platzhalter für `wer`, wenn keine Aufgabenauskunft vorliegt. */
export const AUSFUEHRER_UNBEKANNT_KEY = "erfassen.ki.ausfuehrerUnbekannt";

/**
 * Der `wer`-Teil des Satzes „Führt aus: {{wer}}" für die Aufgaben einer Fläche.
 *
 * Adminsicht: Stufe und Anbieter/Modell JE AUFGABE; führen alle Aufgaben denselben Ausführer aus,
 * steht er einmal da, sonst jede Aufgabe mit ihrem eigenen. Ohne Adminsicht: „hier nicht bekannt"
 * — nie die hausweite Stufe. `t` übersetzt Stufen-, Aufgaben- und Platzhalternamen.
 */
export function ausfuehrerWer(opts: {
  tasks: readonly ReasonerTask[];
  istAdmin: boolean;
  config: ReasonerConfigStatus | undefined;
  t: (schluessel: string) => string;
}): string {
  const { tasks, istAdmin, config, t } = opts;
  if (!istAdmin) {
    return t(AUSFUEHRER_UNBEKANNT_KEY);
  }
  const werFuer = (task: ReasonerTask): string => {
    // Ohne geladene Adminauskunft ist `aiTaskInfo` ehrlich „wird ermittelt" — kein Rückgriff auf
    // den hausweiten Status.
    const info = aiTaskInfo(config, task);
    const stufe = t(info.modeLabelKey);
    return info.modelName ? `${stufe} · ${anbieterUndModell(info.modelName)}` : stufe;
  };
  const je = tasks.map((task) => ({ task, wer: werFuer(task) }));
  const alleGleich = je.every((e) => e.wer === je[0]?.wer);
  return alleGleich
    ? (je[0]?.wer ?? "")
    : je.map((e) => `${t(`adm.ai.task.${e.task}`)}: ${e.wer}`).join(" · ");
}
