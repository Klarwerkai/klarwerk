// ================================================================================================
// AUFNAHME 20260922 · GESAMT-KENNZAHLEN — WISSENSBESTAND UND TATSÄCHLICHE WIRKUNG AUSWERTEN.
// ================================================================================================
//
// Die Texte der Auswertungsseite (`pages/Analytics.tsx`) und der Kapitalsicht (`pages/Stufe2.tsx`),
// die dieser Auftrag neu braucht:
//   · R-0723 — die vier Kernzahlen für Entscheider oben (geprüftes Wissen, gestellte Fragen, ohne
//     Lücke beantwortet, Antwortquote) samt Wochenverlauf der Quote.
//   · FR-VAL-06 / FR-ANA-01 — Prüfaufgaben je Person (offen/erledigt) und Kategorie-Verteilung.
//   · R-0736 / R-0755 — Demodaten und berechnete Indizes werden als solche benannt, nicht als
//     gemessene Werte dieser Installation ausgegeben.
// Die Labels der Kernzahlen selbst (`ana.impactAsk`, `ana.impactAnswered`, `ana.impactRate`) stehen
// unverändert im Grundbestand und werden weiterverwendet.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "kennzahlen.",
  legacySchluessel: [],
  de: {
    "kennzahlen.help.exec":
      "Vier Kernzahlen für Entscheider, alle aus den Live-Daten dieser Installation: geprüftes (validiertes) Wissen, gestellte Fragen, ohne Wissenslücke beantwortete Fragen und die Antwortquote. Ihr Wochenverlauf steht unter „Wirkung“. Die Zeile darunter zeigt offene Prüfungen, Einzelquellen-Risiko und geschlossene Lücken.",
    "kennzahlen.exec.askedHint": "an die Wissensbasis gestellt",
    "kennzahlen.exec.answeredHint": "ohne Wissenslücke beantwortet",
    "kennzahlen.exec.rateHint": "gesamt · zuletzt {{rate}} (Woche ab {{week}})",
    "kennzahlen.exec.rateHintLeer": "gesamt · noch kein Wochenverlauf",
    "kennzahlen.demo.hinweis":
      "{{demo}} von {{total}} gezählten Objekten sind Demodaten. Diese Zahlen enthalten Beispielbestand und sind insoweit keine Messwerte dieser Installation.",
    "kennzahlen.help.wirkung":
      "Der Wochenverlauf zeigt, ob der Nutzen wächst: wie viele Objekte je Woche validiert wurden und welcher Anteil der Fragen je Woche ohne Wissenslücke beantwortet wurde.",
    "kennzahlen.wochen.validiertHinweis":
      "Gezählt nach der Woche, in der das Objekt validiert wurde — nicht nach seiner Erfassung.",
    "kennzahlen.wochen.ohnePruefzeitpunkt":
      "{{n}} validierte Objekte ohne belegten Prüfzeitpunkt (vor der Erfassung des Zeitpunkts geprüft) — in keiner Woche gezählt.",
    "kennzahlen.wochen.quote": "Antwortquote je Woche",
    "kennzahlen.wochen.quoteZeile": "{{rate}} · {{answered}} von {{asked}}",
    "kennzahlen.wochen.keineFragen": "Noch kein Wochenverlauf der Antwortquote vorhanden.",
    "kennzahlen.byCategory": "Verteilung nach Kategorie",
    "kennzahlen.personen.titel": "Prüfaufgaben je Person",
    "kennzahlen.personen.zeile": "{{open}} offen · {{done}} erledigt",
    "kennzahlen.personen.leer": "Noch keine Prüfaufgaben zugewiesen.",
    "kennzahlen.personen.laedt": "Prüfaufgaben werden geladen …",
    "kennzahlen.personen.nichtAbrufbar": "Die Prüfaufgaben sind gerade nicht abrufbar.",
    "kennzahlen.kapital.index":
      "Berechneter Index aus den Anteilen und Gewichten darunter — eine Schätzung, kein Messwert.",
  },
  en: {
    "kennzahlen.help.exec":
      "Four core figures for decision-makers, all taken from this installation's live data: checked (validated) knowledge, questions asked, questions answered without a knowledge gap, and the answer rate. Their weekly course is shown under “Impact”. The row below shows open reviews, single-source risk and closed gaps.",
    "kennzahlen.exec.askedHint": "put to the knowledge base",
    "kennzahlen.exec.answeredHint": "answered without a knowledge gap",
    "kennzahlen.exec.rateHint": "overall · latest {{rate}} (week of {{week}})",
    "kennzahlen.exec.rateHintLeer": "overall · no weekly course yet",
    "kennzahlen.demo.hinweis":
      "{{demo}} of {{total}} counted objects are demo data. These figures include sample holdings and to that extent are not measurements of this installation.",
    "kennzahlen.help.wirkung":
      "The weekly course shows whether the benefit grows: how many objects were validated per week, and what share of questions per week was answered without a knowledge gap.",
    "kennzahlen.wochen.validiertHinweis":
      "Counted by the week in which the object was validated — not by when it was captured.",
    "kennzahlen.wochen.ohnePruefzeitpunkt":
      "{{n}} validated objects without a recorded review date (reviewed before the date was captured) — not counted in any week.",
    "kennzahlen.wochen.quote": "Answer rate per week",
    "kennzahlen.wochen.quoteZeile": "{{rate}} · {{answered}} of {{asked}}",
    "kennzahlen.wochen.keineFragen": "No weekly course of the answer rate yet.",
    "kennzahlen.byCategory": "Distribution by category",
    "kennzahlen.personen.titel": "Review tasks per person",
    "kennzahlen.personen.zeile": "{{open}} open · {{done}} done",
    "kennzahlen.personen.leer": "No review tasks assigned yet.",
    "kennzahlen.personen.laedt": "Loading review tasks …",
    "kennzahlen.personen.nichtAbrufbar": "The review tasks cannot be retrieved right now.",
    "kennzahlen.kapital.index":
      "Calculated index from the shares and weights below — an estimate, not a measurement.",
  },
  nl: {
    "kennzahlen.help.exec":
      "Vier kerncijfers voor beslissers, allemaal uit de live gegevens van deze installatie: gecontroleerde (gevalideerde) kennis, gestelde vragen, vragen beantwoord zonder kennislacune en het antwoordpercentage. Het verloop per week staat onder „Impact”. De rij daaronder toont openstaande controles, enkelebronrisico en gesloten lacunes.",
    "kennzahlen.exec.askedHint": "aan de kennisbank gesteld",
    "kennzahlen.exec.answeredHint": "beantwoord zonder kennislacune",
    "kennzahlen.exec.rateHint": "totaal · laatst {{rate}} (week van {{week}})",
    "kennzahlen.exec.rateHintLeer": "totaal · nog geen verloop per week",
    "kennzahlen.demo.hinweis":
      "{{demo}} van {{total}} getelde objecten zijn demogegevens. Deze cijfers bevatten voorbeeldbestand en zijn in zoverre geen metingen van deze installatie.",
    "kennzahlen.help.wirkung":
      "Het verloop per week laat zien of het nut groeit: hoeveel objecten per week zijn gevalideerd en welk deel van de vragen per week zonder kennislacune is beantwoord.",
    "kennzahlen.wochen.validiertHinweis":
      "Geteld naar de week waarin het object is gevalideerd — niet naar het moment van vastleggen.",
    "kennzahlen.wochen.ohnePruefzeitpunkt":
      "{{n}} gevalideerde objecten zonder vastgelegd controlemoment (gecontroleerd voordat het moment werd vastgelegd) — in geen enkele week geteld.",
    "kennzahlen.wochen.quote": "Antwoordpercentage per week",
    "kennzahlen.wochen.quoteZeile": "{{rate}} · {{answered}} van {{asked}}",
    "kennzahlen.wochen.keineFragen": "Nog geen verloop per week van het antwoordpercentage.",
    "kennzahlen.byCategory": "Verdeling per categorie",
    "kennzahlen.personen.titel": "Controletaken per persoon",
    "kennzahlen.personen.zeile": "{{open}} open · {{done}} afgerond",
    "kennzahlen.personen.leer": "Nog geen controletaken toegewezen.",
    "kennzahlen.personen.laedt": "Controletaken worden geladen …",
    "kennzahlen.personen.nichtAbrufbar": "De controletaken zijn op dit moment niet op te halen.",
    "kennzahlen.kapital.index":
      "Berekende index uit de aandelen en gewichten hieronder — een schatting, geen meting.",
  },
} satisfies Textmodul;
