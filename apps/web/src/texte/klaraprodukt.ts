// ================================================================================================
// ASSISTENZ IM PRODUKT (Auftrag produkt:20261010:assistenz-produkteinstieg) — die Texte des normalen
// Produkteinstiegs.
// ================================================================================================
//
// Im normalen Produkt ist die gelieferte Assistenz ohne Vorschau-Aufruf sichtbar. Ohne persönliches
// Profil heisst sie neutral „Deine Assistenz“; mit Profil trägt sie dessen Namen ({{name}}). Sie
// arbeitet nur im echten Betrieb — vorgefertigte Antworten gibt es ausschliesslich in der getrennten,
// gekennzeichneten Vorschau. Noch nicht freigegebene Ausbaustufen werden als solche benannt.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "klaraprodukt.",
  legacySchluessel: [],
  de: {
    "klaraprodukt.name.neutral": "Deine Assistenz",
    "klaraprodukt.figur.label": "{{name}} – persönliches Gespräch öffnen oder schließen",
    "klaraprodukt.untertitel": "Dein gespeichertes Gespräch",
    "klaraprodukt.leer": "Noch kein gespeichertes Gespräch. Stell deine erste Frage.",
    "klaraprodukt.auswahl.knopf": "{{name}} fragen",
    "klaraprodukt.aktion.label": "Was soll damit geschehen?",
    "klaraprodukt.eingabe.label": "Deine Frage",
    "klaraprodukt.eingabe.platzhalter": "Frag etwas …",
    "klaraprodukt.offen.titel": "Noch nicht verfügbar",
    "klaraprodukt.offen.text":
      "Aufgaben, Erinnerungen und Termine sind noch in Arbeit und hier nicht freigegeben.",
    "klaraprodukt.auswahl.offen":
      "„Umformulieren“ zeigt Original und Vorschlag nebeneinander – geändert wird erst, wenn du übernimmst und im Editor speicherst. „Notizentwurf“ legt eine Notiz mit Herkunft an, die nur in dieser Sitzung bleibt.",
    "klaraprodukt.vorschau.link": "Vorschau mit fiktiven Beispielen ansehen",
    "klaraprodukt.vorschau.hinweis":
      "Die Vorschau zeigt vorgefertigte Antworten an fiktiven Artikeln; dein echtes Gespräch bleibt davon unberührt.",
  },
  en: {
    "klaraprodukt.name.neutral": "Your assistant",
    "klaraprodukt.figur.label": "{{name}} – open or close your personal conversation",
    "klaraprodukt.untertitel": "Your saved conversation",
    "klaraprodukt.leer": "No saved conversation yet. Ask your first question.",
    "klaraprodukt.auswahl.knopf": "Ask {{name}}",
    "klaraprodukt.aktion.label": "What should happen with it?",
    "klaraprodukt.eingabe.label": "Your question",
    "klaraprodukt.eingabe.platzhalter": "Ask something …",
    "klaraprodukt.offen.titel": "Not available yet",
    "klaraprodukt.offen.text":
      "Tasks, reminders and appointments are still in progress and not released here.",
    "klaraprodukt.auswahl.offen":
      "“Rephrase” shows original and suggestion side by side – nothing changes until you apply it and save in the editor. “Note draft” creates a note with its origin that stays in this session only.",
    "klaraprodukt.vorschau.link": "View the preview with fictional examples",
    "klaraprodukt.vorschau.hinweis":
      "The preview shows prepared answers on fictional articles; your real conversation is not affected.",
  },
  nl: {
    "klaraprodukt.name.neutral": "Je assistent",
    "klaraprodukt.figur.label": "{{name}} – persoonlijk gesprek openen of sluiten",
    "klaraprodukt.untertitel": "Je opgeslagen gesprek",
    "klaraprodukt.leer": "Nog geen opgeslagen gesprek. Stel je eerste vraag.",
    "klaraprodukt.auswahl.knopf": "{{name}} vragen",
    "klaraprodukt.aktion.label": "Wat moet ermee gebeuren?",
    "klaraprodukt.eingabe.label": "Je vraag",
    "klaraprodukt.eingabe.platzhalter": "Vraag iets …",
    "klaraprodukt.offen.titel": "Nog niet beschikbaar",
    "klaraprodukt.offen.text":
      "Taken, herinneringen en afspraken zijn nog in ontwikkeling en hier niet vrijgegeven.",
    "klaraprodukt.auswahl.offen":
      "„Herformuleren” toont origineel en voorstel naast elkaar – er verandert pas iets als je het overneemt en in de editor opslaat. „Notitieconcept” maakt een notitie met herkomst die alleen in deze sessie blijft.",
    "klaraprodukt.vorschau.link": "Preview met fictieve voorbeelden bekijken",
    "klaraprodukt.vorschau.hinweis":
      "De preview toont voorbereide antwoorden bij fictieve artikelen; je echte gesprek blijft ongemoeid.",
  },
} satisfies Textmodul;
