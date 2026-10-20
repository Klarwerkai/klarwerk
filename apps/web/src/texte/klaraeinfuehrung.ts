import type { Textmodul } from "./intern/pruefung";
export default {
  praefix: "klaraeinfuehrung.",
  legacySchluessel: [],
  de: {
    "klaraeinfuehrung.zeitLuecke":
      "Diese Ortszeit fehlt beim Sommerzeitwechsel. Wähle eine eindeutige Uhrzeit; deine Eingabe bleibt erhalten.",
    "klaraeinfuehrung.zeitDoppelt":
      "Diese Ortszeit kommt beim Sommerzeitwechsel zweimal vor. Wähle eine eindeutige Uhrzeit oder nutze die explizite Sommerzeitwahl der Erinnerung.",
    "klaraeinfuehrung.titel": "Persönliche Einführung und Übungen",
    "klaraeinfuehrung.intro":
      "Richte Klara freiwillig an deiner eigenen Arbeit aus. Alle Schritte bleiben erneut aufrufbar.",
    "klaraeinfuehrung.warnung":
      "Rechte, Quellen- und Prüfstatus sowie Termin- und Ausführungswarnungen gelten immer. Eine Übung erteilt keine Freigabe und ändert keine echten Arbeitsdaten.",
    "klaraeinfuehrung.hut": "Avatar mit Zauberhut",
    "klaraeinfuehrung.erneut": "Einführung erneut öffnen",
    "klaraeinfuehrung.fortsetzen": "Einführung starten oder fortsetzen",
    "klaraeinfuehrung.gespeichert": "Einrichtungsstand für dein Konto gespeichert.",
    "klaraeinfuehrung.fehler":
      "Speicherstand unklar oder inzwischen geändert. Deine Auswahl bleibt hier; lade den Profilstand neu, bevor du erneut speicherst. Normale Arbeit bleibt möglich.",
    "klaraeinfuehrung.schritt": "Schritt {{nr}} von 4 · {{titel}}",
    "klaraeinfuehrung.gestalten": "Name und Erscheinung",
    "klaraeinfuehrung.gestaltenKurz":
      "Nutze das vorhandene Formular „Name und Erscheinung“ auf dieser Seite.",
    "klaraeinfuehrung.gestaltenLang":
      "Dein Name und Motiv gelten für dein Konto. Die Einführung verwendet dieselbe gespeicherte Auswahl. Du kannst diesen Schritt auch ohne Änderung überspringen.",
    "klaraeinfuehrung.formular": "Vorhandenes Namensformular zeigen",
    "klaraeinfuehrung.arbeitsweise": "Begleitung und Zeitzone",
    "klaraeinfuehrung.arbeitsweiseKurz":
      "Wähle die Erklärungslänge und die Zeitzone für neue persönliche Zeitangaben.",
    "klaraeinfuehrung.arbeitsweiseLang":
      "Beispiel an deinem aktuellen Ort: Eine persönliche Vorliebe kannst du unter „Mein persönliches Gedächtnis“ ändern oder löschen. Die kurze Ansicht klappt Antworten ein; ihr vollständiger Inhalt und alle Quellen bleiben erreichbar. Hinweise lassen sich in „Unterstützung“ abschalten.",
    "klaraeinfuehrung.begleitung": "Erklärungslänge",
    "klaraeinfuehrung.kurz": "Kurz",
    "klaraeinfuehrung.ausfuehrlich": "Ausführlich",
    "klaraeinfuehrung.zone": "Persönliche IANA-Zeitzone",
    "klaraeinfuehrung.dst":
      "Sommerzeitwechsel kann dieselbe Ortszeit zweimal ergeben. Bestehende Termine behalten ihre eigene Zone und Regel.",
    "klaraeinfuehrung.hinweise": "Optionale Hinweise unter Unterstützung einstellen",
    "klaraeinfuehrung.uebung": "Übung: Quelle und Präferenz unterscheiden",
    "klaraeinfuehrung.uebungKurz":
      "Suche eine zugängliche Wissensquelle und beantworte eine Verständnisfrage.",
    "klaraeinfuehrung.uebungLang":
      "Der vorhandene Tutorialbereich führt diese Leseübung aus. Suche und Antwort erzeugen weder einen Beitrag noch eine fachliche Freigabe. Ohne passende Quelle kannst du weitergehen und später wieder üben.",
    "klaraeinfuehrung.lernziel":
      "Einen aktuellen Quellenstand lesen und von einer persönlichen Darstellungsvorliebe unterscheiden.",
    "klaraeinfuehrung.uebungText":
      "Wähle eine Quelle über die bestehende Bibliothekssuche. Die Rückmeldung liest ihre heutige zugängliche Fassung erneut.",
    "klaraeinfuehrung.nurUebung": "Übung · nur lesen, keine echte Änderung",
    "klaraeinfuehrung.suche": "Wissensquelle suchen",
    "klaraeinfuehrung.quelleFehlt":
      "Quelle nicht mehr zugänglich oder nicht bestätigt. Keine Rückmeldung über den alten Stand.",
    "klaraeinfuehrung.keineQuelle":
      "Keine zugängliche Quelle gefunden. Ändere die Suche oder überspringe die Übung.",
    "klaraeinfuehrung.quellenstand": "Fassung {{fassung}} · Prüfstatus {{status}}",
    "klaraeinfuehrung.frage":
      "Ändert deine persönliche Vorliebe für kurze Antworten den Prüfstatus dieser Quelle?",
    "klaraeinfuehrung.ja": "Ja",
    "klaraeinfuehrung.nein": "Nein",
    "klaraeinfuehrung.pruefen": "Verständnis prüfen",
    "klaraeinfuehrung.richtig":
      "Richtig. „{{titel}}“ bleibt in Fassung {{fassung}} mit Prüfstatus {{status}}. Deine Vorliebe ändert nur die Darstellung.",
    "klaraeinfuehrung.nochmal":
      "Die Vorliebe ändert nur die Darstellung. Quelle: „{{titel}}“, Fassung {{fassung}}, Prüfstatus {{status}}. Dieser fachliche Stand bleibt unverändert.",
    "klaraeinfuehrung.ergebnis": "Ergebnis und nächster Schritt",
    "klaraeinfuehrung.ergebnisKurz":
      "Du findest diese Einführung wieder unter Profil → Klara. Jetzt kannst du normal weiterarbeiten.",
    "klaraeinfuehrung.ergebnisLang":
      "Fortsetzung: Öffne denselben Bereich; der zuletzt bestätigte Einrichtungsschritt wird vom Konto geladen. Für den Pilot werden Schritte, Wechsel, doppelte Eingaben, Fehler, Hilfebedarf und Zeiten nach dem Betriebsblatt erfasst. Agentenproben sind keine Messung mit echten Anwendern.",
    "klaraeinfuehrung.office":
      "In Word: Öffne das vorhandene Klara-Add-in und sein Zahnrad. Dort stehen Sprache, „Text in Word mitlesen“ und „Absatzblick“. Native Word-Menüs öffnest du selbst; Klarwerk erkennt diese Menüs nicht automatisch.",
    "klaraeinfuehrung.sprache":
      "„Diktieren“ füllt das Textfeld; gesendet wird erst nach deiner Prüfung. „Auftrag sprechen“ und Ausführung bleiben getrennte Schritte. Der Textweg bleibt verfügbar. Spracherkennung läuft beim Browseranbieter; der konkrete externe Tonempfänger ist hier nicht festgestellt.",
    "klaraeinfuehrung.zurArbeit": "Zur normalen Arbeit",
    "klaraeinfuehrung.zurueck": "Zurück",
    "klaraeinfuehrung.weiter": "Weiter / Schritt überspringen",
    "klaraeinfuehrung.beenden": "Einführung beenden",
    "klaraeinfuehrung.pause": "Unterbrechen und Stand speichern",
  },
  en: {
    "klaraeinfuehrung.zeitLuecke":
      "This local time does not exist during the daylight saving change. Choose an unambiguous time; your input is retained.",
    "klaraeinfuehrung.zeitDoppelt":
      "This local time occurs twice during the daylight saving change. Choose an unambiguous time or use the explicit daylight saving choice in a reminder.",
    "klaraeinfuehrung.titel": "Personal introduction and practice",
    "klaraeinfuehrung.intro":
      "Set up Klara for your own work, whenever you choose. You can reopen every step.",
    "klaraeinfuehrung.warnung":
      "Access, sources, review status, scheduling and execution warnings always apply. Practice grants no permission and changes no real work data.",
    "klaraeinfuehrung.hut": "Avatar with wizard hat",
    "klaraeinfuehrung.erneut": "Reopen introduction",
    "klaraeinfuehrung.fortsetzen": "Start or resume introduction",
    "klaraeinfuehrung.gespeichert": "Setup progress saved for your account.",
    "klaraeinfuehrung.fehler":
      "The save is unconfirmed or the profile has changed. Your choices remain here; reload your profile before saving again. Normal work remains available.",
    "klaraeinfuehrung.schritt": "Step {{nr}} of 4 · {{titel}}",
    "klaraeinfuehrung.gestalten": "Name and appearance",
    "klaraeinfuehrung.gestaltenKurz": "Use the existing “Name and appearance” form on this page.",
    "klaraeinfuehrung.gestaltenLang":
      "Your name and avatar apply to your account. The introduction uses the same saved choice. You can skip this step without making a change.",
    "klaraeinfuehrung.formular": "Show existing name form",
    "klaraeinfuehrung.arbeitsweise": "Guidance and time zone",
    "klaraeinfuehrung.arbeitsweiseKurz":
      "Choose the level of guidance and the time zone for new personal times.",
    "klaraeinfuehrung.arbeitsweiseLang":
      "Example for your current page: edit or delete a preference under “My personal memory”. Brief display collapses answers; their full content and sources remain accessible. Turn optional hints off under “Support”.",
    "klaraeinfuehrung.begleitung": "Level of guidance",
    "klaraeinfuehrung.kurz": "Brief",
    "klaraeinfuehrung.ausfuehrlich": "Detailed",
    "klaraeinfuehrung.zone": "Personal IANA time zone",
    "klaraeinfuehrung.dst":
      "A daylight saving change can repeat a local time. Existing events keep their own time zone and rule.",
    "klaraeinfuehrung.hinweise": "Configure optional hints under Support",
    "klaraeinfuehrung.uebung": "Practice: distinguish a source from a preference",
    "klaraeinfuehrung.uebungKurz":
      "Find an accessible knowledge source and answer a comprehension question.",
    "klaraeinfuehrung.uebungLang":
      "The existing tutorial area runs this reading exercise. Searching and answering create neither a contribution nor a review approval. If no suitable source is available, continue and return later.",
    "klaraeinfuehrung.lernziel":
      "Read a current source version and distinguish it from a personal display preference.",
    "klaraeinfuehrung.uebungText":
      "Select a source using the existing library search. Feedback reads its currently accessible version again.",
    "klaraeinfuehrung.nurUebung": "Practice · read only, no real change",
    "klaraeinfuehrung.suche": "Search for a knowledge source",
    "klaraeinfuehrung.quelleFehlt":
      "The source is inaccessible or unconfirmed. No feedback uses its previous state.",
    "klaraeinfuehrung.keineQuelle":
      "No accessible source found. Change the search or skip practice.",
    "klaraeinfuehrung.quellenstand": "Version {{fassung}} · review status {{status}}",
    "klaraeinfuehrung.frage":
      "Does your personal preference for brief answers change this source’s review status?",
    "klaraeinfuehrung.ja": "Yes",
    "klaraeinfuehrung.nein": "No",
    "klaraeinfuehrung.pruefen": "Check understanding",
    "klaraeinfuehrung.richtig":
      "Correct. “{{titel}}” remains at version {{fassung}} with review status {{status}}. Your preference only changes display.",
    "klaraeinfuehrung.nochmal":
      "The preference only changes display. Source: “{{titel}}”, version {{fassung}}, review status {{status}}. This knowledge state is unchanged.",
    "klaraeinfuehrung.ergebnis": "Result and next step",
    "klaraeinfuehrung.ergebnisKurz":
      "Reopen this introduction under Profile → Klara. You can now continue normal work.",
    "klaraeinfuehrung.ergebnisLang":
      "To resume, reopen this area; your account loads the last confirmed setup step. Pilot steps, app switches, duplicate input, errors, help and timings follow the operations sheet. Agent checks are not real user measurements.",
    "klaraeinfuehrung.office":
      "In Word: open the existing Klara add-in and its settings. Language, “Read text in Word” and “Paragraph view” are there. Open native Word menus yourself; Klarwerk does not detect those menus automatically.",
    "klaraeinfuehrung.sprache":
      "“Dictate” fills the text field; review it before sending. “Speak request” and execution remain separate steps. Text input stays available. Speech recognition runs through the browser provider; the specific external audio recipient has not been established here.",
    "klaraeinfuehrung.zurArbeit": "Continue normal work",
    "klaraeinfuehrung.zurueck": "Back",
    "klaraeinfuehrung.weiter": "Next / skip step",
    "klaraeinfuehrung.beenden": "Finish introduction",
    "klaraeinfuehrung.pause": "Pause and save progress",
  },
  nl: {
    "klaraeinfuehrung.zeitLuecke":
      "Deze lokale tijd bestaat niet tijdens de zomertijdwisseling. Kies een eenduidige tijd; je invoer blijft behouden.",
    "klaraeinfuehrung.zeitDoppelt":
      "Deze lokale tijd komt twee keer voor tijdens de zomertijdwisseling. Kies een eenduidige tijd of gebruik de expliciete zomertijdkeuze van een herinnering.",
    "klaraeinfuehrung.titel": "Persoonlijke introductie en oefeningen",
    "klaraeinfuehrung.intro":
      "Stel Klara vrijwillig in voor je eigen werk. Je kunt elke stap opnieuw openen.",
    "klaraeinfuehrung.warnung":
      "Rechten, bronnen, controlestatus en waarschuwingen over afspraken en uitvoering blijven altijd gelden. Oefenen geeft geen toestemming en wijzigt geen echte werkgegevens.",
    "klaraeinfuehrung.hut": "Avatar met tovenaarshoed",
    "klaraeinfuehrung.erneut": "Introductie opnieuw openen",
    "klaraeinfuehrung.fortsetzen": "Introductie starten of hervatten",
    "klaraeinfuehrung.gespeichert": "Voortgang opgeslagen voor je account.",
    "klaraeinfuehrung.fehler":
      "De opslag is onzeker of het profiel is gewijzigd. Je keuzes blijven hier; laad het profiel opnieuw voordat je weer opslaat. Normaal werken blijft mogelijk.",
    "klaraeinfuehrung.schritt": "Stap {{nr}} van 4 · {{titel}}",
    "klaraeinfuehrung.gestalten": "Naam en uiterlijk",
    "klaraeinfuehrung.gestaltenKurz":
      "Gebruik het bestaande formulier “Naam en uiterlijk” op deze pagina.",
    "klaraeinfuehrung.gestaltenLang":
      "Je naam en avatar gelden voor je account. De introductie gebruikt dezelfde opgeslagen keuze. Je kunt deze stap zonder wijziging overslaan.",
    "klaraeinfuehrung.formular": "Bestaand naamformulier tonen",
    "klaraeinfuehrung.arbeitsweise": "Begeleiding en tijdzone",
    "klaraeinfuehrung.arbeitsweiseKurz":
      "Kies de uitleg en tijdzone voor nieuwe persoonlijke tijdstippen.",
    "klaraeinfuehrung.arbeitsweiseLang":
      "Voorbeeld op deze pagina: wijzig of verwijder een voorkeur onder “Mijn persoonlijke geheugen”. De korte weergave klapt antwoorden in; volledige inhoud en bronnen blijven bereikbaar. Schakel optionele tips uit onder “Ondersteuning”.",
    "klaraeinfuehrung.begleitung": "Lengte van uitleg",
    "klaraeinfuehrung.kurz": "Kort",
    "klaraeinfuehrung.ausfuehrlich": "Uitgebreid",
    "klaraeinfuehrung.zone": "Persoonlijke IANA-tijdzone",
    "klaraeinfuehrung.dst":
      "Door een zomertijdwisseling kan een lokale tijd twee keer voorkomen. Bestaande afspraken behouden hun eigen tijdzone en regel.",
    "klaraeinfuehrung.hinweise": "Optionele tips bij Ondersteuning instellen",
    "klaraeinfuehrung.uebung": "Oefening: bron en voorkeur onderscheiden",
    "klaraeinfuehrung.uebungKurz":
      "Zoek een toegankelijke kennisbron en beantwoord een begripsvraag.",
    "klaraeinfuehrung.uebungLang":
      "Het bestaande tutorialonderdeel verzorgt deze leesoefening. Zoeken en antwoorden maken geen bijdrage of goedkeuring aan. Ga zonder passende bron verder en oefen later opnieuw.",
    "klaraeinfuehrung.lernziel":
      "Lees een actuele bronversie en onderscheid die van een persoonlijke weergavevoorkeur.",
    "klaraeinfuehrung.uebungText":
      "Kies een bron via de bestaande bibliotheekzoekfunctie. De feedback leest de nu toegankelijke versie opnieuw.",
    "klaraeinfuehrung.nurUebung": "Oefening · alleen lezen, geen echte wijziging",
    "klaraeinfuehrung.suche": "Kennisbron zoeken",
    "klaraeinfuehrung.quelleFehlt":
      "De bron is niet toegankelijk of niet bevestigd. Geen feedback over de vorige stand.",
    "klaraeinfuehrung.keineQuelle":
      "Geen toegankelijke bron gevonden. Pas de zoekopdracht aan of sla de oefening over.",
    "klaraeinfuehrung.quellenstand": "Versie {{fassung}} · controlestatus {{status}}",
    "klaraeinfuehrung.frage":
      "Verandert je persoonlijke voorkeur voor korte antwoorden de controlestatus van deze bron?",
    "klaraeinfuehrung.ja": "Ja",
    "klaraeinfuehrung.nein": "Nee",
    "klaraeinfuehrung.pruefen": "Begrip controleren",
    "klaraeinfuehrung.richtig":
      "Goed. “{{titel}}” behoudt versie {{fassung}} met controlestatus {{status}}. Je voorkeur verandert alleen de weergave.",
    "klaraeinfuehrung.nochmal":
      "De voorkeur verandert alleen de weergave. Bron: “{{titel}}”, versie {{fassung}}, controlestatus {{status}}. Deze inhoudelijke stand blijft ongewijzigd.",
    "klaraeinfuehrung.ergebnis": "Resultaat en volgende stap",
    "klaraeinfuehrung.ergebnisKurz":
      "Open deze introductie opnieuw via Profiel → Klara. Je kunt nu normaal verder werken.",
    "klaraeinfuehrung.ergebnisLang":
      "Open dit onderdeel opnieuw om verder te gaan; je account laadt de laatst bevestigde stap. Stappen, appwisselingen, dubbele invoer, fouten, hulp en tijden voor de pilot volgen het bedrijfsblad. Agentproeven zijn geen meting met echte gebruikers.",
    "klaraeinfuehrung.office":
      "In Word: open de bestaande Klara-invoegtoepassing en de instellingen. Daar staan taal, “Tekst in Word meelezen” en “Alineaweergave”. Open de eigen Word-menu’s zelf; Klarwerk herkent die niet automatisch.",
    "klaraeinfuehrung.sprache":
      "“Dicteren” vult het tekstveld; controleer dit voor het verzenden. “Opdracht inspreken” en uitvoering blijven aparte stappen. Tekstinvoer blijft beschikbaar. Spraakherkenning loopt via de browseraanbieder; de concrete externe audio-ontvanger is hier niet vastgesteld.",
    "klaraeinfuehrung.zurArbeit": "Normaal verder werken",
    "klaraeinfuehrung.zurueck": "Terug",
    "klaraeinfuehrung.weiter": "Verder / stap overslaan",
    "klaraeinfuehrung.beenden": "Introductie afronden",
    "klaraeinfuehrung.pause": "Onderbreken en voortgang opslaan",
  },
} satisfies Textmodul;
