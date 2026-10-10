import { useEffect, useState } from "react";

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
export function personenAktuell(
  dataUpdatedAt: number,
  jetzt: number,
  takt: number = LIVEWALL_TAKT_MS,
): boolean {
  return dataUpdatedAt > 0 && jetzt - dataUpdatedAt <= 3 * takt;
}

/**
 * Die Uhr, gegen die `personenAktuell` prüft — im Takt NEU GELESEN, nicht nur beim Rendern.
 *
 * Nacharbeit 5: die Abfrage rendert eine Komponente nur neu, wenn sich eine GELESENE Eigenschaft
 * ändert (`data`, `dataUpdatedAt`, `isError`). Ab dem zweiten gescheiterten Abruf ändert sich keine
 * davon mehr — ohne eigene Uhr lief die Frischeprüfung also nie wieder, und ein Name blieb bei
 * Netzausfall für immer stehen. Diese Uhr erzwingt die Neuprüfung je Takt, unabhängig vom Abruf.
 */
export function useJetzt(takt: number): number {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    const uhr = setInterval(() => setJetzt(Date.now()), takt);
    return () => clearInterval(uhr);
  }, [takt]);
  return jetzt;
}
