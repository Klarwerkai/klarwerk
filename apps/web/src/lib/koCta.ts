// SCRUM-259: DOM-freier CTA-Helfer fürs KO-Detail. Macht aus der bereits abgeleiteten
// `KoNextAction` (siehe koOverview.ts) eine ehrliche, klare Arbeitsführung im Stage-1-Kreis
// Capture → Validate → Use → Maintain. Verweist AUSSCHLIESSLICH auf vorhandene Routen/Bereiche —
// keine neue Mutation, kein neuer Flow, kein Backend.
import type { KoNextAction } from "./koOverview";

// route → echte vorhandene Seite; anchor → lokale Orientierung auf derselben Detailseite.
export type KoCtaKind = "route" | "anchor";
export type KoCtaTone = "primary" | "neutral";

export interface KoCta {
  labelKey: string;
  href: string;
  kind: KoCtaKind;
  tone: KoCtaTone;
}

// Abbildung der nächsten Handlung auf eine vorhandene Ziel-/Orientierungsaktion:
//  - validate/review → Validierungsboard (/validierung): offene/zu prüfende KOs ehrlich dorthin.
//  - use            → Fragen (/fragen): validiertes Wissen wird dort quellengebunden genutzt.
//  - addSource      → lokaler Anker (#ko-sources) auf den vorhandenen Quellenbereich derselben
//                     Seite — KEIN neuer Import-/Source-Workflow, nur Orientierung.
const CTA: Record<KoNextAction, KoCta> = {
  validate: { labelKey: "ko.cta.validate", href: "/validierung", kind: "route", tone: "primary" },
  review: { labelKey: "ko.cta.review", href: "/validierung", kind: "route", tone: "primary" },
  use: { labelKey: "ko.cta.use", href: "/fragen", kind: "route", tone: "primary" },
  addSource: { labelKey: "ko.cta.addSource", href: "#ko-sources", kind: "anchor", tone: "neutral" },
};

export function koCta(action: KoNextAction): KoCta {
  return CTA[action];
}
