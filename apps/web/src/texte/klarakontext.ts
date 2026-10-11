// ================================================================================================
// KLARA 03 (Auftrag produkt:20261007:klara-kontext-tutorial) — Seitenkontext, Bezug, Quellen.
// ================================================================================================
//
// produkt:20261010:assistenz-name-avatar: `{{assistenz}}` statt eines festen Namens (`useAssistenzT`).
// Die Texte zu Klaras Bezug (Seite, Markierung, frei), zur Herkunft einer Markierung mit Fassung und
// Prüfstatus, zu den Quellen einer Antwort und zur fehlenden Grundlage. Die Frage-Rahmen
// (`klarakontext.frage.*`) gehen wörtlich an den Frageweg: sie bestehen NUR aus Stoppwörtern und dem
// deklarierten Fragegerüst des Fragewegs (`services/reasoner/src/provider.ts`, R-0473) — ein anderes
// Wort würde an die Quelle gebunden und machte jede Markierungsfrage zur Wissenslücke. Der Frageweg
// kennt keine niederländischen Stoppwörter; die niederländische Oberfläche benutzt deshalb die
// englischen Rahmen (die Antwort kommt trotzdem auf Niederländisch, die Sprache reist getrennt mit).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "klarakontext.",
  legacySchluessel: [],
  de: {
    "klarakontext.seite.wissen": "Wissen",
    "klarakontext.objekt.wissenLaedt": "Beitrag wird geladen …",
    "klarakontext.ort.fassung": "Fassung",
    "klarakontext.ort.pruefstatus": "Prüfstatus",
    "klarakontext.ort.modus": "Modus",
    "klarakontext.modus.lesen": "Lesen",
    "klarakontext.modus.bearbeiten": "Bearbeiten",
    "klarakontext.fassung": "Fassung {{nr}}",
    "klarakontext.pruefstatus.geprueft": "geprüft",
    "klarakontext.pruefstatus.ungeprueft": "ungeprüft",
    "klarakontext.lesart.uebersetzung": "aus der Leseübersetzung",
    "klarakontext.bezug.label": "Bezug",
    "klarakontext.bezug.artikel": "Dieser Artikel",
    "klarakontext.bezug.entwurf": "Dieser Entwurf",
    "klarakontext.bezug.frage": "Diese Frage",
    "klarakontext.bezug.frageZumBeitrag": "Diese Frage zum Beitrag",
    "klarakontext.bezug.seite": "Diese Seite",
    "klarakontext.bezug.frei": "Freies Gespräch – ohne Seite und Markierung",
    "klarakontext.bezug.markierterAbsatz": "markierter Absatz",
    "klarakontext.bezug.markierung": "Markierung",
    "klarakontext.bezug.markierungAus": "Markierung aus {{objekt}}",
    "klarakontext.bezug.gewechselt": "Bezug: {{bezug}}",
    "klarakontext.bezug.knopf.seite": "Seite",
    "klarakontext.bezug.knopf.markierung": "Markierung",
    "klarakontext.bezug.knopf.frei": "Frei",
    "klarakontext.aktionen.label": "Hier möglich:",
    "klarakontext.aktionen.fragen": "Fragen",
    "klarakontext.aktionen.erklaeren": "Erklären",
    "klarakontext.aktionen.zusammenfassen": "Zusammenfassen",
    "klarakontext.aktionen.uebersetzen": "Übersetzen",
    "klarakontext.aktionen.tutorial": "Tutorial begleiten",
    "klarakontext.aktionen.bearbeiten":
      "Bearbeiten auf der Seite ({{assistenz}} ändert nichts selbst)",
    "klarakontext.aktionen.keine": "noch nichts – erst einwilligen",
    "klarakontext.aktion.uebersetzen": "Übersetzen",
    "klarakontext.auswahl.hinweis":
      "Mit „Erklären“, „Zusammenfassen“ oder einer Frage mit Bezug „Markierung“ geht dieser markierte Text als Zitat an den Frageweg. Anweisungen darin führt {{assistenz}} nicht aus.",
    "klarakontext.frage.erklaeren": "Was gilt für „{{auswahl}}“?",
    "klarakontext.frage.zusammenfassen": "Was steht zu „{{auswahl}}“?",
    "klarakontext.frage.mitMarkierung": "{{frage}} – „{{auswahl}}“",
    "klarakontext.gesperrt.keinZugriff":
      "Diese Markierung geht nicht an den Frageweg: Du hast auf ihre Herkunft keinen Zugriff (mehr).",
    "klarakontext.gesperrt.vertraulich":
      "Diese Markierung geht nicht an den Frageweg: Sie stammt aus einem vertraulichen Beitrag.",
    "klarakontext.gesperrt.nichtImText":
      "Diese Markierung geht nicht an den Frageweg: Ihr Wortlaut steht in der aktuellen Fassung {{aktuell}} nicht mehr. Markiere die Stelle bitte neu.",
    "klarakontext.gesperrt.fehler":
      "Die Herkunft der Markierung konnte nicht geprüft werden (Status {{status}}). Ohne Prüfung geht sie nicht an den Frageweg.",
    "klarakontext.grundlage.markierung":
      "Zu dieser Markierung aus {{objekt}} gibt es kein geprüftes Wissen, das du lesen darfst.",
    "klarakontext.grundlage.artikel":
      "Zu dieser Frage gibt es in {{objekt}} kein geprüftes Wissen, das du lesen darfst.",
    "klarakontext.grundlage.verschlossen":
      "Passende Inhalte gibt es ({{anzahl}}), sie sind aber noch nicht geprüft oder freigegeben – {{assistenz}} antwortet nur aus geprüftem Wissen.",
    "klarakontext.grundlage.weiter":
      "Formuliere die Frage anders, wähle den Bezug „Frei“ oder melde die Lücke über die Seite „Fragen“.",
    "klarakontext.grundlage.kennzeichen": "Keine Grundlage",
    "klarakontext.verlauf.frei": "frei",
    "klarakontext.verlauf.markierung": "zur Markierung",
    "klarakontext.verlauf.markierungAbsatz": "zur Markierung · Absatz {{nr}}",
    "klarakontext.quelle.ohneTitel": "Quelle",
    "klarakontext.quelle.fassungUnbekannt": "Fassung unbekannt",
    "klarakontext.quelle.geprueft.ja": "geprüft",
    "klarakontext.quelle.geprueft.nein": "ungeprüft",
    "klarakontext.quelle.geprueft.unbekannt": "Prüfstatus unbekannt",
    "klarakontext.quelle.ohneAngaben": "Fassung und Prüfstatus hat der Frageweg nicht genannt",
    "klarakontext.sprache.de": "Deutsch",
    "klarakontext.sprache.en": "Englisch",
    "klarakontext.sprache.nl": "Niederländisch",
    "klarakontext.uebersetzen.zielsprache": "Zielsprache",
    "klarakontext.uebersetzen.bitte": "Übersetzen nach {{sprache}}: „{{auszug}}“",
    "klarakontext.uebersetzen.ohneQuelle":
      "Für diese Markierung gibt es keine hinterlegte Übersetzung nach {{sprache}}: Sie stammt aus keinem Wissensbeitrag. {{assistenz}} übersetzt nicht frei.",
    "klarakontext.uebersetzen.keine":
      "Für {{titel}} liegt keine Übersetzung nach {{sprache}} vor. {{assistenz}} übersetzt nicht frei – dafür fehlt die Grundlage.",
    "klarakontext.uebersetzen.lesevariante":
      "Leseübersetzung ({{sprache}}) von „{{titel}}“: {{aussage}} (Herkunft: {{herkunft}})",
    "klarakontext.uebersetzen.originalGeaendert":
      "Achtung: Das Original wurde nach dieser Übersetzung geändert.",
    "klarakontext.uebersetzen.unbestaetigt": "Die Zuordnung zum Original ist nicht belegt.",
    "klarakontext.uebersetzen.ganzerBeitrag":
      "Die Übersetzung gilt für den ganzen Beitrag, nicht nur für die Markierung; die Wahrheit bleibt das Original.",
    "klarakontext.vorgemerkt.titel": "Zuletzt auf der Seite markiert",
    "klarakontext.vorgemerkt.uebernehmen": "Markierung übernehmen",
    "klarakontext.vorgemerkt.verwerfen": "Verwerfen",
    "klarakontext.tutorial.wiederhergestellt":
      "Die Ansicht wurde neu aufgebaut – {{assistenz}} hat das Tutorial wieder bei Schritt {{nr}} „{{titel}}“ geöffnet.",
    "klarakontext.bedienhilfe.bezug":
      "Bezug wählen: „Seite“ fragt zum Objekt der Seite (z. B. „Dieser Artikel“), „Markierung“ zum markierten Text, „Frei“ ohne beides.",
    "klarakontext.bedienhilfe.markierung":
      "Text markieren → „{{assistenz}} fragen“. Die Markierung behält Herkunft, Fassung und Absatz – auch wenn du die Seite wechselst.",
    "klarakontext.bedienhilfe.quellen":
      "Jede Antwort nennt ihre Quellen mit Fassung und Prüfstatus. Fehlt geprüftes Wissen, sagt {{assistenz}} das und erfindet nichts.",
    "klarakontext.bedienhilfe.uebersetzen":
      "„Übersetzen“ zeigt die vorhandene Leseübersetzung des Beitrags. Gibt es keine, sagt {{assistenz}} das.",
    "klarakontext.bedienhilfe.tutorial":
      "Auf „Fragen“: „Begleite die Durchführung“ zeigt den echten Schritt. Eine Zwischenfrage pausiert ihn; „Fortsetzen“, „Zurück“ und „Weiter“ bleiben am Tutorial.",
  },
  en: {
    "klarakontext.seite.wissen": "Knowledge",
    "klarakontext.objekt.wissenLaedt": "Loading the entry …",
    "klarakontext.ort.fassung": "Version",
    "klarakontext.ort.pruefstatus": "Review status",
    "klarakontext.ort.modus": "Mode",
    "klarakontext.modus.lesen": "Reading",
    "klarakontext.modus.bearbeiten": "Editing",
    "klarakontext.fassung": "Version {{nr}}",
    "klarakontext.pruefstatus.geprueft": "verified",
    "klarakontext.pruefstatus.ungeprueft": "not verified",
    "klarakontext.lesart.uebersetzung": "from the reading translation",
    "klarakontext.bezug.label": "Reference",
    "klarakontext.bezug.artikel": "This article",
    "klarakontext.bezug.entwurf": "This draft",
    "klarakontext.bezug.frage": "This question",
    "klarakontext.bezug.frageZumBeitrag": "This question about the entry",
    "klarakontext.bezug.seite": "This page",
    "klarakontext.bezug.frei": "Free conversation – without page or selection",
    "klarakontext.bezug.markierterAbsatz": "selected paragraph",
    "klarakontext.bezug.markierung": "selection",
    "klarakontext.bezug.markierungAus": "Selection from {{objekt}}",
    "klarakontext.bezug.gewechselt": "Reference: {{bezug}}",
    "klarakontext.bezug.knopf.seite": "Page",
    "klarakontext.bezug.knopf.markierung": "Selection",
    "klarakontext.bezug.knopf.frei": "Free",
    "klarakontext.aktionen.label": "Possible here:",
    "klarakontext.aktionen.fragen": "Ask",
    "klarakontext.aktionen.erklaeren": "Explain",
    "klarakontext.aktionen.zusammenfassen": "Summarise",
    "klarakontext.aktionen.uebersetzen": "Translate",
    "klarakontext.aktionen.tutorial": "Accompany the tutorial",
    "klarakontext.aktionen.bearbeiten": "Edit on the page ({{assistenz}} changes nothing itself)",
    "klarakontext.aktionen.keine": "nothing yet – give consent first",
    "klarakontext.aktion.uebersetzen": "Translate",
    "klarakontext.auswahl.hinweis":
      "With “Explain”, “Summarise” or a question with the reference “Selection”, this selected text goes to the question path as a quotation. {{assistenz}} does not carry out instructions it contains.",
    "klarakontext.frage.erklaeren": "What is “{{auswahl}}”?",
    "klarakontext.frage.zusammenfassen": "What is there about “{{auswahl}}”?",
    "klarakontext.frage.mitMarkierung": "{{frage}} – “{{auswahl}}”",
    "klarakontext.gesperrt.keinZugriff":
      "This selection is not sent to the question path: you have no (longer any) access to its origin.",
    "klarakontext.gesperrt.vertraulich":
      "This selection is not sent to the question path: it comes from a confidential entry.",
    "klarakontext.gesperrt.nichtImText":
      "This selection is not sent to the question path: its wording is no longer in the current version {{aktuell}}. Please select the passage again.",
    "klarakontext.gesperrt.fehler":
      "The origin of the selection could not be checked (status {{status}}). Without a check it is not sent to the question path.",
    "klarakontext.grundlage.markierung":
      "There is no verified knowledge you may read about this selection from {{objekt}}.",
    "klarakontext.grundlage.artikel":
      "There is no verified knowledge you may read about this question in {{objekt}}.",
    "klarakontext.grundlage.verschlossen":
      "Matching content exists ({{anzahl}}) but is not yet verified or approved – {{assistenz}} only answers from verified knowledge.",
    "klarakontext.grundlage.weiter":
      "Rephrase the question, choose the reference “Free” or report the gap on the “Ask” page.",
    "klarakontext.grundlage.kennzeichen": "No basis",
    "klarakontext.verlauf.frei": "free",
    "klarakontext.verlauf.markierung": "about the selection",
    "klarakontext.verlauf.markierungAbsatz": "about the selection · paragraph {{nr}}",
    "klarakontext.quelle.ohneTitel": "Source",
    "klarakontext.quelle.fassungUnbekannt": "version unknown",
    "klarakontext.quelle.geprueft.ja": "verified",
    "klarakontext.quelle.geprueft.nein": "not verified",
    "klarakontext.quelle.geprueft.unbekannt": "review status unknown",
    "klarakontext.quelle.ohneAngaben": "the question path did not state version and review status",
    "klarakontext.sprache.de": "German",
    "klarakontext.sprache.en": "English",
    "klarakontext.sprache.nl": "Dutch",
    "klarakontext.uebersetzen.zielsprache": "Target language",
    "klarakontext.uebersetzen.bitte": "Translate into {{sprache}}: “{{auszug}}”",
    "klarakontext.uebersetzen.ohneQuelle":
      "There is no stored translation into {{sprache}} for this selection: it does not come from a knowledge entry. {{assistenz}} does not translate freely.",
    "klarakontext.uebersetzen.keine":
      "There is no translation of {{titel}} into {{sprache}}. {{assistenz}} does not translate freely – the basis for it is missing.",
    "klarakontext.uebersetzen.lesevariante":
      "Reading translation ({{sprache}}) of “{{titel}}”: {{aussage}} (origin: {{herkunft}})",
    "klarakontext.uebersetzen.originalGeaendert":
      "Note: the original was changed after this translation.",
    "klarakontext.uebersetzen.unbestaetigt": "The link to the original is not confirmed.",
    "klarakontext.uebersetzen.ganzerBeitrag":
      "The translation covers the whole entry, not only the selection; the original remains authoritative.",
    "klarakontext.vorgemerkt.titel": "Last selected on the page",
    "klarakontext.vorgemerkt.uebernehmen": "Use selection",
    "klarakontext.vorgemerkt.verwerfen": "Discard",
    "klarakontext.tutorial.wiederhergestellt":
      "The view was rebuilt – {{assistenz}} reopened the tutorial at step {{nr}} “{{titel}}”.",
    "klarakontext.bedienhilfe.bezug":
      "Choose the reference: “Page” asks about the page's object (e.g. “This article”), “Selection” about the selected text, “Free” about neither.",
    "klarakontext.bedienhilfe.markierung":
      "Select text → “Ask {{assistenz}}”. The selection keeps its origin, version and paragraph – even when you change the page.",
    "klarakontext.bedienhilfe.quellen":
      "Every answer names its sources with version and review status. If verified knowledge is missing, {{assistenz}} says so and invents nothing.",
    "klarakontext.bedienhilfe.uebersetzen":
      "“Translate” shows the existing reading translation of the entry. If there is none, {{assistenz}} says so.",
    "klarakontext.bedienhilfe.tutorial":
      "On “Ask”: “Accompany the walkthrough” shows the real step. An interim question pauses it; “Continue”, “Back” and “Next” stay with the tutorial.",
  },
  nl: {
    "klarakontext.seite.wissen": "Kennis",
    "klarakontext.objekt.wissenLaedt": "Bijdrage wordt geladen …",
    "klarakontext.ort.fassung": "Versie",
    "klarakontext.ort.pruefstatus": "Controlestatus",
    "klarakontext.ort.modus": "Modus",
    "klarakontext.modus.lesen": "Lezen",
    "klarakontext.modus.bearbeiten": "Bewerken",
    "klarakontext.fassung": "Versie {{nr}}",
    "klarakontext.pruefstatus.geprueft": "gecontroleerd",
    "klarakontext.pruefstatus.ungeprueft": "niet gecontroleerd",
    "klarakontext.lesart.uebersetzung": "uit de leesvertaling",
    "klarakontext.bezug.label": "Verwijzing",
    "klarakontext.bezug.artikel": "Dit artikel",
    "klarakontext.bezug.entwurf": "Dit concept",
    "klarakontext.bezug.frage": "Deze vraag",
    "klarakontext.bezug.frageZumBeitrag": "Deze vraag over de bijdrage",
    "klarakontext.bezug.seite": "Deze pagina",
    "klarakontext.bezug.frei": "Vrij gesprek – zonder pagina en markering",
    "klarakontext.bezug.markierterAbsatz": "gemarkeerde alinea",
    "klarakontext.bezug.markierung": "markering",
    "klarakontext.bezug.markierungAus": "Markering uit {{objekt}}",
    "klarakontext.bezug.gewechselt": "Verwijzing: {{bezug}}",
    "klarakontext.bezug.knopf.seite": "Pagina",
    "klarakontext.bezug.knopf.markierung": "Markering",
    "klarakontext.bezug.knopf.frei": "Vrij",
    "klarakontext.aktionen.label": "Hier mogelijk:",
    "klarakontext.aktionen.fragen": "Vragen",
    "klarakontext.aktionen.erklaeren": "Uitleggen",
    "klarakontext.aktionen.zusammenfassen": "Samenvatten",
    "klarakontext.aktionen.uebersetzen": "Vertalen",
    "klarakontext.aktionen.tutorial": "Tutorial begeleiden",
    "klarakontext.aktionen.bearbeiten": "Bewerken op de pagina ({{assistenz}} wijzigt zelf niets)",
    "klarakontext.aktionen.keine": "nog niets – geef eerst toestemming",
    "klarakontext.aktion.uebersetzen": "Vertalen",
    "klarakontext.auswahl.hinweis":
      "Met „Uitleggen”, „Samenvatten” of een vraag met verwijzing „Markering” gaat deze gemarkeerde tekst als citaat naar de vraagroute. Instructies daarin voert {{assistenz}} niet uit.",
    // Engelse kaders met opzet: de vraagroute kent geen Nederlandse stopwoorden (zie kop).
    "klarakontext.frage.erklaeren": "What is “{{auswahl}}”?",
    "klarakontext.frage.zusammenfassen": "What is there about “{{auswahl}}”?",
    "klarakontext.frage.mitMarkierung": "{{frage}} – “{{auswahl}}”",
    "klarakontext.gesperrt.keinZugriff":
      "Deze markering gaat niet naar de vraagroute: je hebt (niet langer) toegang tot de herkomst.",
    "klarakontext.gesperrt.vertraulich":
      "Deze markering gaat niet naar de vraagroute: ze komt uit een vertrouwelijke bijdrage.",
    "klarakontext.gesperrt.nichtImText":
      "Deze markering gaat niet naar de vraagroute: de tekst staat niet meer in de huidige versie {{aktuell}}. Markeer de passage opnieuw.",
    "klarakontext.gesperrt.fehler":
      "De herkomst van de markering kon niet worden gecontroleerd (status {{status}}). Zonder controle gaat ze niet naar de vraagroute.",
    "klarakontext.grundlage.markierung":
      "Over deze markering uit {{objekt}} is er geen gecontroleerde kennis die je mag lezen.",
    "klarakontext.grundlage.artikel":
      "Over deze vraag is er in {{objekt}} geen gecontroleerde kennis die je mag lezen.",
    "klarakontext.grundlage.verschlossen":
      "Er is passende inhoud ({{anzahl}}), maar die is nog niet gecontroleerd of vrijgegeven – {{assistenz}} antwoordt alleen uit gecontroleerde kennis.",
    "klarakontext.grundlage.weiter":
      "Formuleer de vraag anders, kies de verwijzing „Vrij” of meld de lacune via de pagina „Vragen”.",
    "klarakontext.grundlage.kennzeichen": "Geen basis",
    "klarakontext.verlauf.frei": "vrij",
    "klarakontext.verlauf.markierung": "over de markering",
    "klarakontext.verlauf.markierungAbsatz": "over de markering · alinea {{nr}}",
    "klarakontext.quelle.ohneTitel": "Bron",
    "klarakontext.quelle.fassungUnbekannt": "versie onbekend",
    "klarakontext.quelle.geprueft.ja": "gecontroleerd",
    "klarakontext.quelle.geprueft.nein": "niet gecontroleerd",
    "klarakontext.quelle.geprueft.unbekannt": "controlestatus onbekend",
    "klarakontext.quelle.ohneAngaben": "versie en controlestatus heeft de vraagroute niet genoemd",
    "klarakontext.sprache.de": "Duits",
    "klarakontext.sprache.en": "Engels",
    "klarakontext.sprache.nl": "Nederlands",
    "klarakontext.uebersetzen.zielsprache": "Doeltaal",
    "klarakontext.uebersetzen.bitte": "Vertalen naar het {{sprache}}: „{{auszug}}”",
    "klarakontext.uebersetzen.ohneQuelle":
      "Voor deze markering is er geen opgeslagen vertaling naar het {{sprache}}: ze komt niet uit een kennisbijdrage. {{assistenz}} vertaalt niet vrij.",
    "klarakontext.uebersetzen.keine":
      "Voor {{titel}} is er geen vertaling naar het {{sprache}}. {{assistenz}} vertaalt niet vrij – daarvoor ontbreekt de basis.",
    "klarakontext.uebersetzen.lesevariante":
      "Leesvertaling ({{sprache}}) van „{{titel}}”: {{aussage}} (herkomst: {{herkunft}})",
    "klarakontext.uebersetzen.originalGeaendert":
      "Let op: het origineel is na deze vertaling gewijzigd.",
    "klarakontext.uebersetzen.unbestaetigt": "De koppeling aan het origineel is niet bevestigd.",
    "klarakontext.uebersetzen.ganzerBeitrag":
      "De vertaling geldt voor de hele bijdrage, niet alleen voor de markering; het origineel blijft leidend.",
    "klarakontext.vorgemerkt.titel": "Laatst gemarkeerd op de pagina",
    "klarakontext.vorgemerkt.uebernehmen": "Markering overnemen",
    "klarakontext.vorgemerkt.verwerfen": "Verwerpen",
    "klarakontext.tutorial.wiederhergestellt":
      "De weergave is opnieuw opgebouwd – {{assistenz}} heeft de tutorial weer bij stap {{nr}} „{{titel}}” geopend.",
    "klarakontext.bedienhilfe.bezug":
      "Verwijzing kiezen: „Pagina” vraagt over het object van de pagina (bijv. „Dit artikel”), „Markering” over de gemarkeerde tekst, „Vrij” zonder beide.",
    "klarakontext.bedienhilfe.markierung":
      "Tekst markeren → „{{assistenz}} vragen”. De markering houdt herkomst, versie en alinea – ook als je van pagina wisselt.",
    "klarakontext.bedienhilfe.quellen":
      "Elk antwoord noemt zijn bronnen met versie en controlestatus. Ontbreekt gecontroleerde kennis, dan zegt {{assistenz}} dat en verzint niets.",
    "klarakontext.bedienhilfe.uebersetzen":
      "„Vertalen” toont de bestaande leesvertaling van de bijdrage. Is er geen, dan zegt {{assistenz}} dat.",
    "klarakontext.bedienhilfe.tutorial":
      "Op „Vragen”: „Begeleid de uitvoering” toont de echte stap. Een tussenvraag pauzeert die; „Doorgaan”, „Terug” en „Verder” blijven bij de tutorial.",
  },
} satisfies Textmodul;
