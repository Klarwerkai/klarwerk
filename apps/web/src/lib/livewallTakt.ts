// ================================================================================================
// R-0740 / PMO-FEA-0003 — DIE WAND AKTUALISIERT SICH LAUFEND.
// ================================================================================================
//
// „Eine Anzeige auf der Startseite zeigt LAUFEND, welches Wissen zuletzt gesichert wurde …"
// Bis hierher holte sich die Wand nur beim Laden, beim Fokus und auf „Wiederholen" neu. Eine offen
// stehende Wand — erst recht eine projizierte — zeigte damit neue Einträge nicht, und ein
// ANDERSWO erklärter Widerruf ließ Name und Foto stehen, bis jemand neu lud.
//
// Der Server rechnet Sichtrechte, Namen und Fotos bei JEDEM Abruf neu (livewall-routes.ts). Ein
// fester Takt genügt deshalb, damit neue Inhalte, Sichtrechtsänderungen und Widerrufe in einer
// offenen Wand ankommen — spätestens nach einem Takt.
export const LIVEWALL_TAKT_MS = 30_000;

/**
 * Personenangaben (Name, Foto) nur aus einem FRISCHEN Stand. Reißt die Verbindung ab, bliebe sonst
 * ein inzwischen widerrufener Name unbegrenzt stehen — der letzte geglückte Abruf wäre die einzige
 * Wahrheit. Nach drei verpassten Takten zeigt die Wand deshalb keine Personen mehr, die Einträge
 * selbst aber weiter (sie sind keine Personenangabe).
 */
export function personenAktuell(dataUpdatedAt: number, jetzt: number): boolean {
  return dataUpdatedAt > 0 && jetzt - dataUpdatedAt <= 3 * LIVEWALL_TAKT_MS;
}
