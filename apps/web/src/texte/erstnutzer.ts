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
//
// R-1012 (Folgeauftrag `…-quellen`): `erstnutzer.faehigkeiten.*` ist die Fähigkeitsübersicht im
// Blatt „Über KLARWERK" (`lib/faehigkeiten.ts`). Je Bereich EIN Satz, was man dort tun kann — der
// Inhalt folgt den Seitenhilfen der Bereiche und verspricht nichts darüber hinaus. Die Namen der
// Bereiche stehen hier NICHT: sie kommen aus `anzeigeNameKey` (ein Name je Bereich, UX-08).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "erstnutzer.",
  legacySchluessel: [],
  de: {
    "erstnutzer.palette.anderesWort": "Versuch einen anderen Seitennamen.",
    "erstnutzer.palette.alsFrage": "„{{q}}“ im Wissen fragen",
    "erstnutzer.hilfe.anderesWort": "Versuch ein kürzeres oder anderes Stichwort.",
    "erstnutzer.hilfe.alsFrage": "„{{q}}“ als Frage an das Wissen stellen",
    "erstnutzer.faehigkeiten.titel": "Was KLARWERK kann",
    "erstnutzer.faehigkeiten.einleitung":
      "Ein Kreislauf in drei Schritten: Wissen erfassen, prüfen, wiederfinden. Bereiche, die du mit deiner Rolle öffnen kannst, sind direkt verlinkt; die übrigen stehen hier zur Auskunft.",
    "erstnutzer.faehigkeiten.schritt.erfassen": "1 · Erfassen",
    "erstnutzer.faehigkeiten.schritt.pruefen": "2 · Prüfen",
    "erstnutzer.faehigkeiten.schritt.finden": "3 · Finden und nutzen",
    "erstnutzer.faehigkeiten.erfassen":
      "Aufschreiben, was du im Betrieb gelernt hast, als Entwurf sichern und zur Prüfung einreichen.",
    "erstnutzer.faehigkeiten.validierung":
      "Eingereichtes Wissen fachlich prüfen, bevor es als geprüft gilt.",
    "erstnutzer.faehigkeiten.konflikte":
      "Einträge, die sich widersprechen, nebeneinander sehen und entscheiden.",
    "erstnutzer.faehigkeiten.duplikate":
      "Überschneidungen zwischen Beiträgen sehen und festhalten, ob sie verwandt, getrennt oder ein Fehlalarm sind.",
    "erstnutzer.faehigkeiten.lebenszyklus":
      "Wissen, das eine Auffrischung braucht oder dessen Umfeld sich geändert hat, erneut prüfen.",
    "erstnutzer.faehigkeiten.fragen":
      "Eine Frage stellen: die Antwort stützt sich nur auf euer eigenes Wissen und nennt ihre Quellen. Fehlt Wissen, steht das da.",
    "erstnutzer.faehigkeiten.fragenOhneModell":
      "Eine Frage stellen — Antworten gibt es erst, wenn ein KI-Modell nutzbar ist. Bis dahin findest du Wissen in der Bibliothek.",
    "erstnutzer.faehigkeiten.fragenAbgeschaltet":
      "Eine Frage stellen — die KI-Antwort ist derzeit von der Verwaltung abgeschaltet. Wissen findest du in der Bibliothek.",
    "erstnutzer.faehigkeiten.fragenUnbekannt":
      "Eine Frage stellen — ob gerade Antworten möglich sind, ist im Moment nicht bekannt. Wissen findest du in der Bibliothek.",
    "erstnutzer.faehigkeiten.bibliothek":
      "Den ganzen Bestand durchsuchen und jeden Eintrag mit Prüfstand und Herkunft lesen.",
    "erstnutzer.faehigkeiten.wissensnetz":
      "Ein Thema wählen und sehen, welche Einträge dazugehören.",
    "erstnutzer.faehigkeiten.hilfe":
      "Jede Seite erklärt sich im Zahnrad unter „{{seitenhilfe}}“. Den ersten Weg Schritt für Schritt zeigt die Hilfe.",
    "erstnutzer.faehigkeiten.zurHilfe": "Zur Hilfe",
  },
  en: {
    "erstnutzer.palette.anderesWort": "Try a different page name.",
    "erstnutzer.palette.alsFrage": "Ask the knowledge base: “{{q}}”",
    "erstnutzer.hilfe.anderesWort": "Try a shorter or different keyword.",
    "erstnutzer.hilfe.alsFrage": "Ask the knowledge base: “{{q}}”",
    "erstnutzer.faehigkeiten.titel": "What KLARWERK can do",
    "erstnutzer.faehigkeiten.einleitung":
      "One cycle in three steps: capture knowledge, check it, find it again. Areas your role can open are linked directly; the others are listed here for information.",
    "erstnutzer.faehigkeiten.schritt.erfassen": "1 · Capture",
    "erstnutzer.faehigkeiten.schritt.pruefen": "2 · Check",
    "erstnutzer.faehigkeiten.schritt.finden": "3 · Find and use",
    "erstnutzer.faehigkeiten.erfassen":
      "Write down what you have learned on the job, save it as a draft and submit it for review.",
    "erstnutzer.faehigkeiten.validierung":
      "Review submitted knowledge on its merits before it counts as checked.",
    "erstnutzer.faehigkeiten.konflikte":
      "See entries that contradict each other side by side and decide.",
    "erstnutzer.faehigkeiten.duplikate":
      "See overlaps between contributions and record whether they are related, separate or a false alarm.",
    "erstnutzer.faehigkeiten.lebenszyklus":
      "Review knowledge again that needs a refresh or whose surroundings have changed.",
    "erstnutzer.faehigkeiten.fragen":
      "Ask a question: the answer relies only on your own knowledge and names its sources. If knowledge is missing, it says so.",
    "erstnutzer.faehigkeiten.fragenOhneModell":
      "Ask a question — answers are only available once an AI model can be used. Until then, find knowledge in the library.",
    "erstnutzer.faehigkeiten.fragenAbgeschaltet":
      "Ask a question — AI answers are currently switched off by the administration. Find knowledge in the library.",
    "erstnutzer.faehigkeiten.fragenUnbekannt":
      "Ask a question — whether answers are possible right now is not known at the moment. Find knowledge in the library.",
    "erstnutzer.faehigkeiten.bibliothek":
      "Search the whole stock and read every entry with its review status and origin.",
    "erstnutzer.faehigkeiten.wissensnetz": "Pick a topic and see which entries belong to it.",
    "erstnutzer.faehigkeiten.hilfe":
      "Every page explains itself in the gear menu under “{{seitenhilfe}}”. Help shows the first path step by step.",
    "erstnutzer.faehigkeiten.zurHilfe": "Go to Help",
  },
  nl: {
    "erstnutzer.palette.anderesWort": "Probeer een andere paginanaam.",
    "erstnutzer.palette.alsFrage": "„{{q}}” aan de kennis vragen",
    "erstnutzer.hilfe.anderesWort": "Probeer een korter of ander trefwoord.",
    "erstnutzer.hilfe.alsFrage": "„{{q}}” als vraag aan de kennis stellen",
    "erstnutzer.faehigkeiten.titel": "Wat KLARWERK kan",
    "erstnutzer.faehigkeiten.einleitung":
      "Eén kringloop in drie stappen: kennis vastleggen, controleren, terugvinden. Onderdelen die je met jouw rol kunt openen, zijn direct gelinkt; de overige staan hier ter informatie.",
    "erstnutzer.faehigkeiten.schritt.erfassen": "1 · Vastleggen",
    "erstnutzer.faehigkeiten.schritt.pruefen": "2 · Controleren",
    "erstnutzer.faehigkeiten.schritt.finden": "3 · Vinden en gebruiken",
    "erstnutzer.faehigkeiten.erfassen":
      "Opschrijven wat je in het bedrijf hebt geleerd, als concept opslaan en ter beoordeling indienen.",
    "erstnutzer.faehigkeiten.validierung":
      "Ingediende kennis inhoudelijk beoordelen voordat ze als gecontroleerd geldt.",
    "erstnutzer.faehigkeiten.konflikte":
      "Items die elkaar tegenspreken naast elkaar zien en beslissen.",
    "erstnutzer.faehigkeiten.duplikate":
      "Overlappingen tussen bijdragen zien en vastleggen of ze verwant, gescheiden of een vals alarm zijn.",
    "erstnutzer.faehigkeiten.lebenszyklus":
      "Kennis die een opfrissing nodig heeft of waarvan de omgeving is veranderd opnieuw beoordelen.",
    "erstnutzer.faehigkeiten.fragen":
      "Een vraag stellen: het antwoord steunt alleen op jullie eigen kennis en noemt zijn bronnen. Ontbreekt kennis, dan staat dat er.",
    "erstnutzer.faehigkeiten.fragenOhneModell":
      "Een vraag stellen — antwoorden zijn er pas als een AI-model bruikbaar is. Tot dan vind je kennis in de bibliotheek.",
    "erstnutzer.faehigkeiten.fragenAbgeschaltet":
      "Een vraag stellen — AI-antwoorden zijn momenteel door de beheerder uitgeschakeld. Kennis vind je in de bibliotheek.",
    "erstnutzer.faehigkeiten.fragenUnbekannt":
      "Een vraag stellen — of er nu antwoorden mogelijk zijn, is op dit moment niet bekend. Kennis vind je in de bibliotheek.",
    "erstnutzer.faehigkeiten.bibliothek":
      "De hele voorraad doorzoeken en elk item met beoordelingsstatus en herkomst lezen.",
    "erstnutzer.faehigkeiten.wissensnetz": "Een thema kiezen en zien welke items erbij horen.",
    "erstnutzer.faehigkeiten.hilfe":
      "Elke pagina legt zichzelf uit in het tandwielmenu onder „{{seitenhilfe}}”. De eerste weg stap voor stap staat in Help.",
    "erstnutzer.faehigkeiten.zurHilfe": "Naar Help",
  },
} satisfies Textmodul;
