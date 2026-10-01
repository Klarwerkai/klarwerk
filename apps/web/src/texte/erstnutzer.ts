// ================================================================================================
// ERSTNUTZER · DER NULLTREFFER IST KEINE SACKGASSE (R-0474, Auftrag gesamt-erstnutzerfuehrung).
// ================================================================================================
//
// „Wenn eine Suche nichts findet, steht dort ein hilfreicher Satz statt einer leeren Fläche." Die
// Bibliothek erfüllt das seit JOB 3063/3788 („Nichts gefunden." samt Knopf „Erfassen") — dort
// ändert dieses Modul nichts. Offen waren zwei Suchen, die bis hierher nur feststellten, dass
// nichts da ist: der Direktzugang „Gehe zu …" (`cmd.empty`) und die Hilfesuche
// (`help.noResults`). Beide Sätze bleiben wörtlich stehen; darunter steht jetzt der nächste
// Schritt. Wer die Fragen-Seite erreicht, bekommt seine Eingabe als Frage angeboten — sonst nur
// den Rat, ein anderes Wort zu versuchen. Kein Weg wird angeboten, den der Router abweist.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "erstnutzer.",
  legacySchluessel: [],
  de: {
    "erstnutzer.palette.anderesWort": "Versuch einen anderen Seitennamen.",
    "erstnutzer.palette.alsFrage": "„{{q}}“ im Wissen fragen",
    "erstnutzer.hilfe.anderesWort": "Versuch ein kürzeres oder anderes Stichwort.",
    "erstnutzer.hilfe.alsFrage": "„{{q}}“ als Frage an das Wissen stellen",
  },
  en: {
    "erstnutzer.palette.anderesWort": "Try a different page name.",
    "erstnutzer.palette.alsFrage": "Ask the knowledge base: “{{q}}”",
    "erstnutzer.hilfe.anderesWort": "Try a shorter or different keyword.",
    "erstnutzer.hilfe.alsFrage": "Ask the knowledge base: “{{q}}”",
  },
  nl: {
    "erstnutzer.palette.anderesWort": "Probeer een andere paginanaam.",
    "erstnutzer.palette.alsFrage": "„{{q}}” aan de kennis vragen",
    "erstnutzer.hilfe.anderesWort": "Probeer een korter of ander trefwoord.",
    "erstnutzer.hilfe.alsFrage": "„{{q}}” als vraag aan de kennis stellen",
  },
} satisfies Textmodul;
