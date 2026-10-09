import {
  BIBLIOTHEK_TEILE,
  type BibliothekSprache,
  type BibliothekTeil,
  FUNKTIONS_ARTIKEL,
  funktionsArtikel,
  hilfeArtikel,
} from "../../apps/web/src/lib/hilfeBibliothek";

// R-1349 (Aufnahme gesamt-aufruferwaechter, Nacharbeit 7): `GLIEDERUNG` und `artikelText` standen
// bis hierher als Exporte in `apps/web/src/lib/hilfeBibliothek.ts`. Kein Produktweg rief sie; die
// Zuordnung ist die Prüferwartung des Bauplan-Wächters (`artikelText` trug selbst den Vermerk „für
// Prüfungen“). Sie stehen deshalb hier, Wort für Wort unverändert. Die Artikel, gegen die sie
// prüfen, liegen weiter im Produkt und werden von dort gelesen.

type Text = Readonly<Record<BibliothekSprache, string>>;

// ================================================================================================
// GLIEDERUNG — jeder Punkt der Quellengliederung (Lieferung 1, Abschnitt B) mit seinem Artikel.
// ================================================================================================
//
// `artikel` ist die Kennung eines Bereichsartikels (`HILFE_BIBLIOTHEK`) oder eines
// Funktionsartikels (`FUNKTIONS_ARTIKEL`). `stichwort` muss je Sprache im zugeordneten Artikel
// stehen — so ist geprüft, dass der Artikel diese Funktion WIRKLICH behandelt und nicht nur
// zugeordnet ist. Ohne Artikel steht der Grund da — und seit Nacharbeit 7 (Ben: „Die
// Vollständigkeitsprüfung darf diese Lücke nicht allein aufgrund eines Begründungstexts
// akzeptieren") eine ART der Auslassung, die die Prüfung am Bestand nachmisst.
export type GliederungsPunkt =
  | { readonly id: string; readonly artikel: string; readonly stichwort: Text }
  | {
      readonly id: string;
      readonly artikel: null;
      readonly auslassung: Auslassung;
      readonly grund: string;
    };

/**
 * Warum ein Punkt keinen Artikel hat, nachprüfbar (`tests/hilfe-bibliothek/bibliothek-bauplan`, G2):
 *   · `ohne-recht`    — die Funktion gibt es für diese Rolle nicht (Rollenvertrag
 *                       `services/rbac/src/policy.ts`: die Rolle hat das Recht nicht);
 *   · `jeder-artikel` — der Inhalt ist ein fester Teil JEDES Artikels;
 *   · `keine-flaeche` — die Fläche gibt es nicht (keine Route trägt eines dieser Wörter).
 */
export type Auslassung =
  | { readonly art: "ohne-recht"; readonly rolle: string; readonly recht: string }
  | { readonly art: "jeder-artikel"; readonly teil: BibliothekTeil }
  | { readonly art: "keine-flaeche"; readonly routenwoerter: readonly string[] };

/** Ein Gliederungspunkt mit Artikel; das Stichwort muss je Sprache im Artikel stehen. */
function punkt(id: string, artikel: string, de: string, en: string, nl: string): GliederungsPunkt {
  return { id, artikel, stichwort: { de, en, nl } };
}

/** Ein Gliederungspunkt ohne Artikel — mit nachprüfbarer Auslassung und Grund. */
function ohneArtikel(id: string, auslassung: Auslassung, grund: string): GliederungsPunkt {
  return { id, artikel: null, auslassung, grund };
}

