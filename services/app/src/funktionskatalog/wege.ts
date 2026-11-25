import type { KatalogKantenstand, KatalogText, KatalogVerbindung, KatalogWeg } from "./vertrag";

function text(de: string, en: string, nl: string): KatalogText {
  return { de, en, nl };
}

function lieferung(version: string, commit: string): KatalogText {
  return text(
    `Produktlieferung ${version} · 24.11.2026 · ${commit}`,
    `Product release ${version} · 24 Nov 2026 · ${commit}`,
    `Productlevering ${version} · 24 nov 2026 · ${commit}`,
  );
}

function anhang(seite: string, eintraege: string): KatalogText {
  return text(
    `Funktionsanhang vom 19.10.2026 · ${seite} · Register ${eintraege}`,
    `Feature appendix, 19 Oct 2026 · ${seite} · register ${eintraege}`,
    `Functiebijlage van 19 okt 2026 · ${seite} · register ${eintraege}`,
  );
}

function test(fundstelle: string): KatalogText {
  return text(
    `Produktprüfung am Stand .1139 · tests/${fundstelle}`,
    `Product test at .1139 · tests/${fundstelle}`,
    `Producttest op versie .1139 · tests/${fundstelle}`,
  );
}

function kalenderVertrag(fundstelle: string): KatalogText {
  return text(
    `Kalender-Vertragstest mit simuliertem Anbieter · .1139 · tests/${fundstelle}`,
    `Calendar contract test with a simulated provider · .1139 · tests/${fundstelle}`,
    `Agendacontracttest met gesimuleerde aanbieder · .1139 · tests/${fundstelle}`,
  );
}

function verbindung(
  von: string,
  nach: string,
  text: KatalogText,
  stand: KatalogKantenstand,
  beleg: KatalogText,
): KatalogVerbindung {
  return { von, nach, text, stand, beleg };
}

const belege = {
  ergebniswissen: text(
    "25.11.2026 · .1148 · Fachliche Freigabe eines Workflow-Ergebnisses",
    "25 November 2026 · .1148 · Review and approval of a workflow result",
    "25 november 2026 · .1148 · Inhoudelijke goedkeuring van een workflowresultaat",
  ),
  teamassistent: text(
    "25.11.2026 · .1146 · Geprüfte Teamfassung mit freigegebenen Quellen",
    "25 November 2026 · .1146 · Tested team version with approved sources",
    "25 november 2026 · .1146 · Geteste teamversie met goedgekeurde bronnen",
  ),
  wissensvorschlag: text(
    "25.11.2026 · .1145 · Einreichung und fachliche Entscheidung",
    "25 November 2026 · .1145 · Submission and review decision",
    "25 november 2026 · .1145 · Indiening en inhoudelijk besluit",
  ),
  teamworkflow: text(
    "25.11.2026 · .1147 · Freigegebene Assistentenfassung im getesteten Teamworkflow",
    "25 November 2026 · .1147 · Published assistant version in a tested team workflow",
    "25 november 2026 · .1147 · Vrijgegeven assistentversie in een geteste teamworkflow",
  ),
  cursor: lieferung(".1134", "df95cfb3c"),
  word: lieferung(".1137", "f4df701b3"),
  vorfuehrung: lieferung(".1138", "21fc86f9c"),
  belegsatz: lieferung(".1138", "4c9c68e6a"),
  pruefung: anhang("A09", "079–083"),
  erinnerung: test("klara-erinnerungen/erinnerung-am-server.test.ts:243"),
  kalenderIntern: test("klara-kalender/scheduler-anschluss-am-server.test.ts:345"),
  kalenderExtern: kalenderVertrag("klara-kalender/scheduler-anschluss-am-server.test.ts:345"),
  kalenderLoeschung: kalenderVertrag(
    "klara-kalender/scheduler-anschluss-am-server.test.ts:225–326",
  ),
  terminAufgabe: test("eigener-kalender/kalender-aufgaben.test.ts:206"),
  vormachen: test("vormachen-routine/vormachen-am-server.test.ts:233"),
  routine: test("vormachen-routine/vormachen-am-server.test.ts:473"),
  routineWissen: test("vormachen-routine/vormachen-am-server.test.ts:737"),
  modus: anhang("A22", "291–294"),
  schritt: test("vormachen-routine/vormachen-am-server.test.ts:601"),
  besprechung: test("klara-besprechung/server.test.ts:47"),
  frist: test("klara-besprechung/server.test.ts:284"),
  initiativeSetup: test("klara-eigeninitiative/eigeninitiative-mounted.test.tsx:293"),
  initiativeHinweis: test("klara-eigeninitiative/eigeninitiative-mounted.test.tsx:362"),
  initiativeAuftrag: test("klara-eigeninitiative/eigeninitiative-mounted.test.tsx:457"),
  datenplanung: anhang("A04", "425–426"),
  bild: anhang("A28", "357–358"),
  bildKorrektur: test("klara-bildanalyse-ocr/korrekturen-am-server.test.ts:114–192"),
};

