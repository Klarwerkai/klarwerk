// WP-D10 (Fix 3, Pedis Live-Befund): „model-error" war zu grob — für die ehrliche Fallback-Ursache
// (und das PII-freie Diagnose-Log) braucht der Reasoner die FEHLERKLASSE eines gescheiterten
// Modellaufrufs. Die HTTP-Clients (model-client.ts) werfen dafür typisierte Fehler; die Klassifizierung
// hier bleibt zusätzlich robust gegen fremde/injizierte Clients (Tests, künftige Provider), die nur
// generische Errors mit den etablierten Meldungen werfen — dann greifen Meldungs-Heuristiken.
// Es wird NIE Prompt-/Antwortinhalt transportiert: nur Klasse, optionaler HTTP-Status, Meldung.

// AUFTRAG-mega4 Block D (bens Sammel-Review 4): „unknown" ist der ehrliche Rückfall für einen
// uneingeordneten geworfenen Fehler. Er darf NICHT als „network" verkleidet werden — sonst meldet die
// nutzerseitige Ableitung (reasonFromModelFailure: network → unreachable) „Anbieter nicht erreichbar",
// obwohl dafür kein Netzbeleg existiert. „unknown" bleibt beim generischen „model-error".
export type ModelFailureClass = "timeout" | "http" | "network" | "parse" | "unknown";

// Zeitlimit überschritten (AbortController im Client). Meldung bleibt identisch zur bisherigen
// generischen Error-Meldung — bestehende Aufrufer/Anzeigen (z. B. extract-Fallback-Note) unverändert.
export class ModelTimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(message: string, timeoutMs: number) {
    super(message);
    this.name = "ModelTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

// Nicht-2xx-Antwort der Modell-API (401/429/500 …) — der Status ist Diagnose-Gold (Quota vs. Key).
export class ModelHttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ModelHttpError";
    this.status = status;
  }
}

// AUFTRAG-mega18 Block E (SCRUM-544): WARUM eine Modellantwort ohne Antwortinhalt ankam. Drei
// unterscheidbare Wege, die vorher alle im selben stillen "" endeten:
//  - "reasoning-only": das Modell hat GEDACHT (eigenes Feld reasoning/reasoning_content/thinking),
//    aber keinen Antwortinhalt geliefert (Denkmodelle wie qwen3 verbrauchen ihr Budget im Denken).
//    Der Denk-TEXT ist KEIN Antwortinhalt und wird nie als Ergebnis weitergegeben — nur der Zustand.
//  - "truncated": die Antwort brach am Token-Limit ab (finish_reason "length"), bevor Inhalt entstand.
//  - "empty": Inhalt fehlt/ist leer bzw. die Antwortform weicht ab (kein choices/message/content).
export type ModelEmptyReason = "reasoning-only" | "truncated" | "empty";

// AUFTRAG-mega18 Block E (SCRUM-544): eine leere Modellantwort darf NIE stillschweigend als Ergebnis
// gelten. Der Client wirft stattdessen diesen typisierten Fehler; er trägt ausschließlich METADATEN
// (Grund, finish_reason, ob eine Denkphase da war, Token-Budget) — NIE Antwort-, Denk- oder Prompttext.
export class ModelEmptyResponseError extends Error {
  readonly reason: ModelEmptyReason;
  readonly finishReason: string | undefined;
  readonly sawReasoning: boolean;
  readonly maxTokens: number | undefined;
  constructor(
    message: string,
    detail: {
      reason: ModelEmptyReason;
      finishReason?: string | undefined;
      sawReasoning?: boolean;
      maxTokens?: number | undefined;
    },
  ) {
    super(message);
    this.name = "ModelEmptyResponseError";
    this.reason = detail.reason;
    this.finishReason = detail.finishReason;
    this.sawReasoning = detail.sawReasoning === true;
    this.maxTokens = detail.maxTokens;
  }
}

export interface ModelFailureInfo {
  failureClass: ModelFailureClass;
  status?: number;
}

export function classifyModelFailure(err: unknown): ModelFailureInfo {
  if (err instanceof ModelTimeoutError) {
    return { failureClass: "timeout" };
  }
  if (err instanceof ModelHttpError) {
    return { failureClass: "http", status: err.status };
  }
  // Modellantwort war kein gültiges JSON (JSON.parse im Provider) → parse.
  if (err instanceof SyntaxError) {
    return { failureClass: "parse" };
  }
  // AUFTRAG-mega18 Block E (SCRUM-544): Antwort kam an, trug aber keinen Antwortinhalt (leer,
  // abgeschnitten oder nur Denkphase) → "parse" = unbrauchbare Antwortform. Nutzerseitig wird daraus
  // ehrlich "bad-response" ("Antwort unbrauchbar") statt des irreführenden generischen "model-error".
  if (err instanceof ModelEmptyResponseError) {
    return { failureClass: "parse" };
  }
  // Heuristik für generische Errors (injizierte Test-Clients, fremde Provider) — Meldungsmuster der
  // etablierten Client-Fehlertexte.
  const message = err instanceof Error ? err.message : String(err);
  if (/Zeitlimit|timed?\s*-?\s*out|timeout/i.test(message)) {
    return { failureClass: "timeout" };
  }
  const httpMatch = /antwortete mit (\d{3})/.exec(message);
  if (httpMatch?.[1]) {
    return { failureClass: "http", status: Number(httpMatch[1]) };
  }
  if (/JSON/i.test(message)) {
    return { failureClass: "parse" };
  }
  // AUFTRAG-mega4 Block D (bens Blocker): NUR eng benannte Netz-/DNS-Signale (bzw. ein typisierter
  // Netzfehler) dürfen „network" ergeben — sie tragen es später ehrlich als „unreachable". Ein
  // fetch-TypeError bringt in Node „fetch failed"/„getaddrinfo …"; nur solche BELEGTEN Signale
  // rechtfertigen „Anbieter nicht erreichbar".
  if (
    /ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|EPIPE|getaddrinfo|fetch\s*failed|socket\s*hang\s*up|connection\s*(refused|reset)|network\s*error|nicht\s*erreichbar/i.test(
      message,
    )
  ) {
    return { failureClass: "network" };
  }
  // Ein beliebiger, uneingeordneter geworfener Fehler ist NICHT belegt ein Netzfehler — ehrlicher
  // Rückfall „unknown" (der Runner bildet daraus generisch „model-error", nicht „unreachable").
  return { failureClass: "unknown" };
}
