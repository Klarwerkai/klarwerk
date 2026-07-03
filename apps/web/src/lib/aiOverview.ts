// SCRUM-413 (Pedi 03.07.): „Verfügbare KIs" im Admin — DOM-freie Zeilen aus dem ECHTEN
// configStatus (nur Metadaten, keine Secrets). Drei Zugänge, ehrlich ausgewiesen:
// (1) konfiguriertes Cloud-Modell, (2) deterministischer Ersatzmodus (immer vorhanden),
// (3) lokaler LLM-Server — dessen App-Anschluss ist KLLM-61 und wird bis dahin als
// „geplant" gezeigt (nichts vortäuschen, was die App noch nicht ansprechen kann).

export type AiAccessId = "cloud" | "fallback" | "local";
export type AiAccessState = "active" | "available" | "missing" | "planned";

export interface AiAccessRow {
  id: AiAccessId;
  state: AiAccessState;
  // Modell-/Provider-Label beim Cloud-Zugang; sonst null → lokalisierter Zugangs-Name reicht.
  detail: string | null;
}

export function aiAccessRows(cfg: {
  configured: boolean;
  provider: string;
  model?: string;
  mode: "model" | "fallback" | "demo";
}): AiAccessRow[] {
  return [
    {
      id: "cloud",
      state: cfg.configured ? "active" : "missing",
      detail: cfg.configured ? (cfg.model ?? cfg.provider) : null,
    },
    {
      // Der Ersatzmodus ist immer da: „aktiv", wenn er gerade antwortet (kein Modell),
      // sonst „bereit" als ehrliches Sicherheitsnetz hinter dem Modell.
      id: "fallback",
      state: cfg.mode === "model" ? "available" : "active",
      detail: null,
    },
    { id: "local", state: "planned", detail: null },
  ];
}
