// ================================================================================================
// AUFNAHME 20260922 · PRÜFBOARD-BEDIENUNG — Zuständigkeit und Fehlerzustände an der Prüfkarte.
// ================================================================================================
//
// Drei Auskünfte, die die Prüffläche bisher schuldig blieb:
//   · WER zuständig ist — „zugewiesen" ohne Namen beantwortete die Frage nicht, und ein
//     gescheitertes Zuweisen blieb ganz ohne Meldung.
//   · Der TEILERFOLG von Rückfrage/Ablehnung — die Begründung liegt am Server, die Bewertung nicht.
//     Bisher hiess das „Konnte nicht gespeichert werden", und der zweite Versuch legte die
//     Begründung ein zweites Mal an.
//   · Die KONFLIKTLAGE je Karte (§8.2, Pedis Entscheidung vom 03.10.2026) samt eigenem Lade- und
//     Fehlerzustand. Der Titel der Markierung ist der vorhandene `conflict.impact.(truth)Title`.
//   · Die Beschriftung des Volltextfelds. Seit der Filter den ausführlichen Inhalt durchsucht
//     (N-0072), heisst es wieder „Volltext". Ein neuer Schlüssel statt eines geänderten
//     `val.filter`: dessen Wert hält der Umzugsnachweis `tests/i18n-textmodule/werte-vorher.json`
//     samt Prüfsumme fest, und die lässt sich nur mit `bestand-erzeugen.ts` neu bilden.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "pruefboard.",
  legacySchluessel: [],
  de: {
    "pruefboard.zugewiesenAn": "Zugewiesen an",
    "pruefboard.zuweisenErfolg": "Zugewiesen an {{name}}.",
    "pruefboard.zuweisenFehler": "Zuweisen hat nicht geklappt: {{grund}}",
    "pruefboard.bereitsZugewiesen": "{{name}} (bereits zugewiesen)",
    "pruefboard.begruendungGespeichert":
      "Die Begründung ist gespeichert, die Bewertung nicht. Erneut senden schickt nur die Bewertung.",
    "pruefboard.bewertungSenden": "Bewertung erneut senden",
    "pruefboard.konfliktAnzahl": "{{n}} offene Konflikte",
    "pruefboard.konfliktZurSeite": "Zu den Konflikten",
    "pruefboard.konfliktMarke": "Offener Konflikt",
    "pruefboard.konfliktLaedt": "Konfliktdaten werden geladen …",
    "pruefboard.konfliktFehler":
      "Ob zu diesem Beitrag Konflikte offen sind, konnte nicht geladen werden.",
    "pruefboard.konfliktNichtFrisch":
      "Konfliktstand nicht aktuell — die letzte Auffrischung ist fehlgeschlagen.",
    "pruefboard.volltextFiltern": "Volltext filtern …",
    "pruefboard.stapel.alle": "Alle auswählen",
    "pruefboard.stapel.waehlen": "{{titel}} auswählen",
    "pruefboard.stapel.anzahl": "{{n}} ausgewählt",
    "pruefboard.stapel.bestaetigen": "Stapel bestätigen",
    "pruefboard.stapel.zuweisen": "Stapel zuweisen …",
    "pruefboard.stapel.aufheben": "Auswahl aufheben",
    "pruefboard.stapel.laeuft": "Stapel wird bearbeitet …",
    "pruefboard.stapel.ergebnis": "Ergebnis je Beitrag",
    "pruefboard.stapel.art.bestaetigt": "bestätigt",
    "pruefboard.stapel.art.zugewiesen": "zugewiesen",
    "pruefboard.stapel.art.gesperrt": "nicht geschickt — KI-Prüfung läuft",
    "pruefboard.stapel.art.dubletteOffen":
      "nicht geschickt — offene Dublette, bitte einzeln bestätigen",
    "pruefboard.stapel.art.stufeFehlt": "nicht geschickt — keine Stufe, bitte einzeln einstufen",
    "pruefboard.stapel.art.bereitsZugewiesen": "war bereits zugewiesen",
    "pruefboard.stapel.art.fehler": "fehlgeschlagen: {{meldung}}",
    "pruefboard.widerspruch.titel": "Widerspricht einem anderen Beitrag? (optional)",
    "pruefboard.widerspruch.suche": "Beitrag suchen …",
    "pruefboard.widerspruch.entfernen": "Entfernen",
    "pruefboard.widerspruch.art": "Art des Widerspruchs …",
    "pruefboard.widerspruch.suchFehler": "Die Suche ist gerade nicht möglich.",
  },
  en: {
    "pruefboard.zugewiesenAn": "Assigned to",
    "pruefboard.zuweisenErfolg": "Assigned to {{name}}.",
    "pruefboard.zuweisenFehler": "Assigning failed: {{grund}}",
    "pruefboard.bereitsZugewiesen": "{{name}} (already assigned)",
    "pruefboard.begruendungGespeichert":
      "The reason is saved, the rating is not. Sending again submits only the rating.",
    "pruefboard.bewertungSenden": "Send rating again",
    "pruefboard.konfliktAnzahl": "{{n}} open conflicts",
    "pruefboard.konfliktZurSeite": "Go to conflicts",
    "pruefboard.konfliktMarke": "Open conflict",
    "pruefboard.konfliktLaedt": "Loading conflict data …",
    "pruefboard.konfliktFehler": "Could not load whether this item has open conflicts.",
    "pruefboard.konfliktNichtFrisch": "Conflict status not current — the last refresh failed.",
    "pruefboard.volltextFiltern": "Filter full text …",
    "pruefboard.stapel.alle": "Select all",
    "pruefboard.stapel.waehlen": "Select {{titel}}",
    "pruefboard.stapel.anzahl": "{{n}} selected",
    "pruefboard.stapel.bestaetigen": "Approve batch",
    "pruefboard.stapel.zuweisen": "Assign batch …",
    "pruefboard.stapel.aufheben": "Clear selection",
    "pruefboard.stapel.laeuft": "Processing batch …",
    "pruefboard.stapel.ergebnis": "Result per item",
    "pruefboard.stapel.art.bestaetigt": "approved",
    "pruefboard.stapel.art.zugewiesen": "assigned",
    "pruefboard.stapel.art.gesperrt": "not sent — AI check running",
    "pruefboard.stapel.art.dubletteOffen": "not sent — open duplicate, please confirm individually",
    "pruefboard.stapel.art.stufeFehlt": "not sent — no level, please classify individually",
    "pruefboard.stapel.art.bereitsZugewiesen": "was already assigned",
    "pruefboard.stapel.art.fehler": "failed: {{meldung}}",
    "pruefboard.widerspruch.titel": "Contradicts another item? (optional)",
    "pruefboard.widerspruch.suche": "Search item …",
    "pruefboard.widerspruch.entfernen": "Remove",
    "pruefboard.widerspruch.art": "Kind of contradiction …",
    "pruefboard.widerspruch.suchFehler": "Search is not available right now.",
  },
  nl: {
    "pruefboard.zugewiesenAn": "Toegewezen aan",
    "pruefboard.zuweisenErfolg": "Toegewezen aan {{name}}.",
    "pruefboard.zuweisenFehler": "Toewijzen is mislukt: {{grund}}",
    "pruefboard.bereitsZugewiesen": "{{name}} (al toegewezen)",
    "pruefboard.begruendungGespeichert":
      "De onderbouwing is opgeslagen, de beoordeling niet. Opnieuw versturen verstuurt alleen de beoordeling.",
    "pruefboard.bewertungSenden": "Beoordeling opnieuw versturen",
    "pruefboard.konfliktAnzahl": "{{n}} openstaande conflicten",
    "pruefboard.konfliktZurSeite": "Naar de conflicten",
    "pruefboard.konfliktMarke": "Openstaand conflict",
    "pruefboard.konfliktLaedt": "Conflictgegevens worden geladen …",
    "pruefboard.konfliktFehler":
      "Kon niet worden geladen of er voor dit item conflicten openstaan.",
    "pruefboard.konfliktNichtFrisch":
      "Conflictstand niet actueel — de laatste verversing is mislukt.",
    "pruefboard.volltextFiltern": "Volledige tekst filteren …",
    "pruefboard.stapel.alle": "Alles selecteren",
    "pruefboard.stapel.waehlen": "{{titel}} selecteren",
    "pruefboard.stapel.anzahl": "{{n}} geselecteerd",
    "pruefboard.stapel.bestaetigen": "Stapel goedkeuren",
    "pruefboard.stapel.zuweisen": "Stapel toewijzen …",
    "pruefboard.stapel.aufheben": "Selectie opheffen",
    "pruefboard.stapel.laeuft": "Stapel wordt verwerkt …",
    "pruefboard.stapel.ergebnis": "Resultaat per bijdrage",
    "pruefboard.stapel.art.bestaetigt": "goedgekeurd",
    "pruefboard.stapel.art.zugewiesen": "toegewezen",
    "pruefboard.stapel.art.gesperrt": "niet verstuurd — AI-controle loopt",
    "pruefboard.stapel.art.dubletteOffen":
      "niet verstuurd — openstaand duplicaat, a.u.b. afzonderlijk bevestigen",
    "pruefboard.stapel.art.stufeFehlt": "niet verstuurd — geen niveau, a.u.b. afzonderlijk indelen",
    "pruefboard.stapel.art.bereitsZugewiesen": "was al toegewezen",
    "pruefboard.stapel.art.fehler": "mislukt: {{meldung}}",
    "pruefboard.widerspruch.titel": "In tegenspraak met een andere bijdrage? (optioneel)",
    "pruefboard.widerspruch.suche": "Bijdrage zoeken …",
    "pruefboard.widerspruch.entfernen": "Verwijderen",
    "pruefboard.widerspruch.art": "Soort tegenspraak …",
    "pruefboard.widerspruch.suchFehler": "Zoeken is op dit moment niet mogelijk.",
  },
} satisfies Textmodul;
