// Pedi 04.07.: „Welche KI arbeitet hier?" — jeder KI-Knopf soll offen ausweisen, WELCHE KI die
// jeweilige Aufgabe ausführt. Nutzt ausschließlich die vorhandene read-only Konfiguration
// (/reasoner/config, SCRUM-166: nur Metadaten, keine Secrets): Modus je Aufgabe
// (Cloud / Lokal / Regelbasiert) plus optionaler Modellname. DOM-frei und testbar
// (Muster CAPTURE_*_TEXT) — die Anzeige-Komponente (AiModelInfo) rendert nur das Ergebnis.
import type { ReasonerConfigStatus } from "../api/types";

export type AiTaskMode = "cloud" | "local" | "rule" | "unknown";

// Pedi 05.07.: Datenschutz-Einordnung je Aufgabe. Ehrlich: „inhouse" (lokal/regelbasiert → keine
// Übermittlung an Dritte) darf grün als datenschutzkonform gezeigt werden; „external" (Cloud) ist
// externe Verarbeitung (DSGVO hängt am Auftragsverarbeitungsvertrag); ohne Konfiguration keine Aussage.
export type AiDsgvoStance = "inhouse" | "external" | "unknown";

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test.
export const AI_TASK_INFO_TEXT = {
  title: "reasoner.taskInfo.title",
  cloud: "reasoner.taskInfo.cloud",
  local: "reasoner.taskInfo.local",
  rule: "reasoner.taskInfo.rule",
  unknown: "reasoner.taskInfo.unknown",
  bodyCloud: "reasoner.taskInfo.bodyCloud",
  bodyLocal: "reasoner.taskInfo.bodyLocal",
  bodyRule: "reasoner.taskInfo.bodyRule",
  bodyUnknown: "reasoner.taskInfo.bodyUnknown",
  modelLabel: "reasoner.taskInfo.modelLabel",
  dsgvoInhouse: "reasoner.taskInfo.dsgvoInhouse",
  dsgvoInhouseBody: "reasoner.taskInfo.dsgvoInhouseBody",
  dsgvoExternal: "reasoner.taskInfo.dsgvoExternal",
  dsgvoExternalBody: "reasoner.taskInfo.dsgvoExternalBody",
} as const;

export interface AiTaskInfo {
  mode: AiTaskMode;
  modeLabelKey: string;
  bodyKey: string;
  // Pedi 05.07.: Datenschutz-Einordnung — steuert den grün/amber-Hinweis in AiModelInfo.
  dsgvo: AiDsgvoStance;
  // Nur gesetzt, wenn ein KI-Modell arbeitet (Cloud/Lokal) — bei Regelbasiert bewusst leer.
  modelName?: string;
}

// Ableitung des Anzeige-Zustands je Aufgabe. Ehrlich: ohne geladene Konfiguration oder für eine
// nicht zugeordnete Aufgabe „unbekannt" (nichts erfinden, kein Fake-Modell).
export function aiTaskInfo(config: ReasonerConfigStatus | undefined, task: string): AiTaskInfo {
  if (!config) {
    return {
      mode: "unknown",
      modeLabelKey: AI_TASK_INFO_TEXT.unknown,
      bodyKey: AI_TASK_INFO_TEXT.bodyUnknown,
      dsgvo: "unknown",
    };
  }
  const provider = config.effectiveProvider[task];
  if (provider === "local") {
    // Ehrlich: lokaler Anbietername, sonst das konfigurierte Modell; fehlt beides, kein Fake-Name
    // (modelName wird nur gesetzt, wenn wirklich vorhanden — exactOptionalPropertyTypes).
    const name = config.localProvider ?? config.model;
    return {
      mode: "local",
      modeLabelKey: AI_TASK_INFO_TEXT.local,
      bodyKey: AI_TASK_INFO_TEXT.bodyLocal,
      dsgvo: "inhouse",
      ...(name ? { modelName: name } : {}),
    };
  }
  if (provider === "cloud") {
    return {
      mode: "cloud",
      modeLabelKey: AI_TASK_INFO_TEXT.cloud,
      bodyKey: AI_TASK_INFO_TEXT.bodyCloud,
      dsgvo: "external",
      ...(config.model ? { modelName: config.model } : {}),
    };
  }
  if (provider === "deterministic") {
    return {
      mode: "rule",
      modeLabelKey: AI_TASK_INFO_TEXT.rule,
      bodyKey: AI_TASK_INFO_TEXT.bodyRule,
      dsgvo: "inhouse",
    };
  }
  return {
    mode: "unknown",
    modeLabelKey: AI_TASK_INFO_TEXT.unknown,
    bodyKey: AI_TASK_INFO_TEXT.bodyUnknown,
    dsgvo: "unknown",
  };
}
