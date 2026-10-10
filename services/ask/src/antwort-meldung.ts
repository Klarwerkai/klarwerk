import { createHash } from "node:crypto";

// ================================================================================================
// R-1089 / R-1721 — „ANTWORT FALSCH" ODER „QUELLE PASST NICHT" MELDEN.
// ================================================================================================
//
// Die Meldung landet NICHT in einem Sammelbecken, sondern bei der verantwortlichen Person des
// zitierten Wissensobjekts (`responsibleOf`: benannter Eigentümer, sonst der benannte Autor-Ersatz).
// Sie ist an denselben Antwort-Beleg gebunden wie „Hat geholfen": gemeldet werden kann nur eine
// Quelle, die diesem Nutzer in diesem Antwortvorgang tatsächlich ausgeliefert wurde.
//
// BEWUSST OHNE FREITEXT. Die Meldung liegt im hashverketteten, nicht löschbaren Protokoll; ein
// freier Text darin könnte personenbezogene Angaben tragen, die sich nie mehr entfernen lassen.
// Der Grund ist deshalb eine geschlossene Auswahl. Auch der Fragetext reist nicht mit — er gehört
// dem Fragenden (dieselbe Regel wie bei den redigierten Wissenslücken).

export const ANTWORT_MELDE_GRUENDE = ["antwort-falsch", "quelle-passt-nicht"] as const;
export type AntwortMeldeGrund = (typeof ANTWORT_MELDE_GRUENDE)[number];

export function isAntwortMeldeGrund(value: unknown): value is AntwortMeldeGrund {
  return typeof value === "string" && (ANTWORT_MELDE_GRUENDE as readonly string[]).includes(value);
}

export const ANTWORT_MELDUNG_ACTION = "answer.reported" as const;

/**
 * Die Quittung an den Meldenden. Sie nennt, WOHIN die Meldung ging (Eigentümer oder Autor-Ersatz),
 * aber nicht WER das ist — die Kennung der verantwortlichen Person ist kein Teil der Auskunft.
 */
export interface AntwortMeldungQuittung {
  meldungId: string;
  /** Leer nur bei einer Beanstandung „Quelle fehlt" ohne gewählte Quelle. */
  koId: string;
  koTitle: string;
  grund: AntwortMeldeGrund;
  at: string;
  /** `niemand`: keine Quelle, also keine verantwortliche Person — der Vorgang bleibt sichtbar offen. */
  zugestelltAn: "owner" | "author-fallback" | "niemand";
  /** true: dieselbe Quelle wurde aus diesem Antwortvorgang schon gemeldet — nichts doppelt zugestellt. */
  bereitsGemeldet: boolean;
  /**
   * produkt:20261010:antwort-beanstandung-korrektur: nur bei einer Beanstandung einer konkreten
   * Aussage — der eigene Vorgang des Melders und die signierte Bindung, auf die er sich stützt.
   */
  beanstandung?: {
    /** Die Wissenslücke, über die die Beanstandung bearbeitet wird (`/api/gaps/:id/vorgang`). */
    vorgangId: string;
    answerId: string | null;
    aussageId: string;
    aussageFingerabdruck: string;
    /** Die Fassung der Quelle in DIESER Antwort; `null` ohne Quelle. */
    koVersion: number | null;
    fundstelleId: string | null;
    quelleFehlt: boolean;
    /** true: dieselbe Aussage war schon beanstandet — diese Meldung ist dem Vorgang zugeführt. */
    zusammengefuehrt: boolean;
    /** Ist eine zuständige Person zugeordnet? Sonst steht der Vorgang offen ohne Zuständigkeit. */
    zustaendigkeit: "zugeordnet" | "offen";
  };
}

/**
 * Die Ereigniskennung einer Beanstandung: die der einfachen Meldung, erweitert um Aussage und Art.
 * Zwei Aussagen derselben Antwort sind zwei Meldungen; derselbe Klick zweimal ist eine.
 */
export function beanstandungEventId(
  basis: string,
  aussageId: string,
  fundstelleId: string | null,
  quelleFehlt: boolean,
): string {
  return `${basis}:${aussageId}${fundstelleId ? `:${fundstelleId}` : ""}${quelleFehlt ? ":quelle-fehlt" : ""}`;
}

/**
 * Eine Meldung je Nutzer, Quelle, Grund und ANTWORTVORGANG. Ein Doppelklick erzeugt so keine
 * zweite Meldung; dieselbe Quelle in einer späteren Antwort ist eine neue Beobachtung und darf
 * erneut gemeldet werden. Der Beleg selbst steht nicht im Schlüssel, nur sein Fingerabdruck.
 */
export function antwortMeldungEventId(
  actor: string,
  koId: string,
  grund: AntwortMeldeGrund,
  receipt: string,
): string {
  const beleg = createHash("sha256").update(receipt).digest("hex").slice(0, 16);
  return `${ANTWORT_MELDUNG_ACTION}:${actor}:${koId}:${grund}:${beleg}`;
}

/** Die vorzeigbare Meldungsnummer — aus dem Ereignisschlüssel, also bei jeder Wiederholung gleich. */
export function antwortMeldungId(eventId: string): string {
  return `M-${createHash("sha256").update(eventId).digest("hex").slice(0, 10).toUpperCase()}`;
}
