// SCRUM-258: Reine, DOM-freie Beschreibung der drei Review-Entscheidungen für die Validierungskarte.
// Macht die Entscheidung textlich führbar (Freigeben/Rückfrage/Ablehnen), OHNE die bestehende Logik
// zu ändern: die Verdicts bleiben "up"/"warn"/"down" und damit die vorhandenen Mutationen. Gelb/Rot
// (warn/down) verlangen weiterhin Pflicht-Feedback (requiresFeedback).
import { askQuestionHref } from "./askQuestion";
import { reworkHref } from "./reviewReworkContext";
import type { FeedbackVerdict } from "./validationFeedback";

export type ReviewVerdict = "up" | FeedbackVerdict; // "up" | "warn" | "down"
export type ReviewTone = "pos" | "warn" | "crit";

export interface ReviewDecision {
  verdict: ReviewVerdict;
  labelKey: string; // i18n-Key für das sichtbare Label
  tone: ReviewTone; // Tönung der Schaltfläche
  requiresFeedback: boolean; // warn/down → Begründung Pflicht
}

export const REVIEW_DECISIONS: readonly ReviewDecision[] = [
  { verdict: "up", labelKey: "val.actionApprove", tone: "pos", requiresFeedback: false },
  { verdict: "warn", labelKey: "val.actionQuery", tone: "warn", requiresFeedback: true },
  { verdict: "down", labelKey: "val.actionReject", tone: "crit", requiresFeedback: true },
];

// SCRUM-277/329: nach einer Bewertungsentscheidung je Verdict eine ehrliche Folgehandlung zeigen —
// KEINE Sackgasse, OHNE Backend-/Statusänderung:
//  - up:        KO ansehen (/wissen/:id) + Wissen nutzen (/fragen?q=<Titel> via askQuestionHref).
//               Kein Auto-Submit, keine automatische Freigabe (Ask zeigt den echten Status/Lücke).
//  - warn/down: Im KO nacharbeiten (/wissen/:id) — Rückfrage/Ablehnung bleiben Review-/Feedback-Arbeit
//               (dort liegen Kommentare/Revision). Keine automatische Rückgabe/Schließung, kein
//               Use-Schritt. Reine, testbare Logik.
export interface ReviewNextStep {
  labelKey: string;
  to: string; // vorhandene Route
}

export function reviewNextSteps(decision: {
  id: string;
  title: string;
  verdict: ReviewVerdict;
}): ReviewNextStep[] {
  if (decision.verdict === "up") {
    return [
      { labelKey: "val.nextViewKo", to: `/wissen/${decision.id}` },
      { labelKey: "val.nextUse", to: askQuestionHref(decision.title) },
    ];
  }
  // SCRUM-330: Nacharbeitskontext per Query (?rework=review) → KO-Detail zeigt den Nacharbeits-Hinweis.
  return [{ labelKey: "val.nextRework", to: reworkHref(decision.id) }];
}

// SCRUM-292: ehrliche „was passiert jetzt mit dem Wissen"-Aussage je Verdict — OHNE zu behaupten,
// dass eine einzelne Freigabe-Stimme automatisch vollständig validiert (das garantiert das
// Datenmodell nicht). `usable` markiert NUR, dass bei „up" grundsätzlich der Weg in die
// quellengebundene Nutzung offensteht, WENN Status/Trust es tragen — Ask/KO-Detail zeigen den
// echten Status selbst. Reine, DOM-freie Logik; keine Backend-/Mutationsänderung, keine Freigabe.
export type ReviewOutcomeTone = "pos" | "warn" | "crit";

export interface ReviewOutcome {
  verdict: ReviewVerdict;
  statusKey: string; // i18n-Key: ehrliche Folge-Aussage
  tone: ReviewOutcomeTone;
  usable: boolean; // up → grundsätzlich nutzbarer Weg (status/trust-abhängig); sonst Review-Arbeit
}

const OUTCOMES: Record<ReviewVerdict, ReviewOutcome> = {
  up: { verdict: "up", statusKey: "val.outcome.up", tone: "pos", usable: true },
  warn: { verdict: "warn", statusKey: "val.outcome.warn", tone: "warn", usable: false },
  down: { verdict: "down", statusKey: "val.outcome.down", tone: "crit", usable: false },
};

