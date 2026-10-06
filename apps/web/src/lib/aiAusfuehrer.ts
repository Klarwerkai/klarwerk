// KI-WAHL-BETRIEBSABNAHME · N-0070 — WER FÜHRT DAS AUS? DOM-frei und testbar (Muster
// `reasonerTaskInfo.ts`); die Anzeige-Komponente (`AiAusfuehrerZeile`) rendert nur das Ergebnis.
//
// DIESELBE ABLEITUNG WIE `AiModelInfo`: Adminsicht → `aiTaskInfo` (Stufe UND Anbieter/Modell der
// Aufgabe), alle anderen → `aiTaskInfoPublic` (nur die Stufe, WP-VIP2-GATE-2).
import type { ReasonerConfigStatus, ReasonerTask } from "../api/types";
import { anbieterUndModell } from "./aiOverview";
import { aiTaskInfo, aiTaskInfoPublic } from "./reasonerTaskInfo";

export type OeffentlicherKiStatus = Parameters<typeof aiTaskInfoPublic>[0];

/**
 * Der `wer`-Teil des Satzes „Führt aus: {{wer}}" für die Aufgaben einer Fläche.
 *
 * Führen alle Aufgaben denselben Ausführer aus, steht er einmal da; weichen sie ab, wird jede
 * Aufgabe mit ihrem eigenen genannt — sonst verschwiege die Zeile genau den Fall, in dem es darauf
 * ankommt. `t` übersetzt Stufen- und Aufgabennamen.
 */
export function ausfuehrerWer(opts: {
  tasks: readonly ReasonerTask[];
  istAdmin: boolean;
  config: ReasonerConfigStatus | undefined;
  status: OeffentlicherKiStatus;
  t: (schluessel: string) => string;
}): string {
  const { tasks, istAdmin, config, status, t } = opts;
  const werFuer = (task: ReasonerTask): string => {
    const info = istAdmin && config ? aiTaskInfo(config, task) : aiTaskInfoPublic(status);
    const stufe = t(info.modeLabelKey);
    return info.modelName ? `${stufe} · ${anbieterUndModell(info.modelName)}` : stufe;
  };
  const je = tasks.map((task) => ({ task, wer: werFuer(task) }));
  const alleGleich = je.every((e) => e.wer === je[0]?.wer);
  return alleGleich
    ? (je[0]?.wer ?? "")
    : je.map((e) => `${t(`adm.ai.task.${e.task}`)}: ${e.wer}`).join(" · ");
}
