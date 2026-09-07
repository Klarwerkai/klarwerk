// SCRUM-413 (Pedi 03.07.): „Verfügbare KIs" im Admin — DOM-freie Zeilen aus dem ECHTEN
// configStatus (nur Metadaten, keine Secrets). Ehrlich ausgewiesen:
// (1) die externen Cloud-Anbieter — seit JOB 3134 EINZELN: ChatGPT (OpenAI) und Claude (Anthropic) —,
// (2) der deterministische Ersatzmodus (immer vorhanden),
// (3) der lokale LLM-Server — dessen App-Anschluss ist KLLM-61 und wird bis dahin als
// „geplant" gezeigt (nichts vortäuschen, was die App noch nicht ansprechen kann).
import type { ReasonerCloudAnbieter } from "../api/types";

export type AiAccessId = ReasonerCloudAnbieter | "fallback" | "local";
export type AiAccessState = "active" | "available" | "missing" | "planned";

export interface AiAccessRow {
  id: AiAccessId;
  state: AiAccessState;
  // Modell-/Provider-Label beim Cloud-Zugang; sonst null → lokalisierter Zugangs-Name reicht.
  // JOB 3134: bei einem NICHT eingerichteten Anbieter der Grund (Env-Namen), damit die Zeile sagt,
  // was fehlt, statt nur „nicht konfiguriert".
  detail: string | null;
}

// ================================================================================================
// JOB 3090 — DIE CLOUD-ZEILE NENNT DEN ANBIETER, NICHT NUR EINE KENNUNG.
// ================================================================================================
//
// Bis hierher stand in der Cloud-Zeile `model ?? provider` — und beides ist derselbe Wert: der NAME
// des Modell-Clients (`services/reasoner/src/service.ts` setzt `provider` und `model` beide
// auf den Clientnamen). Der Mensch las also „anthropic:claude-sonnet-4-6" und musste den
// Modellnamen deuten, um zu wissen, wem seine Texte gezeigt werden. Mit einem ZWEITEN Cloud-Anbieter
// (ChatGPT, JOB 3090) ist das keine Unschönheit mehr, sondern die Frage, die die Zeile beantworten
// muss: WELCHES Unternehmen bekommt die Daten?
//
// DIE QUELLE IST DER CLIENT-NAME, nichts sonst. Ihn setzt der Ort, der die Verbindung wirklich
// aufbaut (`services/reasoner/src/model-client.ts`): `cloud:openai:<modell>`, `anthropic:<modell>`,
// `local:<modell>`. Diese Tabelle übersetzt das Präfix in einen Namen, den ein Mensch kennt — sie
// erfindet nichts dazu und rät nicht: ein unbekanntes Präfix bleibt WÖRTLICH stehen (lieber eine
// rohe Kennung als ein falscher Anbietername).
//
// JOB 3134: dieselbe Tabelle trägt jetzt auch den ANBIETERSCHLÜSSEL (openai/anthropic), mit dem die
// Karte den Auswahlwert, den Zugang und den Clientnamen zusammenhält — EIN Verzeichnis, nicht zwei.
const ANBIETER: readonly { praefix: string; anbieter: ReasonerCloudAnbieter; name: string }[] = [
  { praefix: "cloud:openai", anbieter: "openai", name: "ChatGPT (OpenAI)" },
  { praefix: "anthropic", anbieter: "anthropic", name: "Claude (Anthropic)" },
];

/** Der lesbare Name eines externen Anbieters — für Auswahlliste, Status und Prüfergebnis. */
export function anbieterName(anbieter: ReasonerCloudAnbieter): string {
  return ANBIETER.find((eintrag) => eintrag.anbieter === anbieter)?.name ?? anbieter;
}

/** Der Anbieter hinter einem Clientnamen — oder undefined, wenn das Präfix keinem gehört. */
export function anbieterAusClientName(clientName: string): ReasonerCloudAnbieter | undefined {
  return ANBIETER.find((eintrag) => clientName.startsWith(`${eintrag.praefix}:`))?.anbieter;
}

/**
 * Aus dem Client-Namen die Zeile „<Anbieter> · <Modell>" — oder der unveränderte Name, wenn der
 * Anbieter nicht sicher zuzuordnen ist. Reine Ableitung, keine Anzeige-Entscheidung.
 */
export function anbieterUndModell(clientName: string): string {
  for (const { praefix, name } of ANBIETER) {
    if (clientName.startsWith(`${praefix}:`)) {
      const modell = clientName.slice(praefix.length + 1);
      return modell.length > 0 ? `${name} · ${modell}` : name;
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
  // JOB 3134: die beiden Anbieter einzeln. Fehlt das Feld (älterer Server), fällt die Ableitung auf
  // den EINEN Cloud-Client zurück, den `provider`/`model` nennen.
  cloudProviders?: Record<
    ReasonerCloudAnbieter,
    { configured: boolean; name?: string; model?: string; grund?: string }
  >;
}): AiAccessRow[] {
  // JOB 3134: „aktiv" ist der Anbieter, der laut gespeicherter Wahl WIRKLICH antwortet — das ist
  // der Clientname in `provider`/`model` (`configStatus()`, Kette der globalen Wahl). Ein zweiter
  // eingerichteter Anbieter ist „bereit" (wählbar), ein fehlender „nicht konfiguriert" mit Grund.
  const aktiv = cfg.mode === "model" ? anbieterAusClientName(cfg.model ?? cfg.provider) : undefined;
  const cloudZeilen: AiAccessRow[] = (["openai", "anthropic"] as const).map((anbieter) => {
    const status = cfg.cloudProviders?.[anbieter];
    if (status) {
      if (!status.configured) {
        return { id: anbieter, state: "missing", detail: status.grund ?? null };
      }
      return {
        id: anbieter,
        state: aktiv === anbieter ? "active" : "available",
        detail: anbieterUndModell(status.name ?? anbieterName(anbieter)),
      };
    }
    // Älterer Server ohne `cloudProviders`: nur der EINE genannte Cloud-Client ist bekannt.
    const genannt = cfg.cloudConfigured
      ? anbieterAusClientName(cfg.model ?? cfg.provider)
      : undefined;
    return genannt === anbieter
      ? { id: anbieter, state: "active", detail: anbieterUndModell(cfg.model ?? cfg.provider) }
      : { id: anbieter, state: "missing", detail: null };
  });
  return [
    ...cloudZeilen,
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
