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

// ================================================================================================
// JOB 3090 — DIE CLOUD-ZEILE NENNT DEN ANBIETER, NICHT NUR EINE KENNUNG.
// ================================================================================================
//
// Bis hierher stand in der Cloud-Zeile `model ?? provider` — und beides ist derselbe Wert: der NAME
// des Modell-Clients (`services/reasoner/src/service.ts:956-957` setzt `provider` und `model` beide
// auf `activeModel.name`). Der Mensch las also „anthropic:claude-sonnet-4-6" und musste den
// Modellnamen deuten, um zu wissen, wem seine Texte gezeigt werden. Mit einem ZWEITEN Cloud-Anbieter
// (ChatGPT, JOB 3090) ist das keine Unschönheit mehr, sondern die Frage, die die Zeile beantworten
// muss: WELCHES Unternehmen bekommt die Daten?
//
// DIE QUELLE IST DER CLIENT-NAME, nichts sonst. Ihn setzt der Ort, der die Verbindung wirklich
// aufbaut (`services/reasoner/src/model-client.ts`): `cloud:openai:<modell>`, `anthropic:<modell>`,
// `local:<modell>`. Diese Tabelle übersetzt das Präfix in einen Namen, den ein Mensch kennt — sie
// erfindet nichts dazu und rät nicht: ein unbekanntes Präfix bleibt WÖRTLICH stehen (lieber eine
// rohe Kennung als ein falscher Anbietername).
const ANBIETER_NAME: Readonly<Record<string, string>> = {
  "cloud:openai": "ChatGPT (OpenAI)",
  anthropic: "Claude (Anthropic)",
};

/**
 * Aus dem Client-Namen die Zeile „<Anbieter> · <Modell>" — oder der unveränderte Name, wenn der
 * Anbieter nicht sicher zuzuordnen ist. Reine Ableitung, keine Anzeige-Entscheidung.
 */
export function anbieterUndModell(clientName: string): string {
  for (const [praefix, anbieter] of Object.entries(ANBIETER_NAME)) {
    if (clientName.startsWith(`${praefix}:`)) {
      const modell = clientName.slice(praefix.length + 1);
      return modell.length > 0 ? `${anbieter} · ${modell}` : anbieter;
    }
  }
  return clientName;
}

export function aiAccessRows(cfg: {
  configured: boolean;
  cloudConfigured: boolean;
  provider: string;
  model?: string;
  mode: "model" | "fallback" | "demo";
  // SCRUM-424: eigener lokaler LLM — verdrahtet & auswählbar? + Anzeige-Label.
  localConfigured?: boolean;
  localProvider?: string;
}): AiAccessRow[] {
  return [
    {
      // JOB 3090: das Detail nennt Anbieter UND Modell (s. anbieterUndModell). OHNE
      // Cloud-Konfiguration bleibt es `null` — ein Anbietername ohne Schlüssel wäre eine Behauptung
      // über eine Verbindung, die es nicht gibt.
      id: "cloud",
      state: cfg.cloudConfigured ? "active" : "missing",
      detail: cfg.cloudConfigured ? anbieterUndModell(cfg.model ?? cfg.provider) : null,
    },
    {
      // Der Ersatzmodus ist immer da: „aktiv", wenn er gerade antwortet (kein Modell),
      // sonst „bereit" als ehrliches Sicherheitsnetz hinter dem Modell.
      id: "fallback",
      state: cfg.mode === "model" ? "available" : "active",
      detail: null,
    },
    {
      // SCRUM-424: lokaler LLM „bereit" (verdrahtet & auswählbar), sonst „geplant" (KLLM-61).
      // Ehrlich: „bereit" = verbunden/auswählbar, nicht „gerade aktiv" — die Tunnel-Erreichbarkeit
      // bestätigt der Schlüssel-Test bzw. ein echter Aufruf.
      id: "local",
      state: cfg.localConfigured ? "available" : "planned",
      detail: cfg.localConfigured ? (cfg.localProvider ?? null) : null,
    },
  ];
}
