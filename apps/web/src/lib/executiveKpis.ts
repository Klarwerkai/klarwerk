// SCRUM-431 (Pedi 03.07., VIP): „Executive-Blick" — eine ruhige Kennzahl-Kachelzeile in der
// Management-Sicht. AUSSCHLIESSLICH aus vorhandenen Live-Daten abgeleitet (KO-Bestand, Bus-Faktor,
// Wissenslücken) — keine erfundenen Zahlen, keine neue Datenquelle, keine Persistenz. Reine
// Funktion → testbar ohne DOM.
import type { BusFactorEntry, Gap, KnowledgeObject } from "../api/types";

export interface ExecutiveKpis {
  // Validiertes Wissen (Status „validiert") — die belastbare Aktiva-Basis.
  validated: number;
  // Offene Prüfungen (Status „offen") — Wissen, das noch auf Validierung wartet.
  openReviews: number;
  // Bus-Faktor-Risiko: Kategorien, die nur an EINER Person hängen (Einzelquelle).
  singleSourceCategories: number;
  // Gerettete Wissenslücken: Fragen, zu denen die Lücke inzwischen geschlossen wurde.
  rescuedGaps: number;
}

export function executiveKpis(input: {
  kos: readonly KnowledgeObject[];
  gaps: readonly Gap[];
  busFactor: readonly BusFactorEntry[];
}): ExecutiveKpis {
  return {
    validated: input.kos.filter((k) => k.status === "validiert").length,
    openReviews: input.kos.filter((k) => k.status === "offen").length,
    singleSourceCategories: input.busFactor.filter((b) => b.singleSource).length,
    rescuedGaps: input.gaps.filter((g) => g.status === "geschlossen").length,
  };
}