export const funktionswege: KatalogWeg[] = [
  {
    id: "dokumentpruefung",
    titel: text(
      "Eine Dokumentpassage prüfen",
      "Check a document passage",
      "Een documentpassage controleren",
    ),
    verbindungen: [
      verbindung(
        "321",
        "V01",
        text(
          "Direkt in Word zum Cursorabsatz fragen",
          "Ask about the paragraph at the cursor in Word",
          "In Word vragen naar de alinea bij de cursor",
        ),
        "nachgewiesen",
        belege.cursor,
      ),
      verbindung(
        "321",
        "V06",
        text(
          "Dieses Word-Dokument für die Klara-App freigeben",
          "Share this Word document with the Klara app",
          "Dit Word-document met de Klara-app delen",
        ),
        "nachgewiesen",
        belege.word,
      ),
      verbindung(
        "V06",
        "V01",
        text(
          "Passage aus dem verbundenen Word-Dokument übernehmen",
          "Use the passage from the connected Word document",
          "Passage uit het gekoppelde Word-document overnemen",
        ),
        "nachgewiesen",
        belege.word,
      ),
      verbindung(
        "V01",
        "V02",
        text(
          "Passage mit Firmenwissen vergleichen",
          "Compare the passage with company knowledge",
          "Passage met bedrijfskennis vergelijken",
        ),
        "nachgewiesen",
        belege.word,
      ),
      verbindung(
        "V02",
        "V03",
        text(
          "Zitierte Fassung über den Quellentitel öffnen",
          "Open the cited version from the source title",
          "De aangehaalde versie via de brontitel openen",
        ),
        "nachgewiesen",
        belege.vorfuehrung,
      ),
      verbindung(
        "V02",
        "V04",
        text(
          "Vergleich in der App groß zeigen",
          "Present the comparison in the app",
          "De vergelijking groot tonen in de app",
        ),
        "nachgewiesen",
        belege.vorfuehrung,
      ),
      verbindung(
        "V04",
        "V03",
        text(
          "Quelle aus der Vorführansicht öffnen",
          "Open the source from presentation view",
          "Bron openen vanuit de presentatieweergave",
        ),
        "nachgewiesen",
        belege.vorfuehrung,
      ),
      verbindung(
        "V03",
        "V05",
        text(
          "Eindeutigen Belegsatz hervorheben",
          "Highlight the unambiguous supporting sentence",
          "De eenduidige bronzin markeren",
        ),
        "nachgewiesen",
        belege.belegsatz,
      ),
    ],
  },
  {
    id: "wissensfreigabe",
    titel: text(
      "Firmenwissen prüfen und belegen",
      "Review and substantiate company knowledge",
      "Bedrijfskennis toetsen en onderbouwen",
    ),
    verbindungen: [
      verbindung(
        "079",
        "080",
        text(
          "Zugewiesene Prüfung im Prüfboard öffnen",
          "Open the assigned review on the review board",
          "De toegewezen beoordeling op het beoordelingsbord openen",
        ),
        "dokumentiert",
        belege.pruefung,
      ),
      verbindung(
        "080",
        "081",
        text(
          "Beitrag nach der Kontoregel annehmen",
          "Approve the contribution under the account’s review rule",
          "De bijdrage volgens de beoordelingsregel van het account goedkeuren",
        ),
        "dokumentiert",
        belege.pruefung,
      ),
      verbindung(
        "081",
        "083",
        text(
          "Annahme an die geprüfte Fassung binden",
          "Bind approval to the reviewed version",
          "Goedkeuring aan de beoordeelde versie koppelen",
        ),
        "dokumentiert",
        belege.pruefung,
      ),
      verbindung(
        "081",
        "082",
        text(
          "Fachliche Annahme am Beitrag anzeigen",
          "Show expert approval on the contribution",
          "De inhoudelijke goedkeuring bij de bijdrage tonen",
        ),
        "dokumentiert",
        belege.pruefung,
      ),
      verbindung(
        "083",
        "V03",
        text(
          "Freigabe der zitierten Fassung nachlesen",
          "Inspect approval for the version cited in the answer",
          "Goedkeuring van de aangehaalde versie bekijken",
        ),
        "nachgewiesen",
        belege.word,
      ),
    ],
  },
  {
    id: "kalender-und-erinnerung",
    titel: text(
      "Erinnerungen im Kalender verfolgen",
      "Follow reminders in a calendar",
      "Herinneringen in de agenda volgen",
    ),
    verbindungen: [
      verbindung(
        "302",
        "314",
        text(
          "Wiederholung und Serienende festlegen",
          "Set a repeat pattern and series end",
          "Herhaling en einde van de reeks instellen",
        ),
        "nachgewiesen",
        belege.erinnerung,
      ),
      verbindung(
        "302",
        "300",
        text(
          "Erinnerung und Vorkommen mit dem Kalendereintrag verknüpfen",
          "Link the reminder and its occurrence to the calendar entry",
          "De herinnering en de bijbehorende uitvoering aan het agenda-item koppelen",
        ),
        "nachgewiesen",
        belege.kalenderIntern,
      ),
      verbindung(
        "300",
        "301",
        text(
          "Dasselbe Vorkommen im verbundenen Kalender zuordnen",
          "Map the same occurrence to the connected calendar",
          "Dezelfde afspraak aan de gekoppelde agenda verbinden",
        ),
        "dokumentiert",
        belege.kalenderExtern,
      ),
      verbindung(
        "301",
        "313",
        text(
          "Nach externer Löschung über die Fortführung entscheiden",
          "Decide whether to continue after an external deletion",
          "Na verwijdering in de externe agenda over voortzetting beslissen",
        ),
        "dokumentiert",
        belege.kalenderLoeschung,
      ),
      verbindung(
        "313",
        "314",
        text(
          "Bei der Rückfrage Einzeltermin oder ganze Serie wählen",
          "Choose a single occurrence or the whole series when prompted",
          "Bij de vraag één afspraak of de hele reeks kiezen",
        ),
        "dokumentiert",
        belege.kalenderLoeschung,
      ),
    ],
  },
  {
    id: "vormachen-und-routinen",
    titel: text(
      "Eine Routine durch Vormachen lernen",
      "Teach a routine by demonstration",
      "Een routine voordoen",
    ),
    verbindungen: [
      verbindung(
        "295",
        "292",
        text(
          "Gewählte Vorgänge sichtbar mitlernen lassen",
          "Let Klara observe only the selected actions",
          "Klara zichtbaar laten meekijken met de gekozen handelingen",
        ),
        "nachgewiesen",
        belege.vormachen,
      ),
      verbindung(
        "292",
        "291",
        text(
          "Vorschau prüfen und als Routine bestätigen",
          "Review the preview and confirm it as a routine",
          "Het voorbeeld controleren en als routine bevestigen",
        ),
        "nachgewiesen",
        belege.routine,
      ),
      verbindung(
        "291",
        "283",
        text(
          "Routine als Firmenentwurf übergeben",
          "Hand the routine over as a company draft",
          "De routine overdragen als bedrijfsconcept",
        ),
        "nachgewiesen",
        belege.routineWissen,
      ),
      verbindung(
        "291",
        "294",
        text(
          "Ausführungsmodus des Schritts prüfen",
          "Check how the step is set to run",
          "De ingestelde uitvoeringswijze van de stap bekijken",
        ),
        "dokumentiert",
        belege.modus,
      ),
      verbindung(
        "294",
        "285",
        text(
          "Einen Schritt mit Außenwirkung einzeln freigeben",
          "Authorise a step that has an external effect",
          "Een stap met extern effect afzonderlijk goedkeuren",
        ),
        "nachgewiesen",
        belege.schritt,
      ),
    ],
  },
  {
    id: "besprechung-und-fristen",
    titel: text(
      "Besprechungsergebnisse weiterverwenden",
      "Act on meeting outcomes",
      "Vergaderresultaten verder gebruiken",
    ),
    verbindungen: [
      verbindung(
        "345",
        "279",
        text(
          "Ausgewählte Ergebnisse als private Notiz übernehmen",
          "Save selected outcomes as a private note",
          "Gekozen resultaten als privénotitie opslaan",
        ),
        "nachgewiesen",
        belege.besprechung,
      ),
      verbindung(
        "345",
        "280",
        text(
          "Eigene Aufgabe ausdrücklich übernehmen",
          "Explicitly take on a personal task",
          "Een eigen taak uitdrukkelijk overnemen",
        ),
        "nachgewiesen",
        belege.besprechung,
      ),
      verbindung(
        "280",
        "300",
        text(
          "Eigene Aufgabe mit einem Kalendereintrag verknüpfen",
          "Link a personal task to a calendar entry",
          "Een eigen taak aan een agenda-item koppelen",
        ),
        "nachgewiesen",
        belege.terminAufgabe,
      ),
      verbindung(
        "345",
        "303",
        text(
          "Gewählte Originalstellen als Fristquelle verwenden",
          "Use selected original passages as deadline evidence",
          "Gekozen oorspronkelijke passages als bron voor termijnen gebruiken",
        ),
        "nachgewiesen",
        belege.frist,
      ),
      verbindung(
        "303",
        "300",
        text(
          "Eindeutige Frist in den eigenen Kalender übernehmen",
          "Add an unambiguous deadline to the personal calendar",
          "Een eenduidige termijn in de eigen agenda opnemen",
        ),
        "nachgewiesen",
        belege.frist,
      ),
      verbindung(
        "303",
        "306",
        text(
          "Unklares Datum zur Klärung offenlassen",
          "Flag an ambiguous date for clarification",
          "Een onduidelijke datum ter verduidelijking openlaten",
        ),
        "nachgewiesen",
        belege.frist,
      ),
    ],
  },
  {
    id: "eigeninitiative",
    titel: text(
      "Klaras Eigeninitiative steuern",
      "Set Klara’s level of initiative",
      "Klara’s initiatief instellen",
    ),
    verbindungen: [
      verbindung(
        "261",
        "264",
        text(
          "Persönlichen Modus in Klara wählen",
          "Choose your preferred mode in Klara",
          "Je persoonlijke modus kiezen in Klara",
        ),
        "nachgewiesen",
        belege.initiativeSetup,
      ),
      verbindung(
        "264",
        "249",
        text(
          "Klara über den angebotenen Seitenhinweis öffnen",
          "Open Klara from the suggested page hint",
          "Klara openen via de aangeboden paginatip",
        ),
        "nachgewiesen",
        belege.initiativeHinweis,
      ),
      verbindung(
        "264",
        "285",
        text(
          "Im Auftragsmodus eine konkrete Aktion beauftragen",
          "Request a specific action in delegated work mode",
          "In de opdrachtmodus een concrete actie opdragen",
        ),
        "nachgewiesen",
        belege.initiativeAuftrag,
      ),
      verbindung(
        "285",
        "286",
        text(
          "Stand der beauftragten Aktion nachlesen",
          "Check the status of the requested action",
          "De status van de opgedragen actie bekijken",
        ),
        "nachgewiesen",
        belege.initiativeAuftrag,
      ),
    ],
  },
  {
    id: "datenbankwissen",
    titel: text(
      "Datenbankwissen erschließen",
      "Make database records usable as knowledge",
      "Databasegegevens als kennis ontsluiten",
    ),
    verbindungen: [
      verbindung(
        "425",
        "426",
        text(
          "Importierte Datensätze und Beziehungen fachlich erschließen",
          "Interpret imported records and relationships",
          "Geïmporteerde records en relaties inhoudelijk ontsluiten",
        ),
        "vorgesehen",
        belege.datenplanung,
      ),
      verbindung(
        "426",
        "269",
        text(
          "Freigegebene Datenbankquelle in einer Antwort belegen",
          "Cite an approved database source in an answer",
          "Een goedgekeurde databasebron bij een antwoord vermelden",
        ),
        "vorgesehen",
        belege.datenplanung,
      ),
    ],
  },
  {
    id: "bildtext",
    titel: text(
      "Bildtext prüfen und berichtigen",
      "Review and correct text from an image",
      "Tekst uit een afbeelding controleren en verbeteren",
    ),
    verbindungen: [
      verbindung(
        "357",
        "358",
        text(
          "Erkannte Stelle bei vorhandenen Koordinaten im Bild zeigen",
          "Show the recognised passage when coordinates are available",
          "De herkende passage bij beschikbare coördinaten in de afbeelding tonen",
        ),
        "dokumentiert",
        belege.bild,
      ),
      verbindung(
        "357",
        "359",
        text(
          "Lesefehler für diese Bildfassung berichtigen",
          "Correct a reading error for this image version",
          "Een leesfout voor deze afbeeldingsversie corrigeren",
        ),
        "nachgewiesen",
        belege.bildKorrektur,
      ),
      verbindung(
        "359",
        "360",
        text(
          "Berichtigung zurücknehmen und Rohbefund wiederherstellen",
          "Undo the correction and restore the original reading",
          "De correctie ongedaan maken en de oorspronkelijke lezing herstellen",
        ),
        "nachgewiesen",
        belege.bildKorrektur,
      ),
    ],
  },
  {
    id: "firmenwissen-teamarbeit",
    titel: text(
      "Vom Erfahrungswissen zum Teamablauf",
      "From practical knowledge to a team workflow",
      "Van praktijkkennis naar een teamworkflow",
    ),
    verbindungen: [
      verbindung(
        "283",
        "P02",
        text(
          "Eine Erfahrung zur Prüfung einreichen",
          "Submit an observation for review",
          "Een ervaring ter beoordeling indienen",
        ),
        "nachgewiesen",
        belege.wissensvorschlag,
      ),
      verbindung(
        "P02",
        "V03",
        text(
          "Nach der Entscheidung die gültige Fassung öffnen",
          "Open the version in effect after review",
          "Na het besluit de geldende versie openen",
        ),
        "nachgewiesen",
        belege.wissensvorschlag,
      ),
      verbindung(
        "V03",
        "P03",
        text(
          "Freigegebenes Wissen als Quelle eines Teamassistenten wählen",
          "Choose approved knowledge as a source for a team assistant",
          "Goedgekeurde kennis als bron voor een teamassistent kiezen",
        ),
        "nachgewiesen",
        belege.teamassistent,
      ),
      verbindung(
        "P03",
        "P04",
        text(
          "Den Assistenten in einem gemeinsamen Arbeitsschritt einsetzen",
          "Use the assistant in a shared workflow step",
          "De assistent in een gezamenlijke werkstap inzetten",
        ),
        "nachgewiesen",
        belege.teamworkflow,
      ),
      verbindung(
        "P04",
        "P02",
        text(
          "Ein Ergebnis mit seinen Quellen zur fachlichen Prüfung vorschlagen",
          "Submit a result and its sources for review",
          "Een resultaat met de gebruikte bronnen ter beoordeling indienen",
        ),
        "nachgewiesen",
        belege.ergebniswissen,
      ),
    ],
  },
];
