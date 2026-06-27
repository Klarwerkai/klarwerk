// SCRUM-227: DOM-freie, stabile Sektionsliste des Kapital-Dashboards. Dient als einzige Quelle
// für die Sprungmarken-Leiste UND die Anker-IDs der vorhandenen Sektionen — Alt-App-Nutzer
// finden die in der Stufe-2-Kapital-Sicht konsolidierten Management-Flächen wieder.
// Keine neuen Daten, keine neue Engine — nur Orientierung + Deep-Link-Fähigkeit per Hash-Anker.

export interface CapitalSection {
  id: string; // stabiler, kurzer Schlüssel
  labelKey: string; // i18n — Wiederverwendung der bestehenden mgmt.*-Labels
}

// Reihenfolge entspricht 1:1 der gerenderten Sektionsreihenfolge im CapitalDashboard.
export const CAPITAL_SECTIONS: readonly CapitalSection[] = [
  { id: "overview", labelKey: "mgmt.overview" },
  { id: "capital", labelKey: "mgmt.capital" },
  { id: "valuation", labelKey: "mgmt.valuation" },
  { id: "statement", labelKey: "mgmt.statement" },
  { id: "maturity", labelKey: "mgmt.maturity" },
  { id: "house", labelKey: "mgmt.house" },
  { id: "recommendations", labelKey: "mgmt.recommendations" },
  { id: "priorities", labelKey: "mgmt.priorities" },
  { id: "pilot", labelKey: "mgmt.pilot" },
];

// Stabile DOM-Anker-ID (Präfix verhindert Kollisionen mit anderen Element-IDs).
export function sectionAnchor(id: string): string {
  return `kapital-${id}`;
}

// Hash-Ziel für die Sprungmarken-Leiste.
export function sectionHref(id: string): string {
  return `#${sectionAnchor(id)}`;
}
