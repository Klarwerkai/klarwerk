// SCRUM-359 / AG-05 / PI-K2: DOM-freie Trust-Transparenz. Erklärt ruhig und für Beta-Nutzer
// verständlich, WARUM Trust/Status so stehen — AUSSCHLIESSLICH aus bereits abgeleiteten Feldern
// (Trust-Band + Use-Nutzbarkeit). Kernaussagen (progressive disclosure, kleine Erklärung):
//  - Trust ist ein Review-/Evidenzsignal, KEINE Wahrheitsgarantie (PI-K2).
//  - Gelb/Rot/Konflikt bedeuten Review-/Nacharbeitsbedarf.
// Keine neue Bewertungslogik, kein neues Statusmodell, kein Backend. Reine Funktion → testbar ohne DOM.
import type { KoUsability } from "./koOverview";
import type { TrustBand } from "./reviewSignals";

export type TrustExplainTone = "pos" | "warn" | "neutral";

export interface TrustExplainer {
  titleKey: string; // „Was bedeutet Trust?" (Summary der progressive-disclosure)
  metaKey: string; // PI-K2: Trust ist Review-/Evidenzsignal, keine Wahrheitsgarantie
  bandKey: string; // Erklärung der Trust-Höhe (high/mid/low)
  bandTone: TrustExplainTone;
  // Review-/Nacharbeitshinweis, wenn das KO NICHT uneingeschränkt nutzbar ist (offen/in Prüfung/
  // konfliktbegrenzt). null, wenn nutzbar (ready) — dann reicht die Meta-/Band-Erklärung.
  reviewHintKey: string | null;
}

const BAND: Record<TrustBand, { key: string; tone: TrustExplainTone }> = {
  high: { key: "trust.explain.band.high", tone: "pos" },
  mid: { key: "trust.explain.band.mid", tone: "warn" },
  low: { key: "trust.explain.band.low", tone: "warn" },
};

export function trustExplainer(input: {
  trustBand: TrustBand;
  usability: KoUsability;
}): TrustExplainer {
  const band = BAND[input.trustBand];
  return {
    titleKey: "trust.explain.title",
    metaKey: "trust.explain.meta",
    bandKey: band.key,
    bandTone: band.tone,
    reviewHintKey: input.usability === "ready" ? null : "trust.explain.review",
  };
}
