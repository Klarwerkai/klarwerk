// R-0890 / R-0935 · Die Bibliotheksartikel (`lib/hilfeBibliothek.ts`) als fertige, bereits aufgelöste
// Einträge für Klaras SICHTBARE Suche — in der Sprache der Oberfläche (DE/EN/NL). Titel ist der
// Kapiteltitel, Text sind die fünf Teile mit ihren Überschriften, `route` das Ziel des Kapitels.
//
// EIGENE DATEI, NACHGELADEN (Nacharbeit 6): Klara steht in der Hülle jeder Seite, `klaraRegistry`
// liegt damit im ersten geladenen Brocken. Die Artikel dort statisch einzubinden hob den Eintritt
// über den Deckel aus R-0801 (`tests/erstladezeit/eintritt-ohne-seiten.test.ts`, gemessen 1403861 B
// gegen 1360000 B). Das Panel lädt diese Datei erst beim Öffnen (`import()` in `KlaraAssistant`).
//
// R-0943 (Nacharbeit 7, Ben): auch die KI-Grundlage greift auf die Bibliothek zu — nicht mit dem
// ganzen Artikel (der würde am Schnitt der Anwendung bei 700 Zeichen abreißen), sondern mit je
// einem AUSZUG pro Artikelteil (`bibliothekAuszuege`). Wie viele Auszüge in die zwölf Schnipsel
// kommen und wen sie verdrängen dürfen, regelt `klaraGrundlage` in `lib/klaraRegistry.ts`.
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

interface ArtikelQuelle {
  id: string;
  route: string;
  titel: string;
  teile: Readonly<Record<BibliothekTeil, string>>;
}

/** Bereichs- und Funktionsartikel in der Sprache der Oberfläche — Quelle für beide Sichten. */
function artikelQuellen(language: string, t: (key: string) => string): ArtikelQuelle[] {
  const bereiche = HELP_TOPICS.flatMap((topic) => {
    const teile = hilfeArtikel(topic.id, language);
    return teile ? [{ id: topic.id, route: topic.to, titel: t(topic.titleKey), teile }] : [];
  });
  // Nacharbeit 5: auch die Funktionsartikel (Diktieren, Interview, Wissensarten …).
  const funktionen = FUNKTIONS_ARTIKEL.map((artikel) => {
    const { titel, teile } = funktionsArtikel(artikel, language);
    return { id: artikel.id, route: artikel.route, titel, teile };
  });
  return [...bereiche, ...funktionen];
}

export function allBibliothekEntries(
  language: string,
  t: (key: string) => string,
): ResolvedKlaraEntry[] {
  const ueberschrift = (teil: BibliothekTeil): string => t(`hilfebibliothek.teil.${teil}`);
  return artikelQuellen(language, t).map(({ id, route, titel, teile }) => ({
    id: `artikel:${id}`,
    kind: "artikel" as const,
    titleKey: "",
    bodyKey: "",
    route,
    title: titel,
    body: BIBLIOTHEK_TEILE.map((teil) => `${ueberschrift(teil)} ${teile[teil]}`).join(" "),
  }));
}

/**
 * R-0943 · Ein Auszug je Artikelteil für die KI-Grundlage: Titel „Artikel · Teil“, Text genau der
 * eine Teil. So kommt der Satz, der die Frage trifft, ungekürzt an der Modellkante an.
 */
export function bibliothekAuszuege(
  language: string,
  t: (key: string) => string,
): ResolvedKlaraEntry[] {
  const auszuege: ResolvedKlaraEntry[] = [];
  for (const { id, route, titel, teile } of artikelQuellen(language, t)) {
    for (const teil of BIBLIOTHEK_TEILE) {
      auszuege.push({
        id: `artikel:${id}:${teil}`,
        kind: "artikel",
        titleKey: "",
        bodyKey: "",
        route,
        title: `${titel} · ${t(`hilfebibliothek.teil.${teil}`)}`,
        body: teile[teil],
      });
    }
  }
  return auszuege;
}
