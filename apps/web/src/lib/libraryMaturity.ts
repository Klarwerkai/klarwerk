// SCRUM-262: DOM-freie Reife-/Nutzbarkeitsanzeige je Bibliothekstreffer. Leitet die Reife
// AUSSCHLIESSLICH aus dem vorhandenen KO ab (über koOverview → reviewSignals/deriveStatus) und
// übersetzt sie in eine ehrliche Klartext-Aussage: nutzbar (validiert) · in Prüfung · zu prüfen.
// Offene KOs erscheinen damit NIE als „nutzbar". Keine neue Suche, keine Mutation, kein Backend.
import type { KnowledgeObject } from "../api/types";
import { type KoUsability, koOverview } from "./koOverview";
import { useReadiness } from "./useReadiness";

export type MaturityTone = "pos" | "warn" | "neutral";

export interface LibraryMaturity {
  usability: KoUsability;
  labelKey: string;
  tone: MaturityTone;
}

// SCRUM-293: Label + Tönung kommen aus der GETEILTEN Use-Readiness-Sprache (useReadiness), damit
// Bibliothek und KO-Detail für denselben Zustand identische Begriffe zeigen („Nutzbar"/„In Prüfung"/
// „Zu prüfen"). „all" behält seinen eigenen Filter-Key (maturityFilterLabelKey).
const META: Record<KoUsability, { labelKey: string; tone: MaturityTone }> = {
  ready: { labelKey: useReadiness("ready").labelKey, tone: useReadiness("ready").tone },
  "in-review": {
    labelKey: useReadiness("in-review").labelKey,
    tone: useReadiness("in-review").tone,
  },
  "needs-work": {
    labelKey: useReadiness("needs-work").labelKey,
    tone: useReadiness("needs-work").tone,
  },
};

export function libraryMaturity(ko: KnowledgeObject): LibraryMaturity {
  const usability = koOverview(ko).usability;
  return { usability, ...META[usability] };
}

// Hier stand `libraryUseCta` (SCRUM-288). Seit JOB 3063 Runde 5 zieht die Lesefläche ihre Aktion
// für JEDEN Eintrag aus `components/bibliothek/fragen.ts::fragenHref` — dort lebt auch der
// Vertraulichkeitsweg ohne Auto-Senden weiter. Die Reife-Weiche hatte keinen Produktaufrufer mehr
// und ist mit R-1349 entfernt.
//
// R-1349 (Aufnahme gesamt-aufruferwaechter): Hier stand der SCRUM-267-Reifefilter mit seinen Chips —
// `MATURITY_FILTERS`, `maturityFilterLabelKey`, `filterByMaturity`, `countByMaturity` samt Typ. Die
// Chips sind abgelöst: die Bibliothek filtert die Reife als Facette der Facettenschiene über
// `libraryMaturity(ko).usability` (`lib/libraryFacets.ts`, R-0991 Nr. 40–43). Keiner der vier hatte
// einen Produktleser; sie sind entfernt.
