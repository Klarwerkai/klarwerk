// ================================================================================================
// WISSENSGRAPH · DIE TEXTE DES AUFTRAGS „THEMENKARTE UND BEGRÜNDETE NACHBARSCHAFT".
// ================================================================================================
//
// WARUM EIN MODUL: Seit der I18N-AUFTEILUNG von `main` stehen die Grundwörterbücher unveränderlich
// in `woerterbuch/{de,en,nl}.ts` (`tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts`, W1),
// und neue Texte kommen in ein Textmodul. Die Texte dieses Auftrags standen bis zur Integration
// (Nacharbeit 7) im alten `i18n.ts`; sie sind hierher gezogen, mit WÖRTLICH denselben Werten. Weil
// es NEUE Schlüssel dieses Auftrags sind und keine Altnamen, tragen sie das Präfix des Moduls:
// aus `graph.liste.*`, `graph.detail.*`, `graph.qb.*`, `graph.sicht.*` und
// `wissensnetz.schreibweisen.hinweis` wurde `wissensgraph.*`.
//
// Wer sie liest: `pages/Wissensnetz.tsx` (gleich aussehende Schlagwörter, Kriterium 2) und
// `pages/Stufe2.tsx` (Volltitelliste N-0011/N-0024, Verwalterseite und Qualitätsblick R-0744,
// kuratierte Sicht R-1983, Konfliktzustand im Detailfenster).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "wissensgraph.",
  legacySchluessel: [],
  de: {
    // Gleich aussehende, verschieden gespeicherte Schlagworte (`themenAnzeige` in `Wissensnetz.tsx`).
    "wissensgraph.schreibweisen.hinweis":
      "Einige Themen sehen gleich aus, sind aber verschieden gespeicherte Schlagwörter und führen auf verschiedene Einträge. {{marke}} zeigt ein gespeichertes Leerzeichen; eine Nummer unterscheidet sonst gleich aussehende Schreibweisen.",
    // N-0011 / N-0024: die filterbare Volltitelliste unter dem Graphen (`GraphObjektliste`).
    "wissensgraph.liste.titel": "Objekte im Graphen",
    "wissensgraph.liste.filter": "Titel filtern",
    "wissensgraph.liste.anzahl_one": "{{count}} von {{gesamt}} Objekten im Graphen",
    "wissensgraph.liste.anzahl_other": "{{count}} von {{gesamt}} Objekten im Graphen",
    "wissensgraph.liste.keinTreffer": "Kein Objekt im Graphen trägt diesen Titelteil.",
    // R-0744: Filterleiste, Detailfenster und Qualitätsblick der Verwalterseite am Graphen.
    "wissensgraph.liste.status": "Status",
    "wissensgraph.liste.statusAlle": "alle",
    "wissensgraph.liste.statusNichtValidiert": "nicht freigegeben",
    "wissensgraph.detail.schalter": "Details",
    "wissensgraph.detail.oeffnen": "Details anzeigen: {{title}}",
    "wissensgraph.detail.titel": "Details zu {{title}}",
    "wissensgraph.detail.status": "Status: {{status}}",
    "wissensgraph.detail.konflikte_one": "{{count}} nicht gelöster Konflikt",
    "wissensgraph.detail.konflikte_other": "{{count}} nicht gelöste Konflikte",
    "wissensgraph.detail.verbindungen_one": "{{count}} Verbindung im Graphen",
    "wissensgraph.detail.verbindungen_other": "{{count}} Verbindungen im Graphen",
    "wissensgraph.detail.verbindung": "{{title}} — {{grund}}",
    "wissensgraph.detail.grundSchlagwort": "gemeinsames Schlagwort „{{via}}“",
    "wissensgraph.detail.schliessen": "Details schließen",
    "wissensgraph.qb.an": "Qualitätsblick anzeigen",
    "wissensgraph.qb.aus": "Qualitätsblick ausblenden",
    "wissensgraph.qb.konflikte": "Objekte mit nicht gelöstem Konflikt",
    "wissensgraph.qb.luecken": "Objekte ohne Schlagwort (ohne Thema im Netz)",
    "wissensgraph.qb.veraltet": "Objekte mit anstehender Re-Validierung",
    "wissensgraph.qb.dubletten": "Objekte in offener Überschneidung (Dublette)",
    "wissensgraph.qb.quote": "{{was}}: {{anzahl}} von {{nenner}}",
    "wissensgraph.qb.nichtErhoben": "{{was}}: nicht erhoben",
    "wissensgraph.qb.laedt": "{{was}}: wird erhoben …",
    "wissensgraph.qb.alter_one":
      "Alter des Bestands: jüngster Eintrag im Graphen vom {{datum}}, vor {{count}} Tag",
    "wissensgraph.qb.alter_other":
      "Alter des Bestands: jüngster Eintrag im Graphen vom {{datum}}, vor {{count}} Tagen",
    "wissensgraph.qb.alterUnbekannt": "Alter des Bestands: nicht erhoben",
    // Nacharbeit 5 (F5): Konfliktzahl im Detailfenster nur bei vorliegender Antwort.
    "wissensgraph.detail.konflikteLaedt": "Konflikte: werden erhoben …",
    "wissensgraph.detail.konflikteNichtErhoben": "Konflikte: nicht erhoben",
    // R-1983: die kuratierte Sicht „So arbeitet Klarwerk“.
    "wissensgraph.sicht.an": "So arbeitet Klarwerk anzeigen",
    "wissensgraph.sicht.aus": "So arbeitet Klarwerk ausblenden",
    "wissensgraph.sicht.titel": "So arbeitet Klarwerk — die gesetzten Fachbeziehungen",
    "wissensgraph.sicht.schritt1":
      "Jeder Punkt im Bild ist ein Wissenseintrag, den Sie sehen dürfen.",
    "wissensgraph.sicht.schritt2":
      "Eine graue Linie heißt nur: Zwei Einträge teilen ein Schlagwort. Das ist abgeleitete Nähe, keine Fachaussage.",
    "wissensgraph.sicht.schritt3":
      "Eine gesetzte Fachbeziehung hat ein Mensch verantwortet. Nur diese Beziehungen stehen in der Liste darunter.",
    "wissensgraph.sicht.nichtGeliefert":
      "Der Server hat die gesetzten Fachbeziehungen nicht mitgeliefert; hier steht deshalb keine Aussage über sie.",
    "wissensgraph.sicht.leer":
      "Unter den sichtbaren Einträgen ist keine Fachbeziehung gesetzt. Das ist keine Aussage darüber, ob die Einträge einander widersprechen.",
    "wissensgraph.sicht.verbindung": "— {{art}} ({{richtung}}) —",
    "wissensgraph.sicht.gekuerzt":
      "Gezeigt werden {{geladen}} von {{gesamt}} gesetzten Fachbeziehungen; der Server hat die Menge gekürzt.",
  },
  en: {
    "wissensgraph.schreibweisen.hinweis":
      "Some topics look the same but are differently stored keywords and lead to different entries. {{marke}} marks a stored space; a number distinguishes spellings that otherwise look the same.",
    "wissensgraph.liste.titel": "Objects in the graph",
    "wissensgraph.liste.filter": "Filter titles",
    "wissensgraph.liste.anzahl_one": "{{count}} of {{gesamt}} objects in the graph",
    "wissensgraph.liste.anzahl_other": "{{count}} of {{gesamt}} objects in the graph",
    "wissensgraph.liste.keinTreffer": "No object in the graph has this part in its title.",
    "wissensgraph.liste.status": "Status",
    "wissensgraph.liste.statusAlle": "all",
    "wissensgraph.liste.statusNichtValidiert": "not approved",
    "wissensgraph.detail.schalter": "Details",
    "wissensgraph.detail.oeffnen": "Show details: {{title}}",
    "wissensgraph.detail.titel": "Details for {{title}}",
    "wissensgraph.detail.status": "Status: {{status}}",
    "wissensgraph.detail.konflikte_one": "{{count}} unresolved conflict",
    "wissensgraph.detail.konflikte_other": "{{count}} unresolved conflicts",
    "wissensgraph.detail.verbindungen_one": "{{count}} connection in the graph",
    "wissensgraph.detail.verbindungen_other": "{{count}} connections in the graph",
    "wissensgraph.detail.verbindung": "{{title}} — {{grund}}",
    "wissensgraph.detail.grundSchlagwort": "shared keyword “{{via}}”",
    "wissensgraph.detail.schliessen": "Close details",
    "wissensgraph.qb.an": "Show quality view",
    "wissensgraph.qb.aus": "Hide quality view",
    "wissensgraph.qb.konflikte": "Objects with an unresolved conflict",
    "wissensgraph.qb.luecken": "Objects without a keyword (no topic in the network)",
    "wissensgraph.qb.veraltet": "Objects due for re-validation",
    "wissensgraph.qb.dubletten": "Objects in an open overlap (duplicate)",
    "wissensgraph.qb.quote": "{{was}}: {{anzahl}} of {{nenner}}",
    "wissensgraph.qb.nichtErhoben": "{{was}}: not collected",
    "wissensgraph.qb.laedt": "{{was}}: being collected …",
    "wissensgraph.qb.alter_one":
      "Age of the stock: newest entry in the graph from {{datum}}, {{count}} day ago",
    "wissensgraph.qb.alter_other":
      "Age of the stock: newest entry in the graph from {{datum}}, {{count}} days ago",
    "wissensgraph.qb.alterUnbekannt": "Age of the stock: not collected",
    "wissensgraph.detail.konflikteLaedt": "Conflicts: being collected …",
    "wissensgraph.detail.konflikteNichtErhoben": "Conflicts: not collected",
    "wissensgraph.sicht.an": "Show how Klarwerk works",
    "wissensgraph.sicht.aus": "Hide how Klarwerk works",
    "wissensgraph.sicht.titel": "How Klarwerk works — the curated subject-matter relations",
    "wissensgraph.sicht.schritt1":
      "Every dot in the picture is a knowledge entry you are allowed to see.",
    "wissensgraph.sicht.schritt2":
      "A grey line only means: two entries share a keyword. That is derived proximity, not a statement.",
    "wissensgraph.sicht.schritt3":
      "A curated subject-matter relation was set by a person who is accountable for it. Only these relations appear in the list below.",
    "wissensgraph.sicht.nichtGeliefert":
      "The server did not deliver the curated subject-matter relations, so nothing is said about them here.",
    "wissensgraph.sicht.leer":
      "No subject-matter relation is set among the visible entries. This says nothing about whether the entries contradict each other.",
    "wissensgraph.sicht.verbindung": "— {{art}} ({{richtung}}) —",
    "wissensgraph.sicht.gekuerzt":
      "Showing {{geladen}} of {{gesamt}} curated subject-matter relations; the server shortened the set.",
  },
  nl: {
    "wissensgraph.schreibweisen.hinweis":
      "Sommige thema's zien er hetzelfde uit, maar zijn verschillend opgeslagen trefwoorden en leiden naar verschillende items. {{marke}} toont een opgeslagen spatie; een nummer onderscheidt schrijfwijzen die er verder hetzelfde uitzien.",
    "wissensgraph.liste.titel": "Objecten in de graaf",
    "wissensgraph.liste.filter": "Titels filteren",
    "wissensgraph.liste.anzahl_one": "{{count}} van {{gesamt}} objecten in de graaf",
    "wissensgraph.liste.anzahl_other": "{{count}} van {{gesamt}} objecten in de graaf",
    "wissensgraph.liste.keinTreffer": "Geen object in de graaf heeft dit deel in de titel.",
    "wissensgraph.liste.status": "Status",
    "wissensgraph.liste.statusAlle": "alle",
    "wissensgraph.liste.statusNichtValidiert": "niet vrijgegeven",
    "wissensgraph.detail.schalter": "Details",
    "wissensgraph.detail.oeffnen": "Details tonen: {{title}}",
    "wissensgraph.detail.titel": "Details van {{title}}",
    "wissensgraph.detail.status": "Status: {{status}}",
    "wissensgraph.detail.konflikte_one": "{{count}} onopgelost conflict",
    "wissensgraph.detail.konflikte_other": "{{count}} onopgeloste conflicten",
    "wissensgraph.detail.verbindungen_one": "{{count}} verbinding in de graaf",
    "wissensgraph.detail.verbindungen_other": "{{count}} verbindingen in de graaf",
    "wissensgraph.detail.verbindung": "{{title}} — {{grund}}",
    "wissensgraph.detail.grundSchlagwort": "gedeeld trefwoord „{{via}}”",
    "wissensgraph.detail.schliessen": "Details sluiten",
    "wissensgraph.qb.an": "Kwaliteitsblik tonen",
    "wissensgraph.qb.aus": "Kwaliteitsblik verbergen",
    "wissensgraph.qb.konflikte": "Objecten met een onopgelost conflict",
    "wissensgraph.qb.luecken": "Objecten zonder trefwoord (zonder thema in het netwerk)",
    "wissensgraph.qb.veraltet": "Objecten waarvoor hervalidatie openstaat",
    "wissensgraph.qb.dubletten": "Objecten in een open overlap (duplicaat)",
    "wissensgraph.qb.quote": "{{was}}: {{anzahl}} van {{nenner}}",
    "wissensgraph.qb.nichtErhoben": "{{was}}: niet verzameld",
    "wissensgraph.qb.laedt": "{{was}}: wordt verzameld …",
    "wissensgraph.qb.alter_one":
      "Leeftijd van de verzameling: nieuwste item in de graaf van {{datum}}, {{count}} dag geleden",
    "wissensgraph.qb.alter_other":
      "Leeftijd van de verzameling: nieuwste item in de graaf van {{datum}}, {{count}} dagen geleden",
    "wissensgraph.qb.alterUnbekannt": "Leeftijd van de verzameling: niet verzameld",
    "wissensgraph.detail.konflikteLaedt": "Conflicten: worden verzameld …",
    "wissensgraph.detail.konflikteNichtErhoben": "Conflicten: niet verzameld",
    "wissensgraph.sicht.an": "Zo werkt Klarwerk tonen",
    "wissensgraph.sicht.aus": "Zo werkt Klarwerk verbergen",
    "wissensgraph.sicht.titel": "Zo werkt Klarwerk — de gelegde vakrelaties",
    "wissensgraph.sicht.schritt1": "Elk punt in het beeld is een kennisitem dat u mag zien.",
    "wissensgraph.sicht.schritt2":
      "Een grijze lijn betekent alleen: twee items delen een trefwoord. Dat is afgeleide nabijheid, geen vakuitspraak.",
    "wissensgraph.sicht.schritt3":
      "Een gelegde vakrelatie is door een mens verantwoord. Alleen deze relaties staan in de lijst hieronder.",
    "wissensgraph.sicht.nichtGeliefert":
      "De server heeft de gelegde vakrelaties niet meegeleverd; daarom staat hier geen uitspraak over.",
    "wissensgraph.sicht.leer":
      "Tussen de zichtbare items is geen vakrelatie gelegd. Dat zegt niets over de vraag of de items elkaar tegenspreken.",
    "wissensgraph.sicht.verbindung": "— {{art}} ({{richtung}}) —",
    "wissensgraph.sicht.gekuerzt":
      "Getoond worden {{geladen}} van {{gesamt}} gelegde vakrelaties; de server heeft de set ingekort.",
  },
} satisfies Textmodul;
