// ================================================================================================
// produkt:20261013:lagebild-reale-werte-eingabe — BEISPIELWERTE KENNZEICHNEN, REALE WERTE ERFASSEN.
// ================================================================================================
//
// Texte der Karte `components/LagebildWerte.tsx` (Kapital-Sicht und Spaceseite) und der Kennzeichnung
// der Beispielrechnung in `pages/Stufe2.tsx`. Die Sätze behaupten nichts, was die Zahl nicht trägt:
// eine eigene Eingabe ist eine Annahme, ein „gemessener" Wert die Angabe einer Person — beides ist
// kein unabhängiger Wirkungsnachweis und kein Unternehmenskapital.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "lagebildwerte.",
  legacySchluessel: [],
  de: {
    "lagebildwerte.titel": "Reale Werte für die Wissensbewertung",
    "lagebildwerte.einleitung":
      "Hier tragen Anwender und Verwaltung die echten Eingangswerte der Wissensbewertung ein. Sie werden gespeichert und gelten nur für den gewählten Arbeitsbereich. Eine eigene Eingabe ist eine Annahme — kein gemessener Wert und kein unabhängiger Wirkungsnachweis.",
    "lagebildwerte.bereich.label": "Arbeitsbereich",
    "lagebildwerte.bereich.gesamt": "Ganzes Unternehmen",
    "lagebildwerte.laedt": "Werte werden geladen …",
    "lagebildwerte.fehler.laden":
      "Die gespeicherten Werte konnten nicht geladen werden. Deshalb steht hier kein Wert.",
    "lagebildwerte.nichtSichtbar": "Für diesen Arbeitsbereich können Sie keine Werte sehen.",
    "lagebildwerte.leer": "Für diesen Bereich sind noch keine realen Werte erfasst.",
    "lagebildwerte.spalte.feld": "Wert",
    "lagebildwerte.spalte.angabe": "Angabe",
    "lagebildwerte.spalte.herkunft": "Herkunft",
    "lagebildwerte.feld.hourlyRate": "Stundensatz",
    "lagebildwerte.feld.hoursSavedPerValidatedKo": "Gesparte Zeit je validiertem Objekt",
    "lagebildwerte.feld.reuseFactor": "Wiederverwendung",
    "lagebildwerte.einheit.hourlyRate": "€ pro Stunde",
    "lagebildwerte.einheit.hoursSavedPerValidatedKo": "Stunden je Objekt",
    "lagebildwerte.einheit.reuseFactor": "Faktor (so oft genutzt)",
    "lagebildwerte.hilfe.hourlyRate": "Interne Kostenrate einer Arbeitsstunde.",
    "lagebildwerte.hilfe.hoursSavedPerValidatedKo":
      "Einarbeitungs- oder Suchzeit, die ein validiertes Objekt erspart. Negativ, wenn es Zusatzaufwand verursacht.",
    "lagebildwerte.hilfe.reuseFactor": "Wie oft ein Objekt im Schnitt wiederverwendet wird.",
    "lagebildwerte.beispielwert": "Beispielwert (geschätzt): {{wert}}",
    "lagebildwerte.nichtErfasst": "nicht erfasst",
    "lagebildwerte.herkunft.eigene_eingabe": "Eigene Eingabe (Annahme)",
    "lagebildwerte.herkunft.gemessen": "Gemessen (laut Angabe, nicht unabhängig geprüft)",
    "lagebildwerte.beleg": "Beleg: {{beleg}}",
    // MACOS-20261014 · UI-03 (Nacharbeit 47): der Prüfstatus jeder Zahl — eine fachliche Prüfung der
    // Lagebild-Werte gibt es nicht; das steht offen da statt eines stillschweigenden „gilt“.
    "lagebildwerte.pruefstatus.nichtGeprueft": "Prüfstatus: offen – nicht fachlich geprüft",
    // MACOS-20261014 · MAC-03/UI-03 (Nacharbeit 54 · MAC5-05): Details zur Zahl auf Abruf.
    "lagebildwerte.details.knopf": "Details",
    "lagebildwerte.details.label": "Details zu {{feld}}",
    "lagebildwerte.details.keinBeleg": "Kein Beleg angegeben.",
    "lagebildwerte.standKurz": "Stand {{version}}",
    "lagebildwerte.rechenweg.knopf": "Rechenweg",
    "lagebildwerte.rechenweg.label": "Rechenweg und Grundlage",
    "lagebildwerte.pruefstatus.ergebnis":
      "Prüfstatus: offen – das Ergebnis beruht auf nicht fachlich geprüften Werten.",
    "lagebildwerte.zeitraum": "Gilt für {{von}} bis {{bis}}",
    "lagebildwerte.stand": "Stand {{version}} vom {{zeit}}, geändert {{wer}}",
    "lagebildwerte.wer.selbst": "von Ihnen",
    "lagebildwerte.wer.andere": "von einer anderen berechtigten Person",
    "lagebildwerte.ergebnis.titel": "Rechnung mit diesen Werten",
    "lagebildwerte.art.eigene_annahme":
      "Rechnung aus eigenen Annahmen — kein gemessener Wert, kein unabhängiger Wirkungsnachweis und kein Unternehmenskapital.",
    "lagebildwerte.art.angegebene_messung":
      "Rechnung aus angegebenen Messwerten mit Beleg — die Messung ist nicht unabhängig geprüft; kein Unternehmenskapital.",
    "lagebildwerte.negativ": "Der Zusatzaufwand überwiegt: negative Entlastung.",
    "lagebildwerte.basis":
      "Grundlage heute: {{n}} validierte von {{total}} für Sie sichtbaren Objekten in diesem Bereich · Ø Vertrauen {{trust}}",
    "lagebildwerte.demo": "Davon {{demo}} Demo-Objekte — die Grundlage enthält Beispielbestand.",
    "lagebildwerte.nichtBerechenbar": "Kein Geldwert berechenbar:",
    "lagebildwerte.grund.keine_werte": "Es sind noch keine realen Werte erfasst.",
    "lagebildwerte.grund.fehlt_hourlyRate": "Der Stundensatz fehlt.",
    "lagebildwerte.grund.fehlt_hoursSavedPerValidatedKo":
      "Die gesparte Zeit je validiertem Objekt fehlt.",
    "lagebildwerte.grund.fehlt_reuseFactor": "Die Wiederverwendung fehlt.",
    "lagebildwerte.grund.keine_validierten_objekte":
      "In diesem Bereich gibt es für Sie keine validierten Objekte — ohne Grundlage keine Rechnung.",
    "lagebildwerte.bearbeiten": "Werte eingeben oder korrigieren",
    "lagebildwerte.nurLesen.gesamt": "Die Werte für das ganze Unternehmen pflegt die Verwaltung.",
    "lagebildwerte.nurLesen.space":
      "Werte eingeben dürfen Personen mit Schreibrecht in diesem Arbeitsbereich.",
    "lagebildwerte.form.titel": "Werte eingeben",
    "lagebildwerte.form.zeitraumVon": "Gilt ab",
    "lagebildwerte.form.zeitraumBis": "Gilt bis",
    "lagebildwerte.form.zeitraumHilfe":
      "Zeitraum, für den die Werte gelten bzw. in dem gemessen wurde.",
    "lagebildwerte.form.herkunft": "Herkunft",
    "lagebildwerte.form.beleg": "Beleg (Pflicht bei „gemessen“)",
    "lagebildwerte.form.belegHilfe":
      "Wo die Messung steht, etwa Auswertung oder Dokument. Bitte keine Angaben über Personen.",
    "lagebildwerte.form.leerHinweis":
      "Leer lassen, wenn ein Wert nicht bekannt ist — dann wird kein Geldwert berechnet.",
    "lagebildwerte.form.speichern": "Speichern",
    "lagebildwerte.form.speichert": "Speichert …",
    "lagebildwerte.form.abbrechen": "Abbrechen",
    "lagebildwerte.form.keineZahl": "{{feld}}: bitte eine Zahl eingeben.",
    "lagebildwerte.form.gespeichert": "Gespeichert — Stand {{version}}.",
    "lagebildwerte.form.wiederholt":
      "Dieser Speichervorgang war bereits gespeichert (Stand {{version}}) — nichts wurde doppelt angelegt.",
    "lagebildwerte.form.unbekannt":
      "Ob gespeichert wurde, ist unbekannt (Verbindung oder Server). Ihre Eingabe ist erhalten. „Erneut senden“ wiederholt denselben Speichervorgang — er wird nicht doppelt angelegt.",
    "lagebildwerte.form.erneut": "Erneut senden",
    "lagebildwerte.form.laeuft":
      "Wird gespeichert — die Eingaben sind bis zur Antwort gesperrt, damit nichts überschrieben wird.",
    "lagebildwerte.form.abbruchUnbekannt":
      "Ob der letzte Speichervorgang gespeichert wurde, ist unbekannt. Oben steht der neu gelesene Stand — bitte prüfen, bevor Sie erneut eingeben.",
    "lagebildwerte.form.konflikt":
      "Inzwischen wurden die Werte geändert (Stand {{version}} vom {{zeit}}, {{wer}}). Ihre Eingabe wurde nicht gespeichert und steht unverändert im Formular.",
    "lagebildwerte.form.konfliktOhneStand":
      "Der gespeicherte Stand hat sich geändert. Ihre Eingabe wurde nicht gespeichert und steht unverändert im Formular.",
    "lagebildwerte.form.aktuell": "Aktuell gespeichert:",
    "lagebildwerte.form.uebernehmen": "Aktuellen Stand übernehmen (meine Eingabe verwerfen)",
    "lagebildwerte.form.ueberschreiben": "Meine Eingabe über den aktuellen Stand speichern",
    "lagebildwerte.form.fehler": "Nicht gespeichert:",
    "lagebildwerte.form.verboten": "Nicht gespeichert: {{grund}}",
    "lagebildwerte.beispiel.titel": "Beispiel (geschätzt)",
    "lagebildwerte.beispiel.kennzeichnung":
      "Beispielrechnung für den PoC: die Werte darunter sind geschätzte Beispielwerte zum Ausprobieren. Sie werden nicht gespeichert und sind kein reales Unternehmenskapital. Reale Werte stehen getrennt darunter.",
    "lagebildwerte.space.knopf": "Lagebild-Werte dieses Arbeitsbereichs",
  },
  en: {
    "lagebildwerte.titel": "Real values for the knowledge valuation",
    "lagebildwerte.einleitung":
      "Users and administrators enter the real input values of the knowledge valuation here. They are saved and apply only to the selected work area. Your own entry is an assumption — not a measured value and not independent proof of impact.",
    "lagebildwerte.bereich.label": "Work area",
    "lagebildwerte.bereich.gesamt": "Whole company",
    "lagebildwerte.laedt": "Loading values …",
    "lagebildwerte.fehler.laden":
      "The saved values could not be loaded. That is why no value is shown here.",
    "lagebildwerte.nichtSichtbar": "You cannot see values for this work area.",
    "lagebildwerte.leer": "No real values have been entered for this area yet.",
    "lagebildwerte.spalte.feld": "Value",
    "lagebildwerte.spalte.angabe": "Entry",
    "lagebildwerte.spalte.herkunft": "Source",
    "lagebildwerte.feld.hourlyRate": "Hourly rate",
    "lagebildwerte.feld.hoursSavedPerValidatedKo": "Time saved per validated object",
    "lagebildwerte.feld.reuseFactor": "Reuse",
    "lagebildwerte.einheit.hourlyRate": "€ per hour",
    "lagebildwerte.einheit.hoursSavedPerValidatedKo": "hours per object",
    "lagebildwerte.einheit.reuseFactor": "factor (times used)",
    "lagebildwerte.hilfe.hourlyRate": "Internal cost rate of one working hour.",
    "lagebildwerte.hilfe.hoursSavedPerValidatedKo":
      "Onboarding or search time a validated object saves. Negative if it causes extra effort.",
    "lagebildwerte.hilfe.reuseFactor": "How often an object is reused on average.",
    "lagebildwerte.beispielwert": "Example value (estimated): {{wert}}",
    "lagebildwerte.nichtErfasst": "not entered",
    "lagebildwerte.herkunft.eigene_eingabe": "Own entry (assumption)",
    "lagebildwerte.herkunft.gemessen": "Measured (as stated, not independently checked)",
    "lagebildwerte.beleg": "Evidence: {{beleg}}",
    "lagebildwerte.pruefstatus.nichtGeprueft": "Review status: open – not reviewed by a specialist",
    "lagebildwerte.details.knopf": "Details",
    "lagebildwerte.details.label": "Details on {{feld}}",
    "lagebildwerte.details.keinBeleg": "No evidence given.",
    "lagebildwerte.standKurz": "Version {{version}}",
    "lagebildwerte.rechenweg.knopf": "Calculation",
    "lagebildwerte.rechenweg.label": "Calculation and basis",
    "lagebildwerte.pruefstatus.ergebnis":
      "Review status: open – the result is based on values not reviewed by a specialist.",
    "lagebildwerte.zeitraum": "Applies from {{von}} to {{bis}}",
    "lagebildwerte.stand": "Version {{version}} of {{zeit}}, changed {{wer}}",
    "lagebildwerte.wer.selbst": "by you",
    "lagebildwerte.wer.andere": "by another authorised person",
    "lagebildwerte.ergebnis.titel": "Calculation with these values",
    "lagebildwerte.art.eigene_annahme":
      "Calculation from your own assumptions — not a measured value, not independent proof of impact and not company capital.",
    "lagebildwerte.art.angegebene_messung":
      "Calculation from stated measurements with evidence — the measurement is not independently checked; not company capital.",
    "lagebildwerte.negativ": "Extra effort outweighs the savings: negative relief.",
    "lagebildwerte.basis":
      "Basis today: {{n}} validated of {{total}} objects visible to you in this area · avg. trust {{trust}}",
    "lagebildwerte.demo": "Of these, {{demo}} demo objects — the basis contains sample data.",
    "lagebildwerte.nichtBerechenbar": "No monetary value can be calculated:",
    "lagebildwerte.grund.keine_werte": "No real values have been entered yet.",
    "lagebildwerte.grund.fehlt_hourlyRate": "The hourly rate is missing.",
    "lagebildwerte.grund.fehlt_hoursSavedPerValidatedKo":
      "The time saved per validated object is missing.",
    "lagebildwerte.grund.fehlt_reuseFactor": "The reuse factor is missing.",
    "lagebildwerte.grund.keine_validierten_objekte":
      "There are no validated objects visible to you in this area — no basis, no calculation.",
    "lagebildwerte.bearbeiten": "Enter or correct values",
    "lagebildwerte.nurLesen.gesamt":
      "The values for the whole company are maintained by administration.",
    "lagebildwerte.nurLesen.space": "People with write access in this work area may enter values.",
    "lagebildwerte.form.titel": "Enter values",
    "lagebildwerte.form.zeitraumVon": "Valid from",
    "lagebildwerte.form.zeitraumBis": "Valid until",
    "lagebildwerte.form.zeitraumHilfe":
      "Period the values apply to, or in which they were measured.",
    "lagebildwerte.form.herkunft": "Source",
    "lagebildwerte.form.beleg": "Evidence (required for “measured”)",
    "lagebildwerte.form.belegHilfe":
      "Where the measurement is documented, e.g. a report or document. Please no details about people.",
    "lagebildwerte.form.leerHinweis":
      "Leave empty if a value is not known — then no monetary value is calculated.",
    "lagebildwerte.form.speichern": "Save",
    "lagebildwerte.form.speichert": "Saving …",
    "lagebildwerte.form.abbrechen": "Cancel",
    "lagebildwerte.form.keineZahl": "{{feld}}: please enter a number.",
    "lagebildwerte.form.gespeichert": "Saved — version {{version}}.",
    "lagebildwerte.form.wiederholt":
      "This save had already been stored (version {{version}}) — nothing was created twice.",
    "lagebildwerte.form.unbekannt":
      "It is unknown whether the values were saved (connection or server). Your entry is kept. “Send again” repeats the same save — it will not be created twice.",
    "lagebildwerte.form.erneut": "Send again",
    "lagebildwerte.form.laeuft":
      "Saving — the inputs are locked until the answer arrives, so nothing gets overwritten.",
    "lagebildwerte.form.abbruchUnbekannt":
      "It is unknown whether the last save was stored. The freshly loaded state is shown above — please check it before entering values again.",
    "lagebildwerte.form.konflikt":
      "The values have been changed in the meantime (version {{version}} of {{zeit}}, {{wer}}). Your entry was not saved and remains unchanged in the form.",
    "lagebildwerte.form.konfliktOhneStand":
      "The saved state has changed. Your entry was not saved and remains unchanged in the form.",
    "lagebildwerte.form.aktuell": "Currently saved:",
    "lagebildwerte.form.uebernehmen": "Use the current state (discard my entry)",
    "lagebildwerte.form.ueberschreiben": "Save my entry over the current state",
    "lagebildwerte.form.fehler": "Not saved:",
    "lagebildwerte.form.verboten": "Not saved: {{grund}}",
    "lagebildwerte.beispiel.titel": "Example (estimated)",
    "lagebildwerte.beispiel.kennzeichnung":
      "Example calculation for the PoC: the values below are estimated example values to try out. They are not saved and are not real company capital. Real values are shown separately below.",
    "lagebildwerte.space.knopf": "Situation values of this work area",
  },
  nl: {
    "lagebildwerte.titel": "Echte waarden voor de kenniswaardering",
    "lagebildwerte.einleitung":
      "Hier voeren gebruikers en beheer de echte invoerwaarden van de kenniswaardering in. Ze worden opgeslagen en gelden alleen voor het gekozen werkgebied. Een eigen invoer is een aanname — geen gemeten waarde en geen onafhankelijk bewijs van effect.",
    "lagebildwerte.bereich.label": "Werkgebied",
    "lagebildwerte.bereich.gesamt": "Hele onderneming",
    "lagebildwerte.laedt": "Waarden worden geladen …",
    "lagebildwerte.fehler.laden":
      "De opgeslagen waarden konden niet worden geladen. Daarom staat hier geen waarde.",
    "lagebildwerte.nichtSichtbar": "Voor dit werkgebied kunt u geen waarden zien.",
    "lagebildwerte.leer": "Voor dit gebied zijn nog geen echte waarden ingevoerd.",
    "lagebildwerte.spalte.feld": "Waarde",
    "lagebildwerte.spalte.angabe": "Invoer",
    "lagebildwerte.spalte.herkunft": "Herkomst",
    "lagebildwerte.feld.hourlyRate": "Uurtarief",
    "lagebildwerte.feld.hoursSavedPerValidatedKo": "Bespaarde tijd per gevalideerd object",
    "lagebildwerte.feld.reuseFactor": "Hergebruik",
    "lagebildwerte.einheit.hourlyRate": "€ per uur",
    "lagebildwerte.einheit.hoursSavedPerValidatedKo": "uur per object",
    "lagebildwerte.einheit.reuseFactor": "factor (zo vaak gebruikt)",
    "lagebildwerte.hilfe.hourlyRate": "Interne kostprijs van een werkuur.",
    "lagebildwerte.hilfe.hoursSavedPerValidatedKo":
      "Inwerk- of zoektijd die een gevalideerd object bespaart. Negatief als het extra werk kost.",
    "lagebildwerte.hilfe.reuseFactor": "Hoe vaak een object gemiddeld wordt hergebruikt.",
    "lagebildwerte.beispielwert": "Voorbeeldwaarde (geschat): {{wert}}",
    "lagebildwerte.nichtErfasst": "niet ingevoerd",
    "lagebildwerte.herkunft.eigene_eingabe": "Eigen invoer (aanname)",
    "lagebildwerte.herkunft.gemessen": "Gemeten (volgens opgave, niet onafhankelijk gecontroleerd)",
    "lagebildwerte.beleg": "Bewijs: {{beleg}}",
    "lagebildwerte.pruefstatus.nichtGeprueft":
      "Controlestatus: open – niet inhoudelijk gecontroleerd",
    "lagebildwerte.details.knopf": "Details",
    "lagebildwerte.details.label": "Details over {{feld}}",
    "lagebildwerte.details.keinBeleg": "Geen bewijs opgegeven.",
    "lagebildwerte.standKurz": "Versie {{version}}",
    "lagebildwerte.rechenweg.knopf": "Berekening",
    "lagebildwerte.rechenweg.label": "Berekening en basis",
    "lagebildwerte.pruefstatus.ergebnis":
      "Controlestatus: open – het resultaat berust op niet inhoudelijk gecontroleerde waarden.",
    "lagebildwerte.zeitraum": "Geldt van {{von}} tot {{bis}}",
    "lagebildwerte.stand": "Versie {{version}} van {{zeit}}, gewijzigd {{wer}}",
    "lagebildwerte.wer.selbst": "door u",
    "lagebildwerte.wer.andere": "door een andere bevoegde persoon",
    "lagebildwerte.ergebnis.titel": "Berekening met deze waarden",
    "lagebildwerte.art.eigene_annahme":
      "Berekening op basis van eigen aannames — geen gemeten waarde, geen onafhankelijk bewijs van effect en geen ondernemingskapitaal.",
    "lagebildwerte.art.angegebene_messung":
      "Berekening op basis van opgegeven meetwaarden met bewijs — de meting is niet onafhankelijk gecontroleerd; geen ondernemingskapitaal.",
    "lagebildwerte.negativ": "Het extra werk weegt zwaarder: negatieve ontlasting.",
    "lagebildwerte.basis":
      "Basis vandaag: {{n}} gevalideerde van {{total}} voor u zichtbare objecten in dit gebied · gem. vertrouwen {{trust}}",
    "lagebildwerte.demo": "Waarvan {{demo}} demo-objecten — de basis bevat voorbeeldbestand.",
    "lagebildwerte.nichtBerechenbar": "Geen geldwaarde te berekenen:",
    "lagebildwerte.grund.keine_werte": "Er zijn nog geen echte waarden ingevoerd.",
    "lagebildwerte.grund.fehlt_hourlyRate": "Het uurtarief ontbreekt.",
    "lagebildwerte.grund.fehlt_hoursSavedPerValidatedKo":
      "De bespaarde tijd per gevalideerd object ontbreekt.",
    "lagebildwerte.grund.fehlt_reuseFactor": "Het hergebruik ontbreekt.",
    "lagebildwerte.grund.keine_validierten_objekte":
      "In dit gebied zijn voor u geen gevalideerde objecten — zonder basis geen berekening.",
    "lagebildwerte.bearbeiten": "Waarden invoeren of corrigeren",
    "lagebildwerte.nurLesen.gesamt": "De waarden voor de hele onderneming beheert het beheer.",
    "lagebildwerte.nurLesen.space":
      "Waarden invoeren mogen personen met schrijfrecht in dit werkgebied.",
    "lagebildwerte.form.titel": "Waarden invoeren",
    "lagebildwerte.form.zeitraumVon": "Geldt vanaf",
    "lagebildwerte.form.zeitraumBis": "Geldt tot",
    "lagebildwerte.form.zeitraumHilfe": "Periode waarvoor de waarden gelden of waarin is gemeten.",
    "lagebildwerte.form.herkunft": "Herkomst",
    "lagebildwerte.form.beleg": "Bewijs (verplicht bij „gemeten”)",
    "lagebildwerte.form.belegHilfe":
      "Waar de meting staat, bijvoorbeeld een rapport of document. Graag geen gegevens over personen.",
    "lagebildwerte.form.leerHinweis":
      "Leeg laten als een waarde niet bekend is — dan wordt geen geldwaarde berekend.",
    "lagebildwerte.form.speichern": "Opslaan",
    "lagebildwerte.form.speichert": "Bezig met opslaan …",
    "lagebildwerte.form.abbrechen": "Annuleren",
    "lagebildwerte.form.keineZahl": "{{feld}}: voer een getal in.",
    "lagebildwerte.form.gespeichert": "Opgeslagen — versie {{version}}.",
    "lagebildwerte.form.wiederholt":
      "Deze opslag was al opgeslagen (versie {{version}}) — niets is dubbel aangemaakt.",
    "lagebildwerte.form.unbekannt":
      "Het is onbekend of er is opgeslagen (verbinding of server). Uw invoer blijft bewaard. „Opnieuw verzenden” herhaalt dezelfde opslag — die wordt niet dubbel aangemaakt.",
    "lagebildwerte.form.erneut": "Opnieuw verzenden",
    "lagebildwerte.form.laeuft":
      "Bezig met opslaan — de invoer is vergrendeld tot het antwoord er is, zodat niets wordt overschreven.",
    "lagebildwerte.form.abbruchUnbekannt":
      "Het is onbekend of de laatste opslag is opgeslagen. Hierboven staat de opnieuw geladen stand — controleer die voordat u opnieuw invoert.",
    "lagebildwerte.form.konflikt":
      "De waarden zijn intussen gewijzigd (versie {{version}} van {{zeit}}, {{wer}}). Uw invoer is niet opgeslagen en staat ongewijzigd in het formulier.",
    "lagebildwerte.form.konfliktOhneStand":
      "De opgeslagen stand is gewijzigd. Uw invoer is niet opgeslagen en staat ongewijzigd in het formulier.",
    "lagebildwerte.form.aktuell": "Nu opgeslagen:",
    "lagebildwerte.form.uebernehmen": "Huidige stand overnemen (mijn invoer verwerpen)",
    "lagebildwerte.form.ueberschreiben": "Mijn invoer over de huidige stand opslaan",
    "lagebildwerte.form.fehler": "Niet opgeslagen:",
    "lagebildwerte.form.verboten": "Niet opgeslagen: {{grund}}",
    "lagebildwerte.beispiel.titel": "Voorbeeld (geschat)",
    "lagebildwerte.beispiel.kennzeichnung":
      "Voorbeeldberekening voor de PoC: de waarden hieronder zijn geschatte voorbeeldwaarden om uit te proberen. Ze worden niet opgeslagen en zijn geen echt ondernemingskapitaal. Echte waarden staan apart hieronder.",
    "lagebildwerte.space.knopf": "Situatiewaarden van dit werkgebied",
  },
} satisfies Textmodul;
