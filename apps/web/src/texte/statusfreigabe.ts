// ================================================================================================
// STATUS-FREIGABE (produkt:20261007) · STATUS UND FREIGABEN WAHRHEITSGEMÄSS ANZEIGEN.
// ================================================================================================
//
// Die Sätze, mit denen die Oberfläche auseinanderhält, was leicht verwechselt wird: eine einzelne
// Zustimmung (eine Stimme von mehreren erforderlichen), eine direkt gespeicherte Änderung (gespeichert,
// nicht freigegeben), ein Änderungsvorschlag und eine tatsächlich freigegebene Fassung — und bei
// Arbeitsanleitungen, WER WANN WELCHE Fassung entschieden hat. „Validiert" und „freigegeben" stehen
// nur in den Sätzen, die ausschliesslich bei entsprechender Serverantwort gezeigt werden.
//
// ANREDE „du", wie die übrigen Rückmeldungen des Produkts.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "statusfreigabe.",
  legacySchluessel: [],
  de: {
    "statusfreigabe.zustimmung.offen_one":
      "Deine Zustimmung ist gezählt: {{have}} von {{need}} erforderlichen positiven Bewertungen. Es fehlt noch {{count}} – der Eintrag ist noch nicht validiert.",
    "statusfreigabe.zustimmung.offen_other":
      "Deine Zustimmung ist gezählt: {{have}} von {{need}} erforderlichen positiven Bewertungen. Es fehlen noch {{count}} – der Eintrag ist noch nicht validiert.",
    "statusfreigabe.zustimmung.offenOhneRest":
      "Deine Zustimmung ist gezählt ({{have}} positive Bewertungen). Der Eintrag ist noch nicht validiert.",
    "statusfreigabe.zustimmung.blockiert_one":
      "Deine Zustimmung ist gezählt ({{have}} positive Bewertungen). {{count}} rote Bewertung blockiert die Validierung – der Eintrag ist nicht validiert.",
    "statusfreigabe.zustimmung.blockiert_other":
      "Deine Zustimmung ist gezählt ({{have}} positive Bewertungen). {{count}} rote Bewertungen blockieren die Validierung – der Eintrag ist nicht validiert.",
    "statusfreigabe.zustimmung.blockiertRest_one":
      "Deine Zustimmung ist gezählt: {{have}} von {{need}} erforderlichen positiven Bewertungen, noch offen: {{rest}}. Zusätzlich blockiert {{count}} rote Bewertung die Validierung – der Eintrag ist nicht validiert.",
    "statusfreigabe.zustimmung.blockiertRest_other":
      "Deine Zustimmung ist gezählt: {{have}} von {{need}} erforderlichen positiven Bewertungen, noch offen: {{rest}}. Zusätzlich blockieren {{count}} rote Bewertungen die Validierung – der Eintrag ist nicht validiert.",
    "statusfreigabe.zustimmung.blockiertGenug_one":
      "Deine Zustimmung ist gezählt: {{have}} von {{need}} erforderlichen positiven Bewertungen liegen vor. {{count}} rote Bewertung blockiert trotzdem die Validierung – der Eintrag ist nicht validiert.",
    "statusfreigabe.zustimmung.blockiertGenug_other":
      "Deine Zustimmung ist gezählt: {{have}} von {{need}} erforderlichen positiven Bewertungen liegen vor. {{count}} rote Bewertungen blockieren trotzdem die Validierung – der Eintrag ist nicht validiert.",
    "statusfreigabe.zustimmung.validiertZahl":
      "Deine Zustimmung ist gezählt: {{have}} von {{need}} erforderlichen positiven Bewertungen sind erreicht – der Eintrag ist jetzt validiert.",
    "statusfreigabe.zustimmung.validiert":
      "Deine Zustimmung ist gezählt – der Eintrag ist jetzt validiert.",
    "statusfreigabe.zustimmung.unbekannt":
      "Deine Zustimmung ist gezählt. Wie viele Bewertungen noch fehlen, hat der Server nicht gemeldet – ob der Eintrag validiert ist, zeigt seine Statusanzeige.",
    "statusfreigabe.anleitung.freigegebenVon":
      "Freigegeben von {{name}} am {{zeit}} – freigegebene Fassung: Stand {{nummer}}.",
    "statusfreigabe.anleitung.abgelehntVon":
      "Abgelehnt von {{name}} am {{zeit}} – abgelehnte Fassung: Stand {{nummer}}.",
    "statusfreigabe.speichern.nichtFreigegebenFassung":
      "Deine Änderung steht als Fassung {{version}} – gespeichert, aber nicht freigegeben. Gültig wird sie erst durch die Prüfung.",
    "statusfreigabe.speichern.nichtFreigegeben":
      "Deine Änderung ist gespeichert, aber nicht freigegeben. Gültig wird sie erst durch die Prüfung.",
    "statusfreigabe.speichern.freigegebenFassung":
      "Der Eintrag bleibt in Fassung {{version}} freigegeben.",
    "statusfreigabe.speichern.freigegeben": "Der Eintrag bleibt freigegeben.",
    "statusfreigabe.vorschlag.uebernommenFreigegebenFassung":
      "Vorschlag übernommen und freigegeben – Fassung {{version}} ist jetzt die freigegebene Fassung.",
    "statusfreigabe.vorschlag.uebernommenFreigegeben": "Vorschlag übernommen und freigegeben.",
    "statusfreigabe.vorschlag.uebernommenOffen":
      "Vorschlag übernommen. Eine Freigabe hat der Server dafür nicht gemeldet – der Eintrag zeigt seinen Stand.",
    "statusfreigabe.vorschlag.abgelehnt":
      "Vorschlag abgelehnt. Der Eintrag bleibt unverändert in seinem bisherigen Stand.",
    "statusfreigabe.vorschlag.eingereichtOffen":
      "Eingereicht. Die bisherige Fassung bleibt, wie sie ist – offen und nicht freigegeben –, bis jemand anderes deinen Vorschlag übernimmt.",
    "statusfreigabe.vorschlag.eingereicht":
      "Eingereicht. Der Eintrag trägt weiter seinen bisherigen Stand, bis jemand anderes deinen Vorschlag übernimmt.",
    "statusfreigabe.klara.titel": "Stand dieses Objekts",
    "statusfreigabe.klara.hinweis":
      "So steht es auf dieser Seite – Klara übernimmt die Anzeige wörtlich und bewertet den Stand nicht selbst.",
  },
  en: {
    "statusfreigabe.zustimmung.offen_one":
      "Your approval is counted: {{have}} of {{need}} required positive reviews. {{count}} more is needed – the entry is not validated yet.",
    "statusfreigabe.zustimmung.offen_other":
      "Your approval is counted: {{have}} of {{need}} required positive reviews. {{count}} more are needed – the entry is not validated yet.",
    "statusfreigabe.zustimmung.offenOhneRest":
      "Your approval is counted ({{have}} positive reviews). The entry is not validated yet.",
    "statusfreigabe.zustimmung.blockiert_one":
      "Your approval is counted ({{have}} positive reviews). {{count}} red review blocks validation – the entry is not validated.",
    "statusfreigabe.zustimmung.blockiert_other":
      "Your approval is counted ({{have}} positive reviews). {{count}} red reviews block validation – the entry is not validated.",
    "statusfreigabe.zustimmung.blockiertRest_one":
      "Your approval is counted: {{have}} of {{need}} required positive reviews, still open: {{rest}}. In addition, {{count}} red review blocks validation – the entry is not validated.",
    "statusfreigabe.zustimmung.blockiertRest_other":
      "Your approval is counted: {{have}} of {{need}} required positive reviews, still open: {{rest}}. In addition, {{count}} red reviews block validation – the entry is not validated.",
    "statusfreigabe.zustimmung.blockiertGenug_one":
      "Your approval is counted: {{have}} of {{need}} required positive reviews are in. {{count}} red review still blocks validation – the entry is not validated.",
    "statusfreigabe.zustimmung.blockiertGenug_other":
      "Your approval is counted: {{have}} of {{need}} required positive reviews are in. {{count}} red reviews still block validation – the entry is not validated.",
    "statusfreigabe.zustimmung.validiertZahl":
      "Your approval is counted: {{have}} of {{need}} required positive reviews are reached – the entry is now validated.",
    "statusfreigabe.zustimmung.validiert": "Your approval is counted – the entry is now validated.",
    "statusfreigabe.zustimmung.unbekannt":
      "Your approval is counted. The server did not report how many reviews are still missing – the entry’s status display shows whether it is validated.",
    "statusfreigabe.anleitung.freigegebenVon":
      "Approved by {{name}} on {{zeit}} – approved version: state {{nummer}}.",
    "statusfreigabe.anleitung.abgelehntVon":
      "Rejected by {{name}} on {{zeit}} – rejected version: state {{nummer}}.",
    "statusfreigabe.speichern.nichtFreigegebenFassung":
      "Your change is version {{version}} – saved, but not approved. It only applies after review.",
    "statusfreigabe.speichern.nichtFreigegeben":
      "Your change is saved, but not approved. It only applies after review.",
    "statusfreigabe.speichern.freigegebenFassung":
      "The entry remains approved in version {{version}}.",
    "statusfreigabe.speichern.freigegeben": "The entry remains approved.",
    "statusfreigabe.vorschlag.uebernommenFreigegebenFassung":
      "Proposal accepted and approved – version {{version}} is now the approved version.",
    "statusfreigabe.vorschlag.uebernommenFreigegeben": "Proposal accepted and approved.",
    "statusfreigabe.vorschlag.uebernommenOffen":
      "Proposal accepted. The server did not report an approval for it – the entry shows its status.",
    "statusfreigabe.vorschlag.abgelehnt":
      "Proposal rejected. The entry stays unchanged in its previous state.",
    "statusfreigabe.vorschlag.eingereichtOffen":
      "Submitted. The previous version stays as it is – open and not approved – until someone else accepts your proposal.",
    "statusfreigabe.vorschlag.eingereicht":
      "Submitted. The entry keeps its previous state until someone else accepts your proposal.",
    "statusfreigabe.klara.titel": "Status of this object",
    "statusfreigabe.klara.hinweis":
      "This is what this page shows – Klara repeats the display word for word and does not assess the status herself.",
  },
  nl: {
    "statusfreigabe.zustimmung.offen_one":
      "Je goedkeuring is geteld: {{have}} van {{need}} vereiste positieve beoordelingen. Er ontbreekt nog {{count}} – het item is nog niet gevalideerd.",
    "statusfreigabe.zustimmung.offen_other":
      "Je goedkeuring is geteld: {{have}} van {{need}} vereiste positieve beoordelingen. Er ontbreken nog {{count}} – het item is nog niet gevalideerd.",
    "statusfreigabe.zustimmung.offenOhneRest":
      "Je goedkeuring is geteld ({{have}} positieve beoordelingen). Het item is nog niet gevalideerd.",
    "statusfreigabe.zustimmung.blockiert_one":
      "Je goedkeuring is geteld ({{have}} positieve beoordelingen). {{count}} rode beoordeling blokkeert de validatie – het item is niet gevalideerd.",
    "statusfreigabe.zustimmung.blockiert_other":
      "Je goedkeuring is geteld ({{have}} positieve beoordelingen). {{count}} rode beoordelingen blokkeren de validatie – het item is niet gevalideerd.",
    "statusfreigabe.zustimmung.blockiertRest_one":
      "Je goedkeuring is geteld: {{have}} van {{need}} vereiste positieve beoordelingen, nog open: {{rest}}. Daarnaast blokkeert {{count}} rode beoordeling de validatie – het item is niet gevalideerd.",
    "statusfreigabe.zustimmung.blockiertRest_other":
      "Je goedkeuring is geteld: {{have}} van {{need}} vereiste positieve beoordelingen, nog open: {{rest}}. Daarnaast blokkeren {{count}} rode beoordelingen de validatie – het item is niet gevalideerd.",
    "statusfreigabe.zustimmung.blockiertGenug_one":
      "Je goedkeuring is geteld: {{have}} van {{need}} vereiste positieve beoordelingen zijn er. {{count}} rode beoordeling blokkeert toch de validatie – het item is niet gevalideerd.",
    "statusfreigabe.zustimmung.blockiertGenug_other":
      "Je goedkeuring is geteld: {{have}} van {{need}} vereiste positieve beoordelingen zijn er. {{count}} rode beoordelingen blokkeren toch de validatie – het item is niet gevalideerd.",
    "statusfreigabe.zustimmung.validiertZahl":
      "Je goedkeuring is geteld: {{have}} van {{need}} vereiste positieve beoordelingen zijn bereikt – het item is nu gevalideerd.",
    "statusfreigabe.zustimmung.validiert": "Je goedkeuring is geteld – het item is nu gevalideerd.",
    "statusfreigabe.zustimmung.unbekannt":
      "Je goedkeuring is geteld. Hoeveel beoordelingen nog ontbreken, heeft de server niet gemeld – of het item gevalideerd is, toont de statusweergave.",
    "statusfreigabe.anleitung.freigegebenVon":
      "Goedgekeurd door {{name}} op {{zeit}} – goedgekeurde versie: stand {{nummer}}.",
    "statusfreigabe.anleitung.abgelehntVon":
      "Afgewezen door {{name}} op {{zeit}} – afgewezen versie: stand {{nummer}}.",
    "statusfreigabe.speichern.nichtFreigegebenFassung":
      "Je wijziging staat als versie {{version}} – opgeslagen, maar niet goedgekeurd. Ze geldt pas na de beoordeling.",
    "statusfreigabe.speichern.nichtFreigegeben":
      "Je wijziging is opgeslagen, maar niet goedgekeurd. Ze geldt pas na de beoordeling.",
    "statusfreigabe.speichern.freigegebenFassung":
      "Het item blijft in versie {{version}} goedgekeurd.",
    "statusfreigabe.speichern.freigegeben": "Het item blijft goedgekeurd.",
    "statusfreigabe.vorschlag.uebernommenFreigegebenFassung":
      "Voorstel overgenomen en goedgekeurd – versie {{version}} is nu de goedgekeurde versie.",
    "statusfreigabe.vorschlag.uebernommenFreigegeben": "Voorstel overgenomen en goedgekeurd.",
    "statusfreigabe.vorschlag.uebernommenOffen":
      "Voorstel overgenomen. Een goedkeuring heeft de server daarvoor niet gemeld – het item toont zijn stand.",
    "statusfreigabe.vorschlag.abgelehnt":
      "Voorstel afgewezen. Het item blijft ongewijzigd in zijn vorige stand.",
    "statusfreigabe.vorschlag.eingereichtOffen":
      "Ingediend. De vorige versie blijft zoals ze is – open en niet goedgekeurd – tot iemand anders je voorstel overneemt.",
    "statusfreigabe.vorschlag.eingereicht":
      "Ingediend. Het item behoudt zijn vorige stand tot iemand anders je voorstel overneemt.",
    "statusfreigabe.klara.titel": "Stand van dit object",
    "statusfreigabe.klara.hinweis":
      "Zo staat het op deze pagina – Klara neemt de weergave letterlijk over en beoordeelt de stand niet zelf.",
  },
} satisfies Textmodul;
