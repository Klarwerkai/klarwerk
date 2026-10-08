// R-0890 / R-0935 · Die Bibliotheksartikel (`lib/hilfeBibliothek.ts`) als fertige, bereits aufgelöste
// Einträge für Klaras SICHTBARE Suche — in der Sprache der Oberfläche (DE/EN/NL). Titel ist der
// Kapiteltitel, Text sind die fünf Teile mit ihren Überschriften, `route` das Ziel des Kapitels.
//
// EIGENE DATEI, NACHGELADEN (Nacharbeit 6): Klara steht in der Hülle jeder Seite, `klaraRegistry`
// liegt damit im ersten geladenen Brocken. Die Artikel dort statisch einzubinden hob den Eintritt
// über den Deckel aus R-0801 (`tests/erstladezeit/eintritt-ohne-seiten.test.ts`, gemessen 1403861 B
// gegen 1360000 B). Das Panel lädt diese Datei erst beim Öffnen (`import()` in `KlaraAssistant`).
//
// BEWUSST NICHT in der KI-Grundlage (`rankKlara` im Panel): die zwölf Schnipsel dort sind gemessen
// knapp belegt (`tests/app/f0304-klara-assistenzflaeche.test.tsx`, die Duplikat-Antwort hält sich
// auf Platz 11 von 12). 22 lange Artikel würden kurze, geprüfte Antworten aus der Grundlage drängen.
// Der Aufrufer reicht `t` herein — diese Datei bleibt i18n-frei testbar.
import { HELP_TOPICS } from "./helpTopics";
import {
  BIBLIOTHEK_TEILE,
  type BibliothekTeil,
  FUNKTIONS_ARTIKEL,
  funktionsArtikel,
  hilfeArtikel,
} from "./hilfeBibliothek";
import type { ResolvedKlaraEntry } from "./klaraRegistry";

export function allBibliothekEntries(
  language: string,
  t: (key: string) => string,
): ResolvedKlaraEntry[] {
  const ueberschrift = (teil: BibliothekTeil): string => t(`hilfebibliothek.teil.${teil}`);
  const mitUeberschriften = (teile: Readonly<Record<BibliothekTeil, string>>): string =>
    BIBLIOTHEK_TEILE.map((teil) => `${ueberschrift(teil)} ${teile[teil]}`).join(" ");
  const bereiche = HELP_TOPICS.flatMap((topic) => {
    const artikel = hilfeArtikel(topic.id, language);
    if (!artikel) {
      return [];
    }
    return [
      {
        id: `artikel:${topic.id}`,
        kind: "artikel" as const,
        titleKey: "",
        bodyKey: "",
        route: topic.to,
        title: t(topic.titleKey),
        body: mitUeberschriften(artikel),
      },
    ];
  });
  // Nacharbeit 5: auch die Funktionsartikel (Diktieren, Interview, Wissensarten …).
  const funktionen = FUNKTIONS_ARTIKEL.map((artikel) => {
    const { titel, teile } = funktionsArtikel(artikel, language);
    return {
      id: `artikel:${artikel.id}`,
      kind: "artikel" as const,
      titleKey: "",
      bodyKey: "",
      route: artikel.route,
      title: titel,
      body: mitUeberschriften(teile),
    };
  });
  return [...bereiche, ...funktionen];
}