export function reviewOutcome(verdict: ReviewVerdict): ReviewOutcome {
  return OUTCOMES[verdict];
}

// ================================================================================================
// STATUS-FREIGABE (produkt:20261007) · WAS EINE EINZELNE ZUSTIMMUNG WIRKLICH BEWIRKT HAT.
// ================================================================================================
//
// Die Bewertung antwortet mit der Stimmenlage NACH der eigenen Stimme (`ValidationService.rate`:
// `up`, `warn`, `down`, `status`). Bisher warf die Fläche diese Antwort weg und sagte allgemein
// „automatisch validiert wird dadurch nichts" — auch dann, wenn genau diese Stimme die letzte
// erforderliche war. Hier entsteht der Satz aus der Antwort: die eigene Stimme, wie viele positive
// Bewertungen erforderlich sind und wie viele noch fehlen. „Validiert" sagt er NUR, wenn der Server
// `status: "validiert"` gemeldet hat — die Zählung hier rechnet nichts frei, sie liest ab.
// Die erforderliche Zahl kommt aus der Prüfzeile (`neededValidations`), dieselbe wie bei den Punkten.

export interface Stimmenlage {
  readonly up: number;
  readonly down: number;
  readonly validiert: boolean;
  /** `null` = die erforderliche Zahl ist nicht bekannt. */
  readonly needed: number | null;
}

function zahl(wert: unknown): number | null {
  return typeof wert === "number" && Number.isInteger(wert) && wert >= 0 ? wert : null;
}

/** Die Stimmenlage aus der Serverantwort — `null`, wenn die Antwort keine trägt. */
export function stimmenlageAus(antwort: unknown, needed: number | undefined): Stimmenlage | null {
  if (typeof antwort !== "object" || antwort === null) {
    return null;
  }
  const roh = antwort as Record<string, unknown>;
  const up = zahl(roh.up);
  const down = zahl(roh.down);
  if (up === null || down === null || (roh.status !== "offen" && roh.status !== "validiert")) {
    return null;
  }
  const bedarf = typeof needed === "number" && needed >= 1 ? needed : null;
  return { up, down, validiert: roh.status === "validiert", needed: bedarf };
}

export interface Zustimmungsquittung {
  readonly art: "validiert" | "offen" | "blockiert" | "unbekannt";
  readonly schluessel: string;
  readonly werte: Record<string, number>;
}

/** Der Quittungssatz einer Zustimmung — ohne Stimmenlage ehrlich „unbekannt", nie „validiert". */
export function zustimmungsquittung(lage: Stimmenlage | null): Zustimmungsquittung {
  if (!lage) {
    return { art: "unbekannt", schluessel: "statusfreigabe.zustimmung.unbekannt", werte: {} };
  }
  if (lage.validiert) {
    return lage.needed === null
      ? { art: "validiert", schluessel: "statusfreigabe.zustimmung.validiert", werte: {} }
      : {
          art: "validiert",
          schluessel: "statusfreigabe.zustimmung.validiertZahl",
          werte: { have: lage.up, need: lage.needed },
        };
  }
  const rest = lage.needed === null ? 0 : Math.max(0, lage.needed - lage.up);
  if (lage.down > 0) {
    // Ben (nacharbeit-2): auch blockiert bleiben Bedarf und Rest sichtbar, sofern bekannt — die
    // rote Bewertung kommt HINZU, sie ersetzt die Zahlen nicht. Validiert wird nichts behauptet.
    if (lage.needed === null) {
      return {
        art: "blockiert",
        schluessel: "statusfreigabe.zustimmung.blockiert",
        werte: { count: lage.down, have: lage.up },
      };
    }
    return {
      art: "blockiert",
      schluessel:
        rest > 0
          ? "statusfreigabe.zustimmung.blockiertRest"
          : "statusfreigabe.zustimmung.blockiertGenug",
      werte: { count: lage.down, have: lage.up, need: lage.needed, rest },
    };
  }
  if (lage.needed === null || rest === 0) {
    // Offen, aber keine fehlende Zahl ablesbar: dann wird keine erfunden.
    return {
      art: "offen",
      schluessel: "statusfreigabe.zustimmung.offenOhneRest",
      werte: { have: lage.up },
    };
  }
  return {
    art: "offen",
    schluessel: "statusfreigabe.zustimmung.offen",
    werte: { count: rest, have: lage.up, need: lage.needed },
  };
}