export const GLIEDERUNG: readonly GliederungsPunkt[] = [
  punkt(
    "B0-1",
    "grundprinzip",
    "Erfahrungswissen",
    "experience-based knowledge",
    "ervaringskennis",
  ),
  punkt(
    "B0-2",
    "grundprinzip",
    "Vertrauen ist Evidenz",
    "confidence is evidence",
    "vertrouwen is bewijs",
  ),
  punkt("B0-3", "kreislauf", "Wissenskreislauf", "knowledge cycle", "kenniscyclus"),
  punkt(
    "B0-4",
    "grundprinzip",
    "nicht einfach auf alles",
    "not simply answer everything",
    "niet zomaar op alles",
  ),
  punkt("B0-5", "wissensobjekt", "kleinste Einheit", "smallest unit", "kleinste eenheid"),
  punkt("B0-6", "rollen-konten", "Rollen legen fest", "Roles define", "Rollen bepalen"),
  punkt("B0-7", "ki-datenschutz", "Cloud-Dienst", "cloud service", "clouddienst"),
  punkt("B0-8", "kreislauf", "erste halbe Stunde", "first half hour", "eerste halfuur"),
  punkt("B1-1", "capture", "diktierst", "dictate", "dicteert"),
  punkt("B1-2", "schreiben", "unsortiert", "unsorted", "ongeordend"),
  punkt("B1-3", "diktieren", "Diktieren heißt", "Dictating means", "Dicteren betekent"),
  punkt("B1-4", "interview", "Wissens-Interview", "knowledge interview", "kennisinterview"),
  punkt("B1-5", "fileimport", "Datei importieren", "Import file", "Bestand importeren"),
  punkt(
    "B1-6",
    "fileimport",
    "In Punkte analysieren",
    "Analyze into points",
    "In punten analyseren",
  ),
  punkt(
    "B1-7",
    "schreiben",
    "Struktur vorschlagen",
    "Suggesting a structure",
    "structuur laten voorstellen",
  ),
  punkt("B1-8", "wissensarten", "Negativwissen", "Negative knowledge", "Negatieve kennis"),
  punkt("B1-9", "quellen", "wörtlichen Auszug", "literal excerpt", "letterlijk fragment"),
  punkt("B1-10", "schreiben", "Formulieren", "wording", "formuleren"),
  punkt("B1-11", "entwurf-einreichen", "Mit dem Einreichen", "Submitting turns", "Met indienen"),
  punkt("B1-12", "entwurf-einreichen", "Entwurf speichern", "Saving a draft", "concept bewaren"),
  punkt("B2-1", "validation", "validiert", "validated", "gevalideerd"),
  punkt(
    "B2-2",
    "validation",
    "Validierung ist der Ort",
    "Validation is where",
    "Validatie is de plek",
  ),
  punkt(
    "B2-3",
    "validation",
    "„Freigeben“, „Rückfrage“ oder „Ablehnen“",
    "approve, query or reject",
    "vrijgeven, vraag stellen of afwijzen",
  ),
  punkt("B2-4", "pruefen-organisieren", "eine bis fünf", "one to five", "één tot vijf"),
  punkt("B2-5", "validation", "nicht überstimmt", "not outvoted", "niet overstemd"),
  punkt(
    "B2-6",
    "validation",
    "Den eigenen Beitrag kann ich selbst freigeben",
    "I can approve my own contribution",
    "Mijn eigen bijdrage kan ik zelf vrijgeven",
  ),
  punkt(
    "B2-7",
    "pruefen-organisieren",
    "Prüfer zuweisen",
    "Assigning a reviewer",
    "toewijzen van een controleur",
  ),
  punkt("B2-8", "nacharbeit", "Nacharbeit", "rework", "nawerk"),
  ohneArtikel(
    "B2-9",
    { art: "ohne-recht", rolle: "experte", recht: "ko.validate" },
    "Prüfen als Experte (wirksame Rolle): Bau-Status schon in der Quelle offen (P-3); laut Rollenvertrag (`services/rbac/src/policy.ts`) hat die Rolle Experte kein Prüfrecht — die Funktion besteht so nicht.",
  ),
  punkt(
    "B3-1",
    "vertrauen-status",
    "Vertrauenswert entsteht",
    "confidence value comes from",
    "vertrouwenswaarde ontstaat",
  ),
  punkt("B3-2", "vertrauen-status", "Stand", "status", "status"),
  punkt("B3-3", "vertrauen-status", "Reife", "maturity", "rijpheid"),
  punkt(
    "B3-4",
    "vertraulichkeit-export",
    "streng vertraulich",
    "strictly confidential",
    "strikt vertrouwelijk",
  ),
  punkt(
    "B3-5",
    "vertrauen-status",
    "offener Widerspruch",
    "open contradiction",
    "open tegenspraak",
  ),
  punkt(
    "B4-1",
    "library",
    "gesamte Wissensbestand",
    "whole body of knowledge",
    "volledige kennisvoorraad",
  ),
  punkt("B4-2", "library", "Filter", "filters", "filters"),
  punkt(
    "B4-3",
    "wissensobjekt",
    "Bedingungen, Maßnahmen",
    "conditions, measures",
    "voorwaarden, maatregelen",
  ),
  punkt("B4-4", "wissensobjekt", "Herkunft", "origin", "herkomst"),
  punkt("B4-5", "wissensobjekt", "neue Version", "new version", "nieuwe versie"),
  punkt("B4-6", "vertraulichkeit-export", "Export", "export", "export"),
  punkt("B5-1", "ask", "Frage", "question", "vraag"),
  punkt("B5-2", "ask", "worauf sie steht", "what it rests on", "waarop het steunt"),
  punkt("B5-3", "wissensluecke", "ehrliche Auskunft", "honest statement", "eerlijke mededeling"),
  punkt("B5-4", "wissensluecke", "schließt sie selbst", "close it yourself", "sluit je het zelf"),
  punkt("B5-5", "extern", "außerhalb von Klarwerk", "outside Klarwerk", "buiten Klarwerk"),
  // Nacharbeit 7 (Ben): die Funktion besteht (`pages/Ask.tsx`, Kopieren · Als Markdown · Drucken).
  punkt("B5-6", "antwort-weitergeben", "Kopieren", "Copy", "Kopiëren"),
  punkt("B6-1", "konflikte", "Widerspruch", "contradiction", "tegenspraak"),
  punkt("B6-2", "konflikt-wege", "Zweitmeinung", "second opinion", "tweede mening"),
  punkt(
    "B6-3",
    "duplikate",
    "dasselbe sagen",
    "say largely the same thing",
    "grotendeels hetzelfde zeggen",
  ),
  punkt("B6-4", "risk", "einem einzigen Menschen", "single person", "één persoon"),
  punkt("B6-5", "lifecycle", "erneuten Prüfung", "renewed checking", "hernieuwde controle"),
  punkt("B6-6", "protokoll", "Hash-Kette", "hash chain", "hashketen"),
  punkt("B6-7", "loeschen", "Papierkorb", "recycle bin", "prullenbak"),
  punkt(
    "B7-1",
    "ki-datenschutz",
    "Externe Verarbeitung",
    "External processing",
    "Externe verwerking",
  ),
  punkt("B7-2", "ki-datenschutz", "Info-Zeichen", "info sign", "info-teken"),
  punkt("B7-3", "ki-datenschutz", "regelbasiert", "rule-based", "regelgebaseerd"),
  punkt(
    "B7-4",
    "ki-datenschutz",
    "Betreibersache",
    "operator’s responsibility",
    "zaak van de beheerder",
  ),
  punkt(
    "B7-5",
    "vertraulichkeit-export",
    "vertrauliche Einträge",
    "confidential entries",
    "vertrouwelijke vermeldingen",
  ),
  punkt(
    "B8-1",
    "verwaltung-einstellungen",
    "welche KI für welche Aufgabe",
    "which AI works for which task",
    "welke AI voor welke taak",
  ),
  punkt(
    "B8-2",
    "rollen-konten",
    "ein Konto erstellen",
    "create an account",
    "een account aanmaken",
  ),
  punkt(
    "B8-3",
    "verwaltung-einstellungen",
    "Grenzen für Uploads",
    "upload limits",
    "grenzen voor uploads",
  ),
  punkt("B8-4", "firststart", "Erststart", "First start", "eerste start"),
  punkt(
    "B8-5",
    "verwaltung-einstellungen",
    "Bereitschafts-Übersicht",
    "readiness overview",
    "gereedheidsoverzicht",
  ),
  punkt(
    "B8-6",
    "firststart",
    "Demodaten entfernen",
    "Remove demo data",
    "Demogegevens verwijderen",
  ),
  punkt("B9-1", "mobile", "mobile Ansicht", "mobile view", "mobiele weergave"),
  punkt("B9-2", "mobile", "Ohne Verbindung", "Without a connection", "Zonder verbinding"),
  ohneArtikel(
    "B10-1",
    { art: "keine-flaeche", routenwoerter: ["glossar", "glossary", "woordenlijst"] },
    "Glossar der Klarwerk-Begriffe (A–Z, ein Name je Sache): eine solche Fläche gibt es nicht. Das Firmenwörterbuch unter `/begriffe` ist etwas anderes — der Katalog der firmeneigenen Fachbegriffe, kein Glossar der Anwendung. Klarwerk-Begriffe erklären die Artikel selbst und Klara (Begriff eintippen oder markieren).",
  ),
  punkt("B10-2", "grundprinzip", "erfundene Antwort", "invented answer", "verzonnen antwoord"),
  ohneArtikel(
    "B10-3",
    { art: "jeder-artikel", teil: "missverstaendnisse" },
    "Sammlung der häufigsten Missverständnisse: kein eigener Artikel, sondern der feste fünfte Teil „Typische Missverständnisse“ JEDES Artikels.",
  ),
  ohneArtikel(
    "B10-4",
    { art: "keine-flaeche", routenwoerter: ["schnellweg", "quick", "snelweg"] },
    "Aufgaben-Schnellwege (Ziel → kürzester Klickweg): eine solche Sammlung gibt es nicht. Die Schnellwahl (⌘K/Strg+K) springt zu Seiten und Wissenseinträgen, nennt aber keine Klickwege; den ersten Arbeitsweg führt die Einstiegsführung auf der Hilfeseite, und jeder Artikel nennt seinen Bereich.",
  ),
];

/** Der Text eines Artikels (Bereichs- oder Funktionsartikel) in einer Sprache — für Prüfungen. */
export function artikelText(id: string, lng: string): string | null {
  const bereich = hilfeArtikel(id, lng);
  if (bereich) {
    return BIBLIOTHEK_TEILE.map((teil) => bereich[teil]).join(" ");
  }
  const funktion = FUNKTIONS_ARTIKEL.find((artikel) => artikel.id === id);
  if (!funktion) {
    return null;
  }
  const { titel, teile } = funktionsArtikel(funktion, lng);
  return [titel, ...BIBLIOTHEK_TEILE.map((teil) => teile[teil])].join(" ");
}
