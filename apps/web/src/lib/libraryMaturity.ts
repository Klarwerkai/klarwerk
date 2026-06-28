// SCRUM-262: DOM-freie Reife-/Nutzbarkeitsanzeige je Bibliothekstreffer. Leitet die Reife
// AUSSCHLIESSLICH aus dem vorhandenen KO ab (über koOverview → reviewSignals/deriveStatus) und
// übersetzt sie in eine ehrliche Klartext-Aussage: nutzbar (validiert) · in Prüfung · zu prüfen.
// Offene KOs erscheinen damit NIE als „nutzbar". Keine neue Suche, keine Mutation, kein Backend.
import type { KnowledgeObject } from "../api/types";
import { type KoUsability, koOverview } from "./koOverview";

export type MaturityTone = "pos" | "warn" | "neutral";

export interface LibraryMaturity {
  usability: KoUsability;
  labelKey: string;
  tone: MaturityTone;
}

// Usability → Klartext-Label + Tönung. „ready" (validiert) = nutzbar; „in-review" (in Prüfung /
// Revalidierung) = in Prüfung; „needs-work" (offen) = zu prüfen.
const META: Record<KoUsability, { labelKey: string; tone: MaturityTone }> = {
  ready: { labelKey: "lib.maturity.usable", tone: "pos" },
  "in-review": { labelKey: "lib.maturity.review", tone: "warn" },
  "needs-work": { labelKey: "lib.maturity.open", tone: "neutral" },
};

export function libraryMaturity(ko: KnowledgeObject): LibraryMaturity {
  const usability = koOverview(ko).usability;
  return { usability, ...META[usability] };
}
