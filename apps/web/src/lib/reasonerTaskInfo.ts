// Pedi 04.07.: „Welche KI arbeitet hier?" — jeder KI-Knopf soll offen ausweisen, WELCHE KI die
// jeweilige Aufgabe ausführt. Nutzt ausschließlich die vorhandene read-only Konfiguration
// (/reasoner/config, SCRUM-166: nur Metadaten, keine Secrets): Modus je Aufgabe
// (Cloud / Lokal / Regelbasiert) plus optionaler Modellname. DOM-frei und testbar
// (Muster CAPTURE_*_TEXT) — die Anzeige-Komponente (AiModelInfo) rendert nur das Ergebnis.
import type { ReasonerConfigStatus } from "../api/types";

export type AiTaskMode = "cloud" | "local" | "rule" | "unknown";

// R-0600: WOHIN gehen die Inhalte beim Klick — das ist die Datenschutz-Aussage, die sich belegen
// lässt. „extern" = an den Cloud-Anbieter · „server" = an den vom Betreiber eingerichteten
// KI-Server (`KLARWERK_LOCAL_LLM_URL`, eine frei gesetzte Adresse — wo er läuft, weiß der Code
// nicht) · „keiner" = regelbasiert, kein Versand an ein Modell · „unknown" = keine Aussage.
// Bis R-0599/R-0600 stand hier eine DSGVO-Einordnung („DSGVO-konform" für lokal und regelbasiert).
// Sie ließ sich weder aus der Stufe noch aus dem Modellnamen ableiten und ist gestrichen.
export type AiDatenfluss = "extern" | "server" | "keiner" | "unknown";

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test.
// `reasoner.taskInfo.bodyLocal` (eigene Hardware, Inhalte verlassen das Haus nicht) und die
// `dsgvo*`-Texte bleiben im Wörterbuch byteweise gesperrt (PRO 375), werden hier aber nicht mehr
// gezeigt: für ihre Zusagen gibt es kein Signal.
export const AI_TASK_INFO_TEXT = {
  title: "reasoner.taskInfo.title",
  cloud: "reasoner.taskInfo.cloud",
  local: "reasoner.taskInfo.local",
  rule: "reasoner.taskInfo.rule",
  unknown: "reasoner.taskInfo.unknown",
  bodyCloud: "reasoner.taskInfo.bodyCloud",
  bodyLocal: "kilage.aktion.serverText",
  bodyRule: "reasoner.taskInfo.bodyRule",
  bodyUnknown: "reasoner.taskInfo.bodyUnknown",
  modelLabel: "reasoner.taskInfo.modelLabel",
  flussExtern: "kilage.aktion.extern",
  flussExternBody: "kilage.aktion.externText",
  flussServer: "kilage.aktion.server",
  flussServerBody: "kilage.aktion.serverOffen",
  flussKeiner: "kilage.aktion.keiner",
  flussKeinerBody: "kilage.aktion.keinerText",
} as const;

export interface AiTaskInfo {
  mode: AiTaskMode;
  modeLabelKey: string;
  bodyKey: string;
  // R-0600: wohin die Inhalte gehen — steuert den Datenfluss-Hinweis in AiModelInfo.
  datenfluss: AiDatenfluss;
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
      datenfluss: "unknown",
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
      datenfluss: "server",
      ...(name ? { modelName: name } : {}),
    };
  }
  if (provider === "cloud") {
    // JOB 3134: der Modellname DIESER Aufgabe — mit zwei wählbaren Anbietern kann eine Aufgabe
    // (z. B. answer → Claude) von der globalen Wahl (ChatGPT) abweichen; `config.model` nennt nur
    // die globale. Der Clientname des je Aufgabe wirksamen Anbieters steht in `cloudProviders`;
    // fehlt die Auflösung (älterer Server), bleibt es beim globalen Modell.
    const anbieter = config.effectiveAnbieter?.[task];
    const eigenes =
      anbieter === "openai" || anbieter === "anthropic"
        ? config.cloudProviders?.[anbieter]?.name
        : undefined;
    const name = eigenes ?? config.model;
    return {
      mode: "cloud",
      modeLabelKey: AI_TASK_INFO_TEXT.cloud,
      bodyKey: AI_TASK_INFO_TEXT.bodyCloud,
      datenfluss: "extern",
      ...(name ? { modelName: name } : {}),
    };
  }
  if (provider === "deterministic") {
    return {
      mode: "rule",
      modeLabelKey: AI_TASK_INFO_TEXT.rule,
      bodyKey: AI_TASK_INFO_TEXT.bodyRule,
      datenfluss: "keiner",
    };
  }
  return {
    mode: "unknown",
    modeLabelKey: AI_TASK_INFO_TEXT.unknown,
    bodyKey: AI_TASK_INFO_TEXT.bodyUnknown,
    datenfluss: "unknown",
  };
}

// WP-VIP2-GATE-2 (bens Fix 3): OEFFENTLICHE Variante der KI-Knopf-Info — /api/reasoner/config ist
// jetzt echte Admin-Sicht (users.manage). Nicht-Admins bekommen die ehrliche GLOBALE Stufe aus dem
// abstrahierten Status (/api/reasoner/status: active + mode cloud/local/deterministic) — ohne
// Modellname (Admin-Detail) und ohne per-Aufgabe-Aufloesung (die per-Task-Zuordnung ist Teil der
// Admin-Konfiguration; die globale Stufe ist die ehrliche Aussage, die allen zusteht).
export function aiTaskInfoPublic(
  status: { active: boolean; mode: "cloud" | "local" | "deterministic" } | undefined,
): AiTaskInfo {
  if (!status) {
    return {
      mode: "unknown",
      modeLabelKey: AI_TASK_INFO_TEXT.unknown,
      bodyKey: AI_TASK_INFO_TEXT.bodyUnknown,
      datenfluss: "unknown",
    };
  }
  if (status.mode === "cloud") {
    return {
      mode: "cloud",
      modeLabelKey: AI_TASK_INFO_TEXT.cloud,
      bodyKey: AI_TASK_INFO_TEXT.bodyCloud,
      datenfluss: "extern",
    };
  }
  if (status.mode === "local") {
    return {
      mode: "local",
      modeLabelKey: AI_TASK_INFO_TEXT.local,
      bodyKey: AI_TASK_INFO_TEXT.bodyLocal,
      datenfluss: "server",
    };
  }
  return {
    mode: "rule",
    modeLabelKey: AI_TASK_INFO_TEXT.rule,
    bodyKey: AI_TASK_INFO_TEXT.bodyRule,
    datenfluss: "keiner",
  };
}
