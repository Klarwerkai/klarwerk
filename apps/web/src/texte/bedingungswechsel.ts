// ================================================================================================
// R-1628 (aufnahme:20260922:gesamt-was-waere-wenn) · WAS WÄRE, WENN SICH EINE BEDINGUNG ÄNDERT?
// ================================================================================================
//
// Die Texte der Gegenüberstellung auf der Fragen-Seite: „statt bisher jetzt neu" — welche
// Wissensobjekte an die bisherige Bedingung gebunden sind, welche die neue ausschließen, welche
// ungeklärt, für beide belegt oder schon für die neue festgehalten sind, und welche keine von
// beiden nennen. Dazu das Durchspielen mit Klara über den quellengebundenen Frageweg.
// Regel: apps/web/src/lib/bedingungswechsel.ts.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "bedingungswechsel.",
  legacySchluessel: [],
  de: {
    "bedingungswechsel.titel": "Was wäre, wenn sich eine Bedingung ändert?",
    "bedingungswechsel.zu": "einblenden",
    "bedingungswechsel.offen": "ausblenden",
    "bedingungswechsel.feld.bisher": "Statt (bisher)",
    "bedingungswechsel.feld.neu": "jetzt (neu)",
    "bedingungswechsel.feld.thema": "Nur zum Thema (optional)",
    "bedingungswechsel.beispiel": "z. B. statt 5083-H111 jetzt 6082-T6",
    "bedingungswechsel.hinweis":
      "Die Einordnung kommt ohne KI aus: gelesen wird nur, was die Wissensobjekte selbst als Bedingung, im Titel, in der Aussage oder als Schlagwort festhalten — samt Ausschlüssen wie „nicht für …“. Die Fundstelle steht jeweils dabei.",
    "bedingungswechsel.laedt": "Der Bestand wird geladen …",
    "bedingungswechsel.fehler":
      "Der Bestand konnte nicht geladen werden — es gibt nichts zu vergleichen.",
    "bedingungswechsel.unvollstaendig": "Bitte die bisherige und die neue Bedingung angeben.",
    "bedingungswechsel.gleich":
      "Bisherige und neue Bedingung sind gleich — es gibt nichts zu vergleichen.",
    "bedingungswechsel.lage.nur_bisher": "An „{{bisher}}“ gebunden — für „{{neu}}“ nicht belegt",
    "bedingungswechsel.lage.neu_ausgeschlossen":
      "Für „{{neu}}“ ausdrücklich ausgeschlossen — gilt dort laut Objekt nicht",
    "bedingungswechsel.lage.ungeklaert":
      "Genannt, aber nicht eindeutig — die Geltung für „{{neu}}“ bitte an der Fundstelle prüfen",
    "bedingungswechsel.lage.beide": "Für beide ausdrücklich festgehalten — übertragbar belegt",
    "bedingungswechsel.lage.nur_neu": "Schon für „{{neu}}“ festgehalten",
    "bedingungswechsel.lage.keine":
      "Nennt keine der beiden — ob es unter „{{neu}}“ gilt, hält der Bestand nicht fest",
    "bedingungswechsel.leer": "Keine",
    "bedingungswechsel.ohneNennung_one":
      "{{count}} weiteres Wissensobjekt nennt keine der beiden Bedingungen; ob es unter „{{neu}}“ gilt, hält der Bestand nicht fest. Mit einem Thema wird es einzeln gezeigt.",
    "bedingungswechsel.ohneNennung_other":
      "{{count}} weitere Wissensobjekte nennen keine der beiden Bedingungen; ob sie unter „{{neu}}“ gelten, hält der Bestand nicht fest. Mit einem Thema werden sie einzeln gezeigt.",
    "bedingungswechsel.fundort.bedingung": "Bedingung",
    "bedingungswechsel.fundort.titel": "Titel",
    "bedingungswechsel.fundort.aussage": "Aussage",
    "bedingungswechsel.fundort.schlagwort": "Schlagwort",
    "bedingungswechsel.bewertung.ausgeschlossen": "ausgeschlossen",
    "bedingungswechsel.bewertung.vorbehalt": "genannt, Geltung nicht belegt",
    "bedingungswechsel.ki.knopf": "Mit Klara durchspielen",
    "bedingungswechsel.ki.hinweis":
      "Klara beantwortet den Wechsel als Frage — nur aus dem Bestand und mit Quellen. Ohne tragende Quelle gibt es keine Antwort, sondern eine Wissenslücke. Die Einordnung oben bleibt stehen.",
    "bedingungswechsel.ki.frage":
      "Wenn ich statt {{bisher}} jetzt {{neu}} verwende — welche bestehenden Erfahrungswerte gelten dann noch, welche nicht?",
    "bedingungswechsel.ki.frageThema":
      "Thema {{thema}}: Wenn ich statt {{bisher}} jetzt {{neu}} verwende — welche bestehenden Erfahrungswerte gelten dann noch, welche nicht?",
  },
  en: {
    "bedingungswechsel.titel": "What if a condition changes?",
    "bedingungswechsel.zu": "show",
    "bedingungswechsel.offen": "hide",
    "bedingungswechsel.feld.bisher": "Instead of (so far)",
    "bedingungswechsel.feld.neu": "now (new)",
    "bedingungswechsel.feld.thema": "Only on the topic (optional)",
    "bedingungswechsel.beispiel": "e.g. instead of 5083-H111 now 6082-T6",
    "bedingungswechsel.hinweis":
      "The classification works without AI: only what the knowledge objects themselves record as a condition, in the title, in the statement or as a tag is read — including exclusions such as “not for …”. The location is always shown.",
    "bedingungswechsel.laedt": "Loading the knowledge base …",
    "bedingungswechsel.fehler":
      "The knowledge base could not be loaded — there is nothing to compare.",
    "bedingungswechsel.unvollstaendig": "Please enter the current and the new condition.",
    "bedingungswechsel.gleich":
      "The current and the new condition are the same — there is nothing to compare.",
    "bedingungswechsel.lage.nur_bisher": "Tied to “{{bisher}}” — not documented for “{{neu}}”",
    "bedingungswechsel.lage.neu_ausgeschlossen":
      "Explicitly excluded for “{{neu}}” — does not apply there according to the object",
    "bedingungswechsel.lage.ungeklaert":
      "Mentioned, but not unambiguous — please check the location for “{{neu}}”",
    "bedingungswechsel.lage.beide": "Explicitly recorded for both — transferability documented",
    "bedingungswechsel.lage.nur_neu": "Already documented for “{{neu}}”",
    "bedingungswechsel.lage.keine":
      "Names neither — the knowledge base does not record whether it applies under “{{neu}}”",
    "bedingungswechsel.leer": "None",
    "bedingungswechsel.ohneNennung_one":
      "{{count}} more knowledge object names neither condition; the knowledge base does not record whether it applies under “{{neu}}”. With a topic it is listed individually.",
    "bedingungswechsel.ohneNennung_other":
      "{{count}} more knowledge objects name neither condition; the knowledge base does not record whether they apply under “{{neu}}”. With a topic they are listed individually.",
    "bedingungswechsel.fundort.bedingung": "Condition",
    "bedingungswechsel.fundort.titel": "Title",
    "bedingungswechsel.fundort.aussage": "Statement",
    "bedingungswechsel.fundort.schlagwort": "Tag",
    "bedingungswechsel.bewertung.ausgeschlossen": "excluded",
    "bedingungswechsel.bewertung.vorbehalt": "mentioned, validity not documented",
    "bedingungswechsel.ki.knopf": "Work it through with Klara",
    "bedingungswechsel.ki.hinweis":
      "Klara answers the change as a question — only from the knowledge base and with sources. Without a supporting source there is no answer but a knowledge gap. The classification above stays in place.",
    "bedingungswechsel.ki.frage":
      "If I use {{neu}} instead of {{bisher}} — which existing experience still applies, and which does not?",
    "bedingungswechsel.ki.frageThema":
      "Topic {{thema}}: If I use {{neu}} instead of {{bisher}} — which existing experience still applies, and which does not?",
  },
  nl: {
    "bedingungswechsel.titel": "Wat als een voorwaarde verandert?",
    "bedingungswechsel.zu": "tonen",
    "bedingungswechsel.offen": "verbergen",
    "bedingungswechsel.feld.bisher": "In plaats van (tot nu toe)",
    "bedingungswechsel.feld.neu": "nu (nieuw)",
    "bedingungswechsel.feld.thema": "Alleen over het onderwerp (optioneel)",
    "bedingungswechsel.beispiel": "bijv. in plaats van 5083-H111 nu 6082-T6",
    "bedingungswechsel.hinweis":
      "De indeling werkt zonder AI: gelezen wordt alleen wat de kennisobjecten zelf als voorwaarde, in de titel, in de bewering of als trefwoord vastleggen — inclusief uitsluitingen zoals „niet voor …”. De vindplaats staat er steeds bij.",
    "bedingungswechsel.laedt": "De kennisbank wordt geladen …",
    "bedingungswechsel.fehler":
      "De kennisbank kon niet worden geladen — er is niets te vergelijken.",
    "bedingungswechsel.unvollstaendig": "Vul de huidige en de nieuwe voorwaarde in.",
    "bedingungswechsel.gleich":
      "De huidige en de nieuwe voorwaarde zijn gelijk — er is niets te vergelijken.",
    "bedingungswechsel.lage.nur_bisher":
      "Gebonden aan „{{bisher}}” — voor „{{neu}}” niet vastgelegd",
    "bedingungswechsel.lage.neu_ausgeschlossen":
      "Uitdrukkelijk uitgesloten voor „{{neu}}” — geldt daar volgens het object niet",
    "bedingungswechsel.lage.ungeklaert":
      "Genoemd, maar niet eenduidig — controleer de geldigheid voor „{{neu}}” op de vindplaats",
    "bedingungswechsel.lage.beide": "Voor beide uitdrukkelijk vastgelegd — overdraagbaar",
    "bedingungswechsel.lage.nur_neu": "Al vastgelegd voor „{{neu}}”",
    "bedingungswechsel.lage.keine":
      "Noemt geen van beide — of het onder „{{neu}}” geldt, legt de kennisbank niet vast",
    "bedingungswechsel.leer": "Geen",
    "bedingungswechsel.ohneNennung_one":
      "{{count}} ander kennisobject noemt geen van beide voorwaarden; of het onder „{{neu}}” geldt, legt de kennisbank niet vast. Met een onderwerp wordt het afzonderlijk getoond.",
    "bedingungswechsel.ohneNennung_other":
      "{{count}} andere kennisobjecten noemen geen van beide voorwaarden; of ze onder „{{neu}}” gelden, legt de kennisbank niet vast. Met een onderwerp worden ze afzonderlijk getoond.",
    "bedingungswechsel.fundort.bedingung": "Voorwaarde",
    "bedingungswechsel.fundort.titel": "Titel",
    "bedingungswechsel.fundort.aussage": "Bewering",
    "bedingungswechsel.fundort.schlagwort": "Trefwoord",
    "bedingungswechsel.bewertung.ausgeschlossen": "uitgesloten",
    "bedingungswechsel.bewertung.vorbehalt": "genoemd, geldigheid niet vastgelegd",
    "bedingungswechsel.ki.knopf": "Met Klara doorspelen",
    "bedingungswechsel.ki.hinweis":
      "Klara beantwoordt de wissel als vraag — alleen uit de kennisbank en met bronnen. Zonder dragende bron komt er geen antwoord maar een kennislacune. De indeling hierboven blijft staan.",
    "bedingungswechsel.ki.frage":
      "Als ik in plaats van {{bisher}} nu {{neu}} gebruik — welke bestaande ervaringen gelden dan nog, welke niet?",
    "bedingungswechsel.ki.frageThema":
      "Onderwerp {{thema}}: Als ik in plaats van {{bisher}} nu {{neu}} gebruik — welke bestaande ervaringen gelden dan nog, welke niet?",
  },
} satisfies Textmodul;
