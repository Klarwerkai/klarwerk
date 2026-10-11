// KI-WAHL-BETRIEBSABNAHME · N-0070 — WER FÜHRT DAS AUS? DOM-frei und testbar (Muster
// `reasonerTaskInfo.ts`); die Anzeige-Komponente (`AiAusfuehrerZeile`) rendert nur das Ergebnis.
//
// QUELLE IST IMMER EINE AUFGABENBEZOGENE AUSKUNFT, nie die globale Wahl als Ersatz:
//   · Adminsicht: `/reasoner/config` (users.manage) — Stufe und Anbieter/Modell je Aufgabe
//     (`aiTaskInfo`).
//   · Alle anderen Angemeldeten: `/reasoner/ausfuehrung` (ko.read) — seit Antwort 13 (BEN,
//     Nacharbeit 7) der TATSÄCHLICH arbeitende Dienst je Aufgabe, seine Verfügbarkeit und seine
//     Einschränkungen. Bis dahin stand hier für Nicht-Admins „hier nicht bekannt": eine
//     aufgabenbezogene Auskunft gab es für sie nicht, und der öffentliche Status nennt nur die
//     HAUSWEITE Stufe (Nacharbeit 5 hatte deshalb ausdrücklich nichts geraten).
// Fehlt die jeweilige Auskunft (noch nicht geladen, Fehler), steht weiterhin „hier nicht bekannt"
// bzw. für Admins „wird ermittelt" — nie die hausweite Stufe.
import type {
  ReasonerAusfuehrer,
  ReasonerAusfuehrung,
  ReasonerAusfuehrungAntwort,
  ReasonerConfigStatus,
  ReasonerSchutzstufe,
  ReasonerTask,
} from "../api/types";
import { anbieterName, anbieterUndModell } from "./aiOverview";
import { aiTaskInfo } from "./reasonerTaskInfo";

/** „Hier nicht bekannt" — der Platzhalter für `wer`, wenn keine Aufgabenauskunft vorliegt. */
export const AUSFUEHRER_UNBEKANNT_KEY = "erfassen.ki.ausfuehrerUnbekannt";

/** Der Name eines Ausführers, wie ein Anwender ihn liest. */
function dienstName(ausfuehrer: ReasonerAusfuehrer, t: (schluessel: string) => string): string {
  if (ausfuehrer === "openai" || ausfuehrer === "anthropic") {
    return anbieterName(ausfuehrer);
  }
  return t(ausfuehrer === "local" ? "reasoner.taskInfo.local" : "reasoner.taskInfo.rule");
}

const STUFEN: readonly ReasonerSchutzstufe[] = ["intern", "vertraulich", "streng_vertraulich"];

/**
 * Wer arbeitet — EIN Dienst nur, wenn alle Schutzstufen denselben haben. Gehen die Stufen
 * auseinander (Stufenregel oder Vertraulichkeitsriegel, BEN Nacharbeit 10), steht jede Stufe mit
 * ihrem eigenen Ausführer da: ohne Inhaltskontext gibt es keinen einzelnen „tatsächlichen" Dienst.
 */
function werArbeitet(a: ReasonerAusfuehrung, t: (schluessel: string) => string): string {
  if (!a.jeStufe || !a.stufenAbweichend) {
    return dienstName(a.ausfuehrer, t);
  }
  const jeStufe = a.jeStufe;
  return STUFEN.map((s) => `${t(`conf.level.${s}`)}: ${dienstName(jeStufe[s], t)}`).join(", ");
}

/** Dienst, Verfügbarkeit und Einschränkungen EINER Aufgabe — für Nicht-Admins. */
function auskunftFuer(a: ReasonerAusfuehrung, t: (schluessel: string) => string): string {
  const teile = [werArbeitet(a, t)];
  if (a.ausfuehrer !== "deterministic") {
    teile.push(t(a.verfuegbar ? "erfassen.ki.verfuegbar" : "erfassen.ki.nichtVerfuegbar"));
  }
  for (const e of a.einschraenkungen) {
    teile.push(t(`erfassen.ki.einschraenkung.${e}`));
  }
  if (a.keineKiFuer.length > 0) {
    const stufen = a.keineKiFuer.map((s) => t(`conf.level.${s}`)).join(", ");
    teile.push(`${t("erfassen.ki.keineKiFuer")} ${stufen}`);
  }
  return teile.join(" · ");
}

/**
 * Der `wer`-Teil des Satzes „Führt aus: {{wer}}" für die Aufgaben einer Fläche.
 *
 * Je Aufgabe ein Ausführer; führen alle Aufgaben denselben aus, steht er einmal da, sonst jede
 * Aufgabe mit ihrem eigenen. `t` übersetzt Stufen-, Aufgaben-, Einschränkungs- und Platzhalternamen.
 */
export function ausfuehrerWer(opts: {
  tasks: readonly ReasonerTask[];
  istAdmin: boolean;
  config: ReasonerConfigStatus | undefined;
  ausfuehrung: ReasonerAusfuehrungAntwort | undefined;
  t: (schluessel: string) => string;
}): string {
  const { tasks, istAdmin, config, ausfuehrung, t } = opts;
  const werFuer = (task: ReasonerTask): string => {
    const a = ausfuehrung?.aufgaben[task];
    if (istAdmin) {
      // Ohne geladene Adminauskunft ist `aiTaskInfo` ehrlich „wird ermittelt".
      const info = aiTaskInfo(config, task);
      const stufe = t(info.modeLabelKey);
      const basis = info.modelName ? `${stufe} · ${anbieterUndModell(info.modelName)}` : stufe;
      // BEN, Nacharbeit 10: die Adminsicht nennt die Aufgabenwahl; weicht eine Schutzstufe davon
      // ab (Stufenregel, Vertraulichkeitsriegel), steht die Verteilung je Stufe ausdrücklich dabei.
      return a?.jeStufe && a.stufenAbweichend
        ? `${basis} · ${t("erfassen.ki.jeStufe")} ${werArbeitet(a, t)}`
        : basis;
    }
    return a ? auskunftFuer(a, t) : t(AUSFUEHRER_UNBEKANNT_KEY);
  };
  const je = tasks.map((task) => ({ task, wer: werFuer(task) }));
  const alleGleich = je.every((e) => e.wer === je[0]?.wer);
  return alleGleich
    ? (je[0]?.wer ?? "")
    : je.map((e) => `${t(`adm.ai.task.${e.task}`)}: ${e.wer}`).join(" · ");
}
