// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0890 — DIE ANWENDER-WISSENSBIBLIOTHEK NACH FESTEM BAUPLAN.
// ================================================================================================
//
// Der Originalwortlaut: „Eine gegliederte Bibliothek erklärt jede Funktion nach festem Bauplan: was
// es ist, wie es funktioniert, warum es so gebaut ist, was danach passiert und welche typischen
// Missverständnisse es gibt."
//
// GLIEDERUNG, ZWEI EBENEN:
//   · BEREICHSARTIKEL (`HILFE_BIBLIOTHEK`): je Hilfekapitel der Hilfeseite (`HELP_TOPICS`) einer,
//     zugeklappt unter der Kapitelkarte (`pages/Help.tsx`).
//   · FUNKTIONSARTIKEL (`FUNKTIONS_ARTIKEL`, Nacharbeit 5, Ben): die Funktionen INNERHALB der
//     Bereiche, die die Quellengliederung (Lieferung 1, Abschnitt B) einzeln nennt — Diktieren,
//     Interview, Wissensarten, Quellen, Vertraulichkeit, Papierkorb und weitere. Sie stehen auf
//     `/hilfe` im Abschnitt „Funktionen ausführlich“, gegliedert nach den Teilen der Quelle.
// `GLIEDERUNG` ordnet JEDEN Punkt B0-1 … B10-4 der Quelle einem Artikel zu — zusammengefasste
// Artikel sind erlaubt, wenn sie die Funktion wirklich erklären: jede Zuordnung trägt ein Stichwort
// je Sprache, das im zugeordneten Artikel stehen MUSS. Punkte ohne Artikel tragen ihren Grund
// (Funktion so nicht gebaut). Der Wächter `tests/hilfe-bibliothek/bibliothek-bauplan.test.tsx`
// liest die Punkte aus dem Quelldokument selbst und hält die Zuordnung dagegen.
//
// BAUPLAN: die fünf Bausteine aus Lieferung 1, Abschnitt A
// (`docs/qm/HILFE_LIEFERUNG-1_GLIEDERUNG-UND-FAQ_2026-07-04.md:14-20`).
//
// WOHER DER INHALT KOMMT: aus Texten, die am Quelltext geprüft sind — dem Kapiteltext derselben
// Funktion (`help.<id>.body`), den Kurzhilfen des Erfassen-Wegs und des Prüfbereichs (`chelp.*`,
// `vhelp.*`) und den FAQ-Antworten. Ein Artikel verspricht nichts, was diese Texte nicht sagen.
// Anwendersprache wie auf der übrigen Hilfeseite (P-HILFE-ANWENDERSPRACHE): keine Rollennamen,
// keine internen Prüf- oder Pilotbegriffe (derselbe Wächter prüft das).
//
// SPRACHEN: DE/EN/NL wie die Oberfläche. Die Texte liegen als Sprachobjekte hier (Vorbild
// `lib/helpTopics.iso.ts`).
//
// SUCHE (Nacharbeit 5, Ben): beide Artikelarten sind durchsuchbar — auf `/hilfe` über das Feld
// `suchtext` des Kapitels bzw. als eigene Treffer, in Klara über `allBibliothekEntries`
// (`lib/klaraRegistry.ts`). Der Kapiteltext selbst bleibt unverändert; die Artikel werden nicht als
// Kapiteltext angezeigt.
export const BIBLIOTHEK_TEILE = ["was", "wie", "warum", "danach", "missverstaendnisse"] as const;
export type BibliothekTeil = (typeof BIBLIOTHEK_TEILE)[number];
export type BibliothekSprache = "de" | "en" | "nl";

type Text = Readonly<Record<BibliothekSprache, string>>;
export type HilfeArtikel = Readonly<Record<BibliothekTeil, Text>>;

/** UI-Sprache → Sprache der Artikel. Alles außer en/nl fällt auf Deutsch, wie `fallbackLng`. */
export function bibliothekSprache(lng: string): BibliothekSprache {
  if (lng.startsWith("en")) return "en";
  if (lng.startsWith("nl")) return "nl";
  return "de";
}

const T = (de: string, en: string, nl: string): Text => ({ de, en, nl });

export const HILFE_BIBLIOTHEK: Readonly<Record<string, HilfeArtikel>> = {
  firststart: {
    was: T(
      "Der Erststart ist der Moment, in dem eine Installation noch kein Wissen enthält. Mit Demodaten bekommt sie einen Beispielbestand, an dem sich alles ausprobieren lässt — etwa ein Musterbestand einer Bäckerei oder einer Pflegestation.",
      "First start is the moment when an installation does not yet contain any knowledge. Demo data gives it an example stock on which everything can be tried out — such as the sample stock of a bakery or a care ward.",
      "De eerste start is het moment waarop een installatie nog geen kennis bevat. Met demogegevens krijgt ze een voorbeeldbestand waarop alles kan worden uitgeprobeerd — zoals het voorbeeldbestand van een bakkerij of een verpleegafdeling.",
    ),
    wie: T(
      "Unter „Admin“ legt „Demodaten laden“ Wissensobjekte, offene Prüfungen, Wissenslücken und Widersprüche an. „Demodaten entfernen“ nimmt sie wieder weg. Beides braucht Verwaltungsrechte.",
      "Under “Admin”, “Load demo data” creates knowledge objects, open checks, knowledge gaps and contradictions. “Remove demo data” takes them away again. Both need administration rights.",
      "Onder “Admin” maakt “Demogegevens laden” kennisobjecten, openstaande controles, kennishiaten en tegenstrijdigheden aan. “Demogegevens verwijderen” haalt ze weer weg. Beide vereisen beheerrechten.",
    ),
    warum: T(
      "Eine leere Installation zeigt nichts — man sieht weder, wie Prüfen funktioniert, noch wie eine Antwort entsteht. Der Beispielbestand macht das sichtbar, ohne echtes Wissen anzufassen.",
      "An empty installation shows nothing — you see neither how checking works nor how an answer is formed. The example stock makes this visible without touching real knowledge.",
      "Een lege installatie toont niets — je ziet niet hoe controleren werkt en ook niet hoe een antwoord ontstaat. Het voorbeeldbestand maakt dat zichtbaar zonder echte kennis aan te raken.",
    ),
    danach: T(
      "Nach dem Laden kannst du jeden Bereich gefahrlos ausprobieren; danach geht es mit „Wissen erfassen“ an das eigene Wissen.",
      "After loading, you can try every area safely; after that, “Capture Knowledge” is where your own knowledge comes in.",
      "Na het laden kun je elk onderdeel veilig uitproberen; daarna ga je met “Kennis vastleggen” aan de slag met je eigen kennis.",
    ),
    missverstaendnisse: T(
      "Viele befürchten, die Beispiele mischten sich mit echtem Wissen. Richtig ist: „Demodaten entfernen“ nimmt nur den Beispielbestand weg, der echte Bestand bleibt unberührt.",
      "Many fear that the examples mix with real knowledge. In fact, “Remove demo data” only removes the example stock; the real stock stays untouched.",
      "Velen vrezen dat de voorbeelden zich mengen met echte kennis. In werkelijkheid haalt “Demogegevens verwijderen” alleen het voorbeeldbestand weg; het echte bestand blijft onaangeroerd.",
    ),
  },
  capture: {
    was: T(
      "Erfassen ist der Weg, auf dem Erfahrungswissen festgehalten wird — so, wie man es einer neuen Kollegin erzählen würde, etwa wie in einer Tischlerei die Leimzeit bei Kälte verlängert wird.",
      "Capturing is how experience-based knowledge gets recorded — the way you would tell a new colleague, for instance how a joinery extends the glue time in cold weather.",
      "Vastleggen is de weg waarop ervaringskennis wordt genoteerd — zoals je het een nieuwe collega zou vertellen, bijvoorbeeld hoe een schrijnwerkerij de lijmtijd bij kou verlengt.",
    ),
    wie: T(
      "Du tippst, diktierst, fotografierst oder bringst eine Datei mit. Die KI schlägt eine Struktur vor, du entscheidest. Der Weg führt von „Rohwissen erfassen“ über das Strukturieren bis zu „Prüfen & einreichen“; fertige Schritte kannst du wieder öffnen, ohne etwas zu verlieren.",
      "You type, dictate, take a photo or bring a file. The AI suggests a structure; you decide. The path leads from capturing raw knowledge via structuring to checking and submitting; finished steps can be reopened without losing anything.",
      "Je typt, dicteert, fotografeert of brengt een bestand mee. De AI stelt een structuur voor, jij beslist. De weg loopt van ruwe kennis vastleggen via structureren tot controleren en indienen; afgeronde stappen kun je opnieuw openen zonder iets te verliezen.",
    ),
    warum: T(
      "Wissen geht am leichtesten verloren, wenn das Aufschreiben mühsam ist. Darum darf der erste Text unsortiert sein — Ordnung schafft der Vorschlag, die Verantwortung bleibt beim Menschen.",
      "Knowledge is lost most easily when writing it down is a chore. That is why the first text may be unsorted — the suggestion brings order, the responsibility stays with the person.",
      "Kennis gaat het makkelijkst verloren als opschrijven moeizaam is. Daarom mag de eerste tekst ongeordend zijn — het voorstel brengt orde, de verantwoordelijkheid blijft bij de mens.",
    ),
    danach: T(
      "Bis zum Einreichen bleibt alles dein Entwurf. Mit dem Einreichen wird daraus ein Wissensobjekt, das Kolleginnen und Kollegen prüfen.",
      "Until you submit, everything stays your draft. Submitting turns it into a knowledge object that colleagues check.",
      "Tot je indient, blijft alles je concept. Met indienen wordt het een kennisobject dat collega’s controleren.",
    ),
    missverstaendnisse: T(
      "„Die KI speichert meinen Text schon mit.“ — Nein: gespeichert wird nichts von allein. „Ich muss alle Felder ausfüllen.“ — Nein: Kategorie, Schlagwörter und Anhänge sind freiwillig.",
      "“The AI already saves my text.” — No: nothing is saved on its own. “I have to fill in every field.” — No: category, tags and attachments are optional.",
      "“De AI slaat mijn tekst al op.” — Nee: er wordt niets vanzelf opgeslagen. “Ik moet alle velden invullen.” — Nee: categorie, trefwoorden en bijlagen zijn vrijwillig.",
    ),
  },
  fileimport: {
    was: T(
      "Der Dateiimport holt Wissen aus einem vorhandenen Dokument — etwa aus einer Hausordnung im Verein oder einer Wartungsanleitung in der Werkstatt.",
      "File import draws knowledge from an existing document — for example from a club’s house rules or a maintenance manual in a workshop.",
      "Het bestandsimport haalt kennis uit een bestaand document — bijvoorbeeld uit het huishoudelijk reglement van een vereniging of een onderhoudshandleiding in een werkplaats.",
    ),
    wie: T(
      "Unter „Wissen erfassen“ im Werkzeug „Datei“ wählst du „Datei importieren“ und öffnest ein Dokument. „In Punkte analysieren“ schlägt einzelne Wissenspunkte mit Belegstelle vor; „Ganzes Dokument übernehmen“ legt einen vollständigen Entwurf an.",
      "Under “Capture Knowledge”, in the “File” tool, choose “Import file” and open a document. “Analyze into points” proposes individual knowledge points with a source excerpt; “Take over whole document” creates one complete draft.",
      "Onder “Kennis vastleggen” kies je in het gereedschap “Bestand” voor “Bestand importeren” en open je een document. “In punten analyseren” stelt afzonderlijke kennispunten met bronfragment voor; “Hele document overnemen” maakt één volledig concept aan.",
    ),
    warum: T(
      "Jeder vorgeschlagene Punkt trägt die wörtliche Stelle aus dem Dokument. So lässt sich nachprüfen, dass nichts dazuerfunden wurde.",
      "Each proposed point carries the literal passage from the document. This makes it possible to check that nothing was invented.",
      "Elk voorgesteld punt draagt de letterlijke passage uit het document. Zo kun je nagaan dat er niets is bijverzonnen.",
    ),
    danach: T(
      "Was du auswählst, wird ein Entwurf — ungeprüft und noch nicht eingereicht. Du bearbeitest ihn weiter und reichst ihn ein, wenn er stimmt.",
      "What you select becomes a draft — unchecked and not yet submitted. You keep working on it and submit it when it is right.",
      "Wat je selecteert, wordt een concept — ongecontroleerd en nog niet ingediend. Je werkt het verder uit en dient het in als het klopt.",
    ),
    missverstaendnisse: T(
      "„Das ganze Dokument ist danach geprüftes Wissen.“ — Nein: ein importierter Entwurf ist ungeprüft, bis Kolleginnen und Kollegen ihn freigeben.",
      "“The whole document is checked knowledge afterwards.” — No: an imported draft is unchecked until colleagues approve it.",
      "“Het hele document is daarna gecontroleerde kennis.” — Nee: een geïmporteerd concept is ongecontroleerd tot collega’s het vrijgeven.",
    ),
  },
  ask: {
    was: T(
      "„Fragen“ beantwortet eine Frage in eigenen Worten aus dem Wissen eurer Organisation — etwa „Welche Frist gilt für einen Widerspruch?“ in einer Kanzlei.",
      "“Ask” answers a question in your own words from your organisation’s knowledge — for example “Which deadline applies to an objection?” at a law firm.",
      "“Vragen” beantwoordt een vraag in je eigen woorden vanuit de kennis van je organisatie — bijvoorbeeld “Welke termijn geldt voor een bezwaar?” op een advocatenkantoor.",
    ),
    wie: T(
      "Du tippst die Frage ein. Die Antwort wird aus dem vorhandenen Wissen zusammengestellt und nennt die Wissensobjekte, auf die sie sich stützt, jeweils mit ihrem Stand.",
      "You type the question. The answer is compiled from existing knowledge and names the knowledge objects it relies on, each with its status.",
      "Je typt de vraag in. Het antwoord wordt samengesteld uit bestaande kennis en noemt de kennisobjecten waarop het steunt, elk met hun status.",
    ),
    warum: T(
      "An Antworten hängen echte Entscheidungen. Darum zeigt jede Antwort, worauf sie steht, und erfindet nichts, wenn eine Grundlage fehlt.",
      "Real decisions depend on answers. That is why every answer shows what it rests on and invents nothing when a basis is missing.",
      "Aan antwoorden hangen echte beslissingen. Daarom toont elk antwoord waarop het steunt en verzint het niets als een basis ontbreekt.",
    ),
    danach: T(
      "Von der Antwort springst du in die genannten Wissensobjekte. Fehlt eine Grundlage, entsteht eine Wissenslücke, die unter „Risiko & Lücken“ jemandem zugewiesen werden kann.",
      "From the answer you jump into the named knowledge objects. If a basis is missing, a knowledge gap arises that can be assigned to someone under “Risk & Gaps”.",
      "Vanuit het antwoord spring je naar de genoemde kennisobjecten. Ontbreekt een basis, dan ontstaat een kennishiaat dat onder “Risico & hiaten” aan iemand kan worden toegewezen.",
    ),
    missverstaendnisse: T(
      "„Keine Antwort heißt, die App ist kaputt.“ — Nein: eine Lücke ist eine ehrliche Auskunft, dass es zu dieser Frage noch kein passendes Wissen gibt.",
      "“No answer means the app is broken.” — No: a gap is an honest statement that there is no suitable knowledge for this question yet.",
      "“Geen antwoord betekent dat de app kapot is.” — Nee: een hiaat is een eerlijke mededeling dat er voor deze vraag nog geen passende kennis is.",
    ),
  },
  library: {
    was: T(
      "Die Bibliothek ist der gesamte Wissensbestand an einem Ort — vom Hygieneplan der Küche bis zur Anleitung für den Gabelstapler.",
      "The library is the whole body of knowledge in one place — from the kitchen hygiene plan to the forklift instructions.",
      "De bibliotheek is de volledige kennisvoorraad op één plek — van het hygiëneplan van de keuken tot de instructie voor de heftruck.",
    ),
    wie: T(
      "Über das Suchfeld findest du einen Eintrag; Filter, Sortierung, gespeicherte Sichten und Export liegen im Menü „…“ über der Liste. Ein Klick öffnet das Wissensobjekt; Quellen, Versionen, Verlauf und Kommentare liegen hinter „Mehr“.",
      "The search field finds an entry; filters, sorting, saved views and export are in the “…” menu above the list. A click opens the knowledge object; sources, versions, history and comments are behind “More”.",
      "Het zoekveld vindt een item; filters, sortering, opgeslagen weergaven en export staan in het menu “…” boven de lijst. Eén klik opent het kennisobject; bronnen, versies, historie en opmerkingen staan achter “Meer”.",
    ),
    warum: T(
      "Aussage, Stand und Quelle stehen sofort da, weil man einem Eintrag nur trauen kann, wenn man sieht, worauf er steht und wie weit er geprüft ist.",
      "Statement, status and source are shown immediately, because you can only rely on an entry if you see what it rests on and how far it has been checked.",
      "Uitspraak, status en bron staan er meteen, omdat je een item alleen kunt vertrouwen als je ziet waarop het steunt en hoe ver het is gecontroleerd.",
    ),
    danach: T(
      "Aus einem Eintrag heraus kannst du ihn nutzen, einen Widerspruch melden oder einen Hinweis hinterlassen. Jede inhaltliche Änderung wird eine neue Version.",
      "From an entry you can use it, report a contradiction or leave a note. Every change to the content becomes a new version.",
      "Vanuit een item kun je het gebruiken, een tegenspraak melden of een opmerking achterlaten. Elke inhoudelijke wijziging wordt een nieuwe versie.",
    ),
    missverstaendnisse: T(
      "„Alles in der Bibliothek ist geprüft.“ — Nicht unbedingt: der Stand am Eintrag sagt, ob er validiert ist oder noch in Prüfung.",
      "“Everything in the library has been checked.” — Not necessarily: the status on the entry says whether it is validated or still being checked.",
      "“Alles in de bibliotheek is gecontroleerd.” — Niet per se: de status bij het item zegt of het gevalideerd is of nog wordt gecontroleerd.",
    ),
  },
  validation: {
    was: T(
      "Die Validierung ist der Ort, an dem eingereichtes Wissen auf seine Prüfung wartet — etwa eine neue Arbeitsanweisung aus dem Lager, die eine Kollegin gegenliest.",
      "Validation is where submitted knowledge waits to be checked — such as a new work instruction from the warehouse that a colleague reads over.",
      "Validatie is de plek waar ingediende kennis op controle wacht — bijvoorbeeld een nieuwe werkinstructie uit het magazijn die een collega naleest.",
    ),
    wie: T(
      "Du liest die Aussage und entscheidest: „Freigeben“, „Rückfrage“ oder „Ablehnen“. Die letzten beiden verlangen eine Begründung, und der Eintrag geht zurück in die Nacharbeit. Wie viele Freigaben noch fehlen, steht an jeder Karte.",
      "You read the statement and decide: approve, query or reject. The last two require a reason, and the entry goes back for rework. How many approvals are still missing is shown on each card.",
      "Je leest de uitspraak en beslist: vrijgeven, vraag stellen of afwijzen. De laatste twee vragen een motivering, en het item gaat terug voor nawerk. Hoeveel vrijgaven nog ontbreken, staat op elke kaart.",
    ),
    warum: T(
      "Wissen wird belastbar, wenn andere es unabhängig beurteilen. Darum braucht es mehrere Freigaben, und ein begründeter Einwand wird nicht überstimmt.",
      "Knowledge becomes reliable when others judge it independently. That is why several approvals are needed, and a reasoned objection is not outvoted.",
      "Kennis wordt betrouwbaar als anderen haar onafhankelijk beoordelen. Daarom zijn meerdere vrijgaven nodig, en een onderbouwd bezwaar wordt niet overstemd.",
    ),
    danach: T(
      "Sind genug Freigaben da und steht keine Ablehnung dagegen, ist der Eintrag validiert. Eine Rückfrage landet als Kommentar beim Eintrag, und nach der Überarbeitung wird neu geprüft.",
      "Once there are enough approvals and no rejection stands against it, the entry is validated. A query lands as a comment on the entry, and after revision it is checked again.",
      "Zijn er genoeg vrijgaven en staat er geen afwijzing tegenover, dan is het item gevalideerd. Een vraag komt als opmerking bij het item, en na bewerking wordt opnieuw gecontroleerd.",
    ),
    missverstaendnisse: T(
      "„Ablehnen löscht den Eintrag.“ — Nein: er bleibt sichtbar in Prüfung, bis jemand reagiert. „Den eigenen Beitrag kann ich selbst freigeben.“ — Nein, das ist bewusst ausgeschlossen.",
      "“Rejecting deletes the entry.” — No: it stays visible while being checked until someone responds. “I can approve my own contribution.” — No, that is deliberately excluded.",
      "“Afwijzen verwijdert het item.” — Nee: het blijft zichtbaar in controle tot iemand reageert. “Mijn eigen bijdrage kan ik zelf vrijgeven.” — Nee, dat is bewust uitgesloten.",
    ),
  },
  tasks: {
    was: T(
      "„Offene Aufgaben“ bündelt die Arbeit, die auf dich wartet — vom Eintrag, den du prüfen sollst, bis zur Rückfrage an dich.",
      "Open tasks gathers the work waiting for you — from the entry you are asked to check to the query addressed to you.",
      "Open taken bundelt het werk dat op je wacht — van het item dat je moet controleren tot de vraag aan jou.",
    ),
    wie: T(
      "Ein farbiger Punkt zeigt die Dringlichkeit, die Knopfreihe grenzt die Liste auf eine Art ein, und das „i“ an einer Zeile sagt, was dort zu tun ist. Jede Zeile führt dorthin, wo die Sache erledigt wird.",
      "A coloured dot shows the urgency, the row of buttons narrows the list to one kind, and the “i” on a row says what needs doing there. Each row leads to where the matter is dealt with.",
      "Een gekleurde stip toont de urgentie, de knoppenrij beperkt de lijst tot één soort, en de “i” bij een regel zegt wat daar te doen is. Elke regel leidt naar de plek waar de zaak wordt afgehandeld.",
    ),
    warum: T(
      "Offene Arbeit verteilt sich sonst über viele Bereiche. An einer Stelle gesammelt, bleibt nichts liegen, nur weil man es nicht gefunden hat.",
      "Otherwise open work spreads across many areas. Gathered in one place, nothing is left lying just because it was not found.",
      "Anders verspreidt open werk zich over veel onderdelen. Op één plek verzameld, blijft niets liggen alleen omdat het niet gevonden werd.",
    ),
    danach: T(
      "Du klickst eine Zeile an und erledigst die Sache in dem Bereich, in den sie führt — sofern deine Rechte diesen Bereich zulassen.",
      "You click a row and deal with the matter in the area it leads to — provided your rights allow that area.",
      "Je klikt op een regel en handelt de zaak af in het onderdeel waar die naartoe leidt — voor zover je rechten dat onderdeel toestaan.",
    ),
    missverstaendnisse: T(
      "„Eine Zuweisung ist schon eine Entscheidung.“ — Nein: sie ist eine Bitte; entschieden wird erst, wenn du selbst handelst.",
      "“An assignment is already a decision.” — No: it is a request; nothing is decided until you act yourself.",
      "“Een toewijzing is al een beslissing.” — Nee: het is een verzoek; er wordt pas beslist als je zelf handelt.",
    ),
  },
  risk: {
    was: T(
      "„Risiko & Lücken“ zeigt, wo Wissen fehlt und wo es an einem einzigen Menschen hängt — etwa wenn nur eine Person weiß, wie die Heizungsanlage der Schule entlüftet wird.",
      "“Risk & Gaps” shows where knowledge is missing and where it depends on a single person — for instance when only one person knows how to bleed the school’s heating system.",
      "“Risico & hiaten” toont waar kennis ontbreekt en waar ze aan één persoon hangt — bijvoorbeeld als maar één persoon weet hoe de verwarming van de school wordt ontlucht.",
    ),
    wie: T(
      "Zu jeder offenen Lücke steht der nächste Schritt: Dringlichkeit einschätzen, einer Fachperson zuweisen oder selbst schließen. Fachgebiete sind danach eingefärbt, von wie vielen Personen ihr Wissen stammt.",
      "Each open gap shows the next step: assess urgency, assign it to a specialist or close it yourself. Subject areas are coloured by how many people their knowledge comes from.",
      "Bij elk open hiaat staat de volgende stap: urgentie inschatten, aan een vakpersoon toewijzen of zelf sluiten. Vakgebieden zijn gekleurd naar hoeveel personen hun kennis vandaan komt.",
    ),
    warum: T(
      "Erfahrungswissen geht sonst mit der Person — in den Urlaub, in den Ruhestand. Sichtbar wird das Risiko, solange man es noch entschärfen kann.",
      "Otherwise experience-based knowledge leaves with the person — on holiday, into retirement. The risk becomes visible while it can still be defused.",
      "Anders vertrekt ervaringskennis met de persoon — op vakantie, met pensioen. Het risico wordt zichtbaar zolang het nog te verkleinen is.",
    ),
    danach: T(
      "Eine zugewiesene Lücke wird mit „Wissen erfassen“ geschlossen und läuft dann durch die Prüfung. Bei einem roten Gebiet hilft es, eine zweite Person einzubinden.",
      "An assigned gap is closed with “Capture Knowledge” and then goes through checking. For a red area, involving a second person helps.",
      "Een toegewezen hiaat wordt gesloten met “Kennis vastleggen” en gaat dan door de controle. Bij een rood gebied helpt het een tweede persoon te betrekken.",
    ),
    missverstaendnisse: T(
      "„Rot bewertet die Person.“ — Nein: die Farbe beschreibt, wie Wissen verteilt ist, nicht wie gut jemand arbeitet.",
      "“Red rates the person.” — No: the colour describes how knowledge is distributed, not how well someone works.",
      "“Rood beoordeelt de persoon.” — Nee: de kleur beschrijft hoe kennis verdeeld is, niet hoe goed iemand werkt.",
    ),
  },
  lifecycle: {
    was: T(
      "Der Lebenszyklus kümmert sich um Wissen, das veraltet, weil sich eine Anlage oder ein Ablauf ändert — etwa nach dem Umbau einer Kühlzelle.",
      "The lifecycle takes care of knowledge that becomes outdated because equipment or a process changes — for example after a cold room is rebuilt.",
      "De levenscyclus zorgt voor kennis die veroudert omdat een installatie of werkwijze verandert — bijvoorbeeld na de verbouwing van een koelcel.",
    ),
    wie: T(
      "Mit „Anlage geändert …“ meldest du die Änderung samt Referenz; alle daran gekoppelten Wissensobjekte werden zur erneuten Prüfung markiert. Daneben steht der Lernpfad deiner Rolle zum Abhaken.",
      "With “Asset changed …” you report the change together with its reference; all knowledge objects linked to it are marked for renewed checking. Alongside is the learning path for your role to tick off.",
      "Met “Installatie gewijzigd …” meld je de wijziging met referentie; alle eraan gekoppelde kennisobjecten worden gemarkeerd voor hernieuwde controle. Daarnaast staat het leerpad van je rol om af te vinken.",
    ),
    warum: T(
      "Geprüft heißt nicht: für immer richtig. Wer eine Änderung meldet, sorgt dafür, dass genau das betroffene Wissen noch einmal angesehen wird.",
      "Checked does not mean right forever. Reporting a change ensures that exactly the affected knowledge is looked at again.",
      "Gecontroleerd betekent niet: voor altijd juist. Wie een wijziging meldt, zorgt ervoor dat precies de betrokken kennis opnieuw wordt bekeken.",
    ),
    danach: T(
      "Je Eintrag wird entschieden: noch gültig, dann entsteht eine neue Version — oder er geht in die Nacharbeit. Ist er noch gar nicht freigegeben, führt der Weg zuerst zur Validierung.",
      "Each entry is decided: still valid, then a new version is created — or it goes back for rework. If it has not been approved at all yet, the path leads to Validation first.",
      "Per item wordt beslist: nog geldig, dan ontstaat een nieuwe versie — of het gaat terug voor nawerk. Is het nog helemaal niet vrijgegeven, dan leidt de weg eerst naar Validatie.",
    ),
    missverstaendnisse: T(
      "„Eine gemeldete Änderung löscht das alte Wissen.“ — Nein: sie markiert es zur Prüfung; entschieden wird je Eintrag von einem Menschen.",
      "“A reported change deletes the old knowledge.” — No: it marks it for checking; a person decides for each entry.",
      "“Een gemelde wijziging verwijdert de oude kennis.” — Nee: ze markeert die voor controle; per item beslist een mens.",
    ),
  },
  stufe2: {
    was: T(
      "Die erweiterten Module sind zusätzliche Bereiche über den Kernablauf hinaus, etwa Kennzahlen zum Wissensbestand eines Handwerksbetriebs oder ein daraus erzeugtes Dokument.",
      "The extended modules are additional areas beyond the core process, such as figures on a craft business’s body of knowledge or a document generated from it.",
      "De uitgebreide modules zijn extra onderdelen naast de kernwerkwijze, zoals kengetallen over de kennisvoorraad van een vakbedrijf of een daaruit gemaakt document.",
    ),
    wie: T(
      "Wer Verwaltungsrechte hat, schaltet sie mit „Erweiterte Module“ frei. Die Kapital-Sichten lesen den Bestand als Zahlen; unter „Auswertungen“ entsteht aus validierten Wissensobjekten ein Dokument.",
      "Someone with administration rights switches them on with “Extended modules”. The capital views read the stock as figures; under “Outputs” a document is created from validated knowledge objects.",
      "Wie beheerrechten heeft, zet ze aan met “Uitgebreide modules”. De kapitaalweergaven lezen de voorraad als cijfers; onder “Uitvoer” ontstaat uit gevalideerde kennisobjecten een document.",
    ),
    warum: T(
      "Der Kernablauf soll schlank bleiben. Was darüber hinausgeht, erscheint erst, wenn eine Organisation es bewusst einschaltet.",
      "The core process should stay lean. Anything beyond it appears only once an organisation deliberately switches it on.",
      "De kernwerkwijze moet slank blijven. Wat daarbuiten gaat, verschijnt pas als een organisatie het bewust aanzet.",
    ),
    danach: T(
      "Nach dem Einschalten erscheinen die Bereiche im Menü für alle, deren Rechte reichen. Die Zahlen zeigen nur an; am Wissen ändert sich nichts.",
      "Once switched on, the areas appear in the menu for everyone whose rights are sufficient. The figures only display; nothing about the knowledge changes.",
      "Na het aanzetten verschijnen de onderdelen in het menu voor iedereen met voldoende rechten. De cijfers tonen alleen; aan de kennis verandert niets.",
    ),
    missverstaendnisse: T(
      "„Mir fehlt der Bereich, also habe ich zu wenig Rechte.“ — Nicht unbedingt: ohne eingeschaltete Module bleiben die Bereiche für alle unsichtbar.",
      "“The area is missing for me, so my rights are too low.” — Not necessarily: without the modules switched on, the areas stay invisible for everyone.",
      "“Het onderdeel ontbreekt bij mij, dus heb ik te weinig rechten.” — Niet per se: zonder ingeschakelde modules blijven de onderdelen voor iedereen onzichtbaar.",
    ),
  },
  mobile: {
    was: T(
      "Die mobile Ansicht ist KLARWERK in Telefonbreite — zum Beispiel für eine Gärtnerin, die direkt am Beet festhält, was sie beobachtet hat.",
      "The mobile view is KLARWERK at phone width — for example for a gardener who records right at the flower bed what she has observed.",
      "De mobiele weergave is KLARWERK op telefoonbreedte — bijvoorbeeld voor een tuinier die direct bij het bed noteert wat ze heeft gezien.",
    ),
    wie: T(
      "Die Reiter „Erfassen“, „Fragen“ und „Suchen“ decken festhalten, fragen und nachschlagen ab. Einen Entwurf anlegen darf, wer die Berechtigung dazu hat.",
      "The tabs “Capture”, “Ask” and “Search” cover recording, asking and looking up. Creating a draft requires the permission for it.",
      "De tabbladen “Vastleggen”, “Vragen” en “Zoeken” dekken noteren, vragen en opzoeken. Een concept aanmaken mag wie daar de rechten voor heeft.",
    ),
    warum: T(
      "Wissen entsteht oft weit weg vom Schreibtisch. Unterwegs zählt, es schnell festzuhalten; die sorgfältige Prüfung gehört auf den großen Bildschirm.",
      "Knowledge often arises far from the desk. On the move what counts is recording it quickly; careful checking belongs on the big screen.",
      "Kennis ontstaat vaak ver van het bureau. Onderweg telt het om haar snel vast te leggen; zorgvuldige controle hoort op het grote scherm.",
    ),
    danach: T(
      "Ohne Verbindung wird nur das Speichern eines Entwurfs vorgemerkt und später nachgetragen. Für Prüfen und Freigeben führt „Zur Vollversion“ zurück.",
      "Without a connection only saving a draft is queued and completed later. For checking and approving, “To full version” leads back.",
      "Zonder verbinding wordt alleen het opslaan van een concept vastgehouden en later nagestuurd. Voor controleren en vrijgeven leidt “Naar volledige versie” terug.",
    ),
    missverstaendnisse: T(
      "„Mobil geht alles wie am Rechner.“ — Nein: Prüfen, Freigeben und Widersprüche klären gibt es dort bewusst nicht. Und Fragen und Suchen brauchen eine Verbindung.",
      "“On mobile everything works like on the computer.” — No: checking, approving and settling contradictions are deliberately not available there. And asking and searching need a connection.",
      "“Mobiel werkt alles zoals op de computer.” — Nee: controleren, vrijgeven en tegenstrijdigheden ophelderen zijn daar bewust niet beschikbaar. En vragen en zoeken hebben een verbinding nodig.",
    ),
  },
  wissensnetz: {
    was: T(
      "Die Themenkarte zeigt den Wissensbestand von oben: welche Themen es gibt und welche zusammen in denselben freigegebenen Wissensobjekten vorkommen.",
      "The topic map shows the body of knowledge from above: which topics exist and which occur together in the same approved knowledge objects.",
      "De themakaart toont de kennisvoorraad van bovenaf: welke onderwerpen er zijn en welke samen voorkomen in dezelfde vrijgegeven kennisobjecten.",
    ),
    wie: T(
      "Auf einem breiten Fenster wählst du zwischen „Netz“ und „Lesen“; ein Klick auf einen Kreis legt die zugehörigen Wissensobjekte daneben. Auf einem schmalen Fenster gibt es gleich die Leseansicht.",
      "On a wide window you choose between the network and the reading view; a click on a circle lays the related knowledge objects alongside. On a narrow window you get the reading view straight away.",
      "Op een breed venster kies je tussen het netwerk en de leesweergave; een klik op een cirkel legt de bijbehorende kennisobjecten ernaast. Op een smal venster krijg je meteen de leesweergave.",
    ),
    warum: T(
      "Wer ein Thema sucht, kennt oft den genauen Eintrag nicht. Der Überblick zeigt, wo sich Wissen sammelt und wie Themen zusammenhängen.",
      "People looking for a topic often do not know the exact entry. The overview shows where knowledge gathers and how topics connect.",
      "Wie een onderwerp zoekt, kent vaak het precieze item niet. Het overzicht toont waar kennis zich verzamelt en hoe onderwerpen samenhangen.",
    ),
    danach: T(
      "Zu jedem Thema steht ein Satz mit dem Weg zu seinen Objekten; von dort geht es in die einzelnen Einträge.",
      "Each topic has a sentence with the way to its objects; from there you go into the individual entries.",
      "Bij elk onderwerp staat een zin met de weg naar zijn objecten; van daaruit ga je naar de afzonderlijke items.",
    ),
    missverstaendnisse: T(
      "„Auf dem Telefon fehlt die Zeichnung, also ist etwas kaputt.“ — Nein: auf schmalen Fenstern gibt es bewusst nur die Leseansicht.",
      "“The drawing is missing on the phone, so something is broken.” — No: on narrow windows there is deliberately only the reading view.",
      "“Op de telefoon ontbreekt de tekening, dus er is iets kapot.” — Nee: op smalle vensters is er bewust alleen de leesweergave.",
    ),
  },
  extern: {
    was: T(
      "„Externes Wissen“ durchsucht Quellen außerhalb von Klarwerk — etwa eine öffentliche Norm, die ein Bauleiter nachschlagen will.",
      "External knowledge searches sources outside Klarwerk — such as a public standard a site manager wants to look up.",
      "Externe kennis doorzoekt bronnen buiten Klarwerk — bijvoorbeeld een openbare norm die een bouwleider wil opzoeken.",
    ),
    wie: T(
      "Du gibst einen Suchbegriff ein und bekommst Treffer mit ihrer Adresse. Ist die externe Suche abgeschaltet oder nicht erreichbar, sagt die Seite das offen.",
      "You enter a search term and get hits with their address. If external search is switched off or unreachable, the page says so openly.",
      "Je voert een zoekterm in en krijgt treffers met hun adres. Is extern zoeken uitgeschakeld of niet bereikbaar, dan zegt de pagina dat eerlijk.",
    ),
    warum: T(
      "Was von außen kommt, ist nicht von euch geprüft. Darum bleibt es getrennt und wandert nicht von selbst in euren Bestand.",
      "What comes from outside has not been checked by you. That is why it stays separate and does not move into your stock on its own.",
      "Wat van buiten komt, is niet door jullie gecontroleerd. Daarom blijft het gescheiden en komt het niet vanzelf in jullie voorraad.",
    ),
    danach: T(
      "Was du brauchst, erfasst du anschließend als eigenes Wissensobjekt — dann läuft es durch die normale Prüfung.",
      "What you need, you then capture as your own knowledge object — then it goes through the normal checking.",
      "Wat je nodig hebt, leg je daarna vast als eigen kennisobject — dan gaat het door de normale controle.",
    ),
    missverstaendnisse: T(
      "„Ein Treffer ist schon Teil unseres Wissens.“ — Nein: er bleibt draußen, bis jemand ihn bewusst erfasst und er geprüft ist.",
      "“A hit is already part of our knowledge.” — No: it stays outside until someone deliberately captures it and it has been checked.",
      "“Een treffer hoort al bij onze kennis.” — Nee: hij blijft buiten tot iemand hem bewust vastlegt en hij is gecontroleerd.",
    ),
  },
  konflikte: {
    was: T(
      "Ein Konflikt ist ein Widerspruch: zwei Wissensobjekte sagen etwas über dieselbe Sache, und beides zusammen kann nicht stimmen — etwa zwei verschiedene Lagertemperaturen für dasselbe Medikament.",
      "A conflict is a contradiction: two knowledge objects say something about the same thing, and both together cannot be true — such as two different storage temperatures for the same medicine.",
      "Een conflict is een tegenspraak: twee kennisobjecten zeggen iets over hetzelfde, en beide samen kunnen niet kloppen — bijvoorbeeld twee verschillende opslagtemperaturen voor hetzelfde medicijn.",
    ),
    wie: T(
      "Die Seite stellt die beiden Aussagen nebeneinander. Du wählst, welche gilt, ob beide je nach Zusammenhang gelten oder ob gar kein Widerspruch vorliegt.",
      "The page puts the two statements side by side. You choose which one applies, whether both apply depending on context, or whether there is no contradiction at all.",
      "De pagina zet de twee uitspraken naast elkaar. Je kiest welke geldt, of beide afhankelijk van de context gelden, of dat er helemaal geen tegenspraak is.",
    ),
    warum: T(
      "Wer recht hat, entscheiden Menschen, nicht das System. Der Widerspruch wird sichtbar gemacht, damit er geklärt statt übersehen wird.",
      "People decide who is right, not the system. The contradiction is made visible so that it gets resolved instead of overlooked.",
      "Mensen beslissen wie gelijk heeft, niet het systeem. De tegenspraak wordt zichtbaar gemaakt zodat ze wordt opgehelderd in plaats van over het hoofd gezien.",
    ),
    danach: T(
      "Deine Wahl wird als Vermerk festgehalten. Sollte ein Eintrag danach überarbeitet werden, bleibt das eine bewusste Handlung eines Menschen.",
      "Your choice is recorded as a note. If an entry should be revised afterwards, that remains a deliberate action by a person.",
      "Je keuze wordt als notitie vastgelegd. Moet een item daarna worden bewerkt, dan blijft dat een bewuste handeling van een mens.",
    ),
    missverstaendnisse: T(
      "„Wer einen Konflikt auslöst, hat etwas falsch gemacht.“ — Nein: er hat eine Unstimmigkeit ans Licht geholt. Und: gelöscht wird bei der Entscheidung nichts.",
      "“Whoever triggers a conflict did something wrong.” — No: they brought an inconsistency to light. And: nothing is deleted when deciding.",
      "“Wie een conflict veroorzaakt, heeft iets fout gedaan.” — Nee: die heeft een ongerijmdheid aan het licht gebracht. En: bij de beslissing wordt niets verwijderd.",
    ),
  },
  duplikate: {
    was: T(
      "Duplikate sind zwei Wissensobjekte, die weitgehend dasselbe sagen — etwa zwei Anleitungen für dieselbe Kaffeemaschine im Büro.",
      "Duplicates are two knowledge objects that say largely the same thing — such as two instructions for the same office coffee machine.",
      "Duplicaten zijn twee kennisobjecten die grotendeels hetzelfde zeggen — bijvoorbeeld twee instructies voor hetzelfde koffieapparaat op kantoor.",
    ),
    wie: T(
      "Sie erscheinen als Paar. Du entscheidest, welche Seite maßgeblich ist, ob beide bleiben und als verwandt vermerkt werden oder ob es gar kein Duplikat ist.",
      "They appear as a pair. You decide which side is authoritative, whether both stay and are noted as related, or whether it is no duplicate at all.",
      "Ze verschijnen als paar. Je beslist welke kant maatgevend is, of beide blijven en als verwant worden genoteerd, of dat het helemaal geen duplicaat is.",
    ),
    warum: T(
      "Anders als beim Konflikt widersprechen sich die beiden nicht, sie doppeln sich. Eine bewusste Entscheidung hält fest, wie damit umgegangen wird, ohne Wissen zu verlieren.",
      "Unlike a conflict, the two do not contradict each other; they duplicate each other. A deliberate decision records how this is handled, without losing knowledge.",
      "Anders dan bij een conflict spreken de twee elkaar niet tegen, ze overlappen. Een bewuste beslissing legt vast hoe daarmee wordt omgegaan, zonder kennis te verliezen.",
    ),
    danach: T(
      "Es entsteht ein Vermerk, und der entschiedene Fund verschwindet aus der Liste. Beide Wissensobjekte bleiben unverändert bestehen.",
      "A note is created, and the decided finding disappears from the list. Both knowledge objects remain unchanged.",
      "Er ontstaat een notitie, en de beslechte vondst verdwijnt uit de lijst. Beide kennisobjecten blijven ongewijzigd bestaan.",
    ),
    missverstaendnisse: T(
      "„Aus zwei Einträgen wird einer.“ — Nein: zusammengeführt oder gelöscht wird nichts, und auch „als verwandt vermerken“ legt keine Verknüpfung in den Objekten an.",
      "“Two entries become one.” — No: nothing is merged or deleted, and noting them as related does not create a link inside the objects either.",
      "“Van twee items wordt er één.” — Nee: er wordt niets samengevoegd of verwijderd, en ook als verwant noteren maakt geen koppeling in de objecten aan.",
    ),
  },
  analytics: {
    was: T(
      "Diese Seite bündelt die Auswertung über den gesamten Bestand und das Protokoll der Vorgänge — etwa wie viel Wissen einer Versicherungsabteilung schon validiert ist.",
      "This page combines the evaluation across the whole stock with the log of events — for example how much of an insurance department’s knowledge is already validated.",
      "Deze pagina bundelt de analyse over de hele voorraad met het logboek van gebeurtenissen — bijvoorbeeld hoeveel kennis van een verzekeringsafdeling al gevalideerd is.",
    ),
    wie: T(
      "Auf der einen Seite stehen Kennzahlen zu Validierung, Vertrauen, Lücken und Auslastung, auf der anderen das Protokoll. Das Protokoll filterst du nach Art des Vorgangs und nach handelnder Person.",
      "On one side are figures on validation, confidence, gaps and workload, on the other the log. You filter the log by type of event and by acting person.",
      "Aan de ene kant staan kengetallen over validatie, vertrouwen, hiaten en belasting, aan de andere het logboek. Het logboek filter je op soort gebeurtenis en op handelende persoon.",
    ),
    warum: T(
      "Eine Zahl allein beweist nichts. Darum steht neben jeder Kennzahl der nachvollziehbare Weg, wie sie entstanden ist.",
      "A number on its own proves nothing. That is why next to each figure there is the traceable path of how it came about.",
      "Een getal alleen bewijst niets. Daarom staat naast elk kengetal de navolgbare weg van hoe het tot stand kwam.",
    ),
    danach: T(
      "Du suchst dir eine Kennzahl aus und gehst ihrer Herkunft im Protokoll nach.",
      "You pick a figure and trace its origin in the log.",
      "Je kiest een kengetal en volgt de herkomst ervan in het logboek.",
    ),
    missverstaendnisse: T(
      "„Die Seite ändert etwas am Wissen.“ — Nein: sie zeigt nur an und protokolliert, was geschehen ist.",
      "“The page changes something about the knowledge.” — No: it only displays and logs what has happened.",
      "“De pagina verandert iets aan de kennis.” — Nee: ze toont alleen en legt vast wat er is gebeurd.",
    ),
  },
  output: {
    was: T(
      "Unter „Auswertungen“ entsteht aus vorhandenem Wissen ein Dokument — etwa eine Einweisungsmappe für neue Auszubildende.",
      "Under “Outputs” a document is created from existing knowledge — for example an induction folder for new apprentices.",
      "Onder “Uitvoer” ontstaat uit bestaande kennis een document — bijvoorbeeld een inwerkmap voor nieuwe leerlingen.",
    ),
    wie: T(
      "Du wählst die Art des Dokuments, stellst die Wissensobjekte zusammen und bringst sie in Reihenfolge. Eine Vorschau zeigt die Zusammenstellung, bevor das Dokument erzeugt wird.",
      "You choose the type of document, put the knowledge objects together and arrange their order. A preview shows the compilation before the document is created.",
      "Je kiest het soort document, stelt de kennisobjecten samen en zet ze in volgorde. Een voorbeeld toont de samenstelling voordat het document wordt gemaakt.",
    ),
    warum: T(
      "In ein Dokument gehört Wissen, auf das man sich stützen kann. Darum entsteht es aus validierten Wissensobjekten.",
      "A document should contain knowledge you can rely on. That is why it is built from validated knowledge objects.",
      "In een document hoort kennis waarop je kunt bouwen. Daarom ontstaat het uit gevalideerde kennisobjecten.",
    ),
    danach: T(
      "Nach der Vorschau wird das Dokument erzeugt; das Wissen selbst bleibt dabei unverändert.",
      "After the preview the document is created; the knowledge itself remains unchanged.",
      "Na het voorbeeld wordt het document gemaakt; de kennis zelf blijft daarbij ongewijzigd.",
    ),
    missverstaendnisse: T(
      "„Jeder Eintrag kann ins Dokument.“ — Nicht jeder: Quelle sind validierte Wissensobjekte.",
      "“Any entry can go into the document.” — Not any: the source is validated knowledge objects.",
      "“Elk item kan in het document.” — Niet elk: de bron zijn gevalideerde kennisobjecten.",
    ),
  },
  import: {
    was: T(
      "„Import & Quellen“ holt Inhalte aus fremden Quellen herein — etwa aus einem bestehenden Wiki eines Logistikunternehmens.",
      "Import & sources brings in content from external sources — for example from a logistics company’s existing wiki.",
      "Import & bronnen haalt inhoud uit externe bronnen binnen — bijvoorbeeld uit een bestaande wiki van een logistiek bedrijf.",
    ),
    wie: T(
      "Oben wählst du eine Quelle, siehst nach, was darin steht, und legst daraus Vorschläge an. Die Vorschläge liegen darunter in einem zugeklappten Verlaufsbereich; dort entscheidest du einen mit „Annehmen“ oder „Ablehnen“.",
      "At the top you choose a source, see what it contains and create suggestions from it. The suggestions sit in the collapsed history area; there you decide each one by accepting or declining it.",
      "Bovenaan kies je een bron, bekijk je wat erin staat en maak je er voorstellen van. De voorstellen staan in het ingeklapte geschiedenisgedeelte; daar beslis je per voorstel door het te accepteren of af te wijzen.",
    ),
    warum: T(
      "Hineingelesen wird nur, was du auswählst. So kommt nichts Ungesehenes in den Bestand.",
      "Only what you select is read in. That way nothing unseen gets into the stock.",
      "Alleen wat je selecteert wordt ingelezen. Zo komt er niets ongeziens in de voorraad.",
    ),
    danach: T(
      "Entschiedene Vorschläge bleiben mit ihrem Stand in der Liste stehen; den nächsten offenen suchst du dir selbst.",
      "Decided suggestions stay in the list with their status; you look for the next open one yourself.",
      "Beslechte voorstellen blijven met hun status in de lijst staan; het volgende open voorstel zoek je zelf.",
    ),
    missverstaendnisse: T(
      "„Nach einer Entscheidung rückt automatisch der nächste Vorschlag nach.“ — Nein: entschiedene Vorschläge verschwinden nicht und schieben nichts nach.",
      "“After a decision the next suggestion moves up automatically.” — No: decided suggestions do not disappear and push nothing forward.",
      "“Na een beslissing schuift automatisch het volgende voorstel door.” — Nee: beslechte voorstellen verdwijnen niet en schuiven niets door.",
    ),
  },
  graph: {
    was: T(
      "Der Wissensgraph zeichnet die einzelnen Wissensobjekte und ihre Verbindungen als Netz — näher am Objekt als die Themenkarte.",
      "The knowledge graph draws the individual knowledge objects and their connections as a network — closer to the object than the topic map.",
      "De kennisgraaf tekent de afzonderlijke kennisobjecten en hun verbindingen als netwerk — dichter bij het object dan de themakaart.",
    ),
    wie: T(
      "Gehört ein Knoten zu einem Objekt aus dem Bestand, führt ein Klick zu diesem Wissensobjekt; mit der Tastatur erreichst du ihn ebenso.",
      "If a node belongs to an object in the stock, a click leads to that knowledge object; you can reach it with the keyboard as well.",
      "Hoort een knoop bij een object uit de voorraad, dan leidt een klik naar dat kennisobject; met het toetsenbord bereik je hem net zo.",
    ),
    warum: T(
      "Verbindungen zeigen, welches Wissen aufeinander aufbaut — etwa eine Reinigungsanleitung, die auf einer Gefahrstoffregel beruht.",
      "Connections show which knowledge builds on which — for instance a cleaning instruction that relies on a hazardous substance rule.",
      "Verbindingen tonen welke kennis op welke voortbouwt — bijvoorbeeld een schoonmaakinstructie die steunt op een regel voor gevaarlijke stoffen.",
    ),
    danach: T(
      "Du fängst bei einem Objekt an, das du kennst, und folgst seinen Linien zu verwandtem Wissen.",
      "You start at an object you know and follow its lines to related knowledge.",
      "Je begint bij een object dat je kent en volgt de lijnen naar verwante kennis.",
    ),
    missverstaendnisse: T(
      "„Jeder Knoten ist anklickbar.“ — Nein: ein Knoten ohne Objekt im Bestand ist kein Link und liegt nicht in der Tastatur-Reihenfolge.",
      "“Every node is clickable.” — No: a node without an object in the stock is not a link and is not in the keyboard order.",
      "“Elke knoop is aanklikbaar.” — Nee: een knoop zonder object in de voorraad is geen link en zit niet in de toetsenbordvolgorde.",
    ),
  },
  gesamtanweisungen: {
    was: T(
      "Arbeitsanleitungen sind lesbare Schritt-für-Schritt-Dokumente aus vorhandenem Wissen — zum Beispiel für die Einarbeitung neuer Mitarbeitender in einer Arztpraxis.",
      "Work instructions are readable step-by-step documents built from existing knowledge — for example for onboarding new staff at a medical practice.",
      "Werkinstructies zijn leesbare stap-voor-stapdocumenten uit bestaande kennis — bijvoorbeeld voor het inwerken van nieuwe medewerkers in een huisartsenpraktijk.",
    ),
    wie: T(
      "Du beginnst mit einem Titel, beschreibst Zweck, Geltungsbereich und Voraussetzungen und nimmst vorhandene Einträge als Abschnitte auf. Die Reihenfolge änderst du mit „Nach oben“ und „Nach unten“.",
      "You start with a title, describe purpose, scope and prerequisites, and add existing entries as sections. You change the order by moving sections up and down.",
      "Je begint met een titel, beschrijft doel, toepassingsgebied en voorwaarden en neemt bestaande items op als secties. De volgorde verander je door secties omhoog en omlaag te zetten.",
    ),
    warum: T(
      "Jeder Abschnitt hält eine feste Fassung des Eintrags. So verändert eine spätere Änderung am Eintrag die Anleitung nicht still.",
      "Each section holds a fixed version of the entry. That way a later change to the entry does not silently change the instruction.",
      "Elke sectie bevat een vaste versie van het item. Zo verandert een latere wijziging aan het item de instructie niet stilletjes.",
    ),
    danach: T(
      "Zum Schluss legst du die ganze Anleitung zur Entscheidung vor; entscheiden können Personen mit Prüfrecht. „Was hat sich geändert?“ vergleicht zwei gespeicherte Stände.",
      "Finally you submit the whole instruction for a decision; people allowed to check can decide. A comparison shows what changed between two saved versions.",
      "Ten slotte leg je de hele instructie voor ter beslissing; mensen die mogen controleren kunnen beslissen. Een vergelijking toont wat er tussen twee opgeslagen versies is veranderd.",
    ),
    missverstaendnisse: T(
      "„Die Anleitung wird automatisch fachlich geprüft.“ — Nein: eine automatische fachliche Prüfung ist nicht angebunden, und für das Zusammenstellen wird keine KI gebraucht.",
      "“The instruction is checked automatically for content.” — No: no automatic content check is connected, and no AI is needed to put it together.",
      "“De instructie wordt automatisch inhoudelijk gecontroleerd.” — Nee: er is geen automatische inhoudelijke controle gekoppeld, en voor het samenstellen is geen AI nodig.",
    ),
  },
  hilfe: {
    was: T(
      "Die Hilfeseite bündelt alle Hilfekapitel, die häufigen Fragen und diese ausführlichen Erklärungen an einem Ort.",
      "The help page brings together all help chapters, the frequently asked questions and these detailed explanations in one place.",
      "De helppagina bundelt alle helphoofdstukken, de veelgestelde vragen en deze uitgebreide uitleg op één plek.",
    ),
    wie: T(
      "Über das Suchfeld findest du Kapitel und Fragen; gesucht wird in Titel, Text und Schlagwörtern. Jedes Kapitel führt mit einem Link auf die Seite, um die es geht.",
      "The search field finds chapters and questions; it searches titles, text and keywords. Each chapter leads with a link to the page it is about.",
      "Met het zoekveld vind je hoofdstukken en vragen; er wordt gezocht in titel, tekst en trefwoorden. Elk hoofdstuk leidt met een link naar de pagina waarover het gaat.",
    ),
    warum: T(
      "Wer ins Stocken gerät, beschreibt sein Problem mit eigenen Worten. Darum darfst du das Wort eintippen, das dir zuerst einfällt.",
      "Anyone who gets stuck describes the problem in their own words. That is why you can type the first word that comes to mind.",
      "Wie vastloopt, beschrijft het probleem in eigen woorden. Daarom mag je het woord intypen dat als eerste bij je opkomt.",
    ),
    danach: T(
      "Findet die Suche nichts, sagt die Seite das offen und nennt einen nächsten Schritt. Oben steht, wie du den Support dieser Installation erreichst.",
      "If the search finds nothing, the page says so openly and names a next step. At the top it shows how to reach the support for this installation.",
      "Vindt de zoekfunctie niets, dan zegt de pagina dat eerlijk en noemt ze een volgende stap. Bovenaan staat hoe je de support van deze installatie bereikt.",
    ),
    missverstaendnisse: T(
      "„Ohne Treffer gibt es keine Hilfe.“ — Nein: Klara über das Fragezeichen unten rechts erklärt auch die Seite, auf der du gerade bist.",
      "“No hits means no help.” — No: Klara, via the question mark at the bottom right, also explains the page you are on.",
      "“Geen treffers betekent geen hulp.” — Nee: Klara, via het vraagteken rechtsonder, legt ook de pagina uit waarop je nu bent.",
    ),
  },
  profil: {
    was: T(
      "Im Profil stehen deine eigenen Angaben: Name und Rolle, E-Mail-Adresse, die Sprache der Oberfläche und der Weg zum Abmelden.",
      "Your profile holds your own details: name and role, email address, the interface language and the way to log out.",
      "In je profiel staan je eigen gegevens: naam en rol, e-mailadres, de taal van de interface en de weg om uit te loggen.",
    ),
    wie: T(
      "Du kannst die Sprache umstellen und dein Passwort ändern; unter „Meine Wirkung“ siehst du Zahlen ausschließlich zu deinen eigenen Beiträgen.",
      "You can switch the language and change your password; under your impact you see figures only about your own contributions.",
      "Je kunt de taal wijzigen en je wachtwoord aanpassen; onder je impact zie je cijfers uitsluitend over je eigen bijdragen.",
    ),
    warum: T(
      "Was dich betrifft, soll an einer Stelle stehen — und Zahlen über andere Personen gehören nicht hierher.",
      "What concerns you should be in one place — and figures about other people do not belong here.",
      "Wat jou aangaat, hoort op één plek te staan — en cijfers over andere personen horen hier niet thuis.",
    ),
    danach: T(
      "Eine geänderte Sprache gilt sofort für die ganze Oberfläche, auch für diese Hilfe.",
      "A changed language applies immediately to the whole interface, including this help.",
      "Een gewijzigde taal geldt meteen voor de hele interface, ook voor deze help.",
    ),
    missverstaendnisse: T(
      "„Mir fehlen Bereiche, also stimmt mit meinem Konto etwas nicht.“ — Nicht unbedingt: es kann an der Rolle liegen oder daran, dass die erweiterten Module ausgeschaltet sind.",
      "“Areas are missing for me, so something is wrong with my account.” — Not necessarily: it may be due to the role or to the extended modules being switched off.",
      "“Er ontbreken onderdelen, dus er is iets mis met mijn account.” — Niet per se: het kan aan de rol liggen of aan het feit dat de uitgebreide modules uitgeschakeld zijn.",
    ),
  },
};

/** Der Artikel zu einem Hilfekapitel in der UI-Sprache — `null`, wenn es keinen gibt (ISO-Kapitel). */
export function hilfeArtikel(
  kapitelId: string,
  lng: string,
): Readonly<Record<BibliothekTeil, string>> | null {
  const artikel = HILFE_BIBLIOTHEK[kapitelId];
  if (!artikel) return null;
  return inSprache(artikel, lng);
}

function inSprache(artikel: HilfeArtikel, lng: string): Readonly<Record<BibliothekTeil, string>> {
  const sprache = bibliothekSprache(lng);
  return {
    was: artikel.was[sprache],
    wie: artikel.wie[sprache],
    warum: artikel.warum[sprache],
    danach: artikel.danach[sprache],
    missverstaendnisse: artikel.missverstaendnisse[sprache],
  };
}

// ================================================================================================
// FUNKTIONSARTIKEL — die einzeln genannten Funktionen der Quellengliederung (Nacharbeit 5).
// ================================================================================================
//
// Inhalt aus denselben geprüften Quellen wie oben, je Funktion genannt: Kurzhilfen (`chelp.*`,
// `vhelp.*`), Verwaltungstexte (`adm.*`), FAQ-Antworten und Rollenvertrag
// (`services/rbac/src/policy.ts`). Wo eine Kurzhilfe vom heutigen Stand abweicht, gilt der Stand
// der Oberfläche: die Wissensarten heißen so, wie die Auswahl sie anbietet (`ktype.*`), nicht wie
// die ältere Kurzhilfe `chelp.knowledgeType` sie nennt.
//
// `gruppe` ist der Teil der Quellengliederung (0 Grundverständnis … 8 Verwaltung); die Überschrift
// dazu steht in `texte/hilfebibliothek.ts` (`hilfebibliothek.gruppe.<n>`).
// `rollenausnahme` wie in `lib/hilfeFaq.ts`: nur dort dürfen Rollennamen stehen.

export const BIBLIOTHEK_GRUPPEN = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
export type BibliothekGruppe = (typeof BIBLIOTHEK_GRUPPEN)[number];

export interface FunktionsArtikel {
  readonly id: string;
  readonly gruppe: BibliothekGruppe;
  readonly route: string;
  readonly titel: Text;
  readonly teile: HilfeArtikel;
  readonly rollenausnahme?: true;
}

export const FUNKTIONS_ARTIKEL: readonly FunktionsArtikel[] = [
  {
    id: "grundprinzip",
    gruppe: 0,
    route: "/hilfe",
    titel: T(
      "Was KLARWERK ist und warum es nicht einfach antwortet",
      "What KLARWERK is and why it does not simply answer",
      "Wat KLARWERK is en waarom het niet zomaar antwoordt",
    ),
    teile: {
      was: T(
        "KLARWERK hält das Erfahrungswissen einer Organisation fest, lässt es von Kolleginnen und Kollegen prüfen und beantwortet Fragen nur daraus. Der Leitsatz lautet: Vertrauen ist Evidenz — nichts gilt, nur weil jemand es behauptet.",
        "KLARWERK records an organisation’s experience-based knowledge, has colleagues check it and answers questions only from it. The guiding principle: confidence is evidence — nothing counts just because someone claims it.",
        "KLARWERK legt de ervaringskennis van een organisatie vast, laat collega’s die controleren en beantwoordt vragen alleen daaruit. Het leidende principe: vertrouwen is bewijs — niets geldt alleen omdat iemand het beweert.",
      ),
      wie: T(
        "Jede Aussage ist ein Wissensobjekt mit Herkunft, Belegen und Stand. Eine Antwort wird aus diesem Bestand zusammengestellt und nennt die Einträge, auf die sie sich stützt.",
        "Every statement is a knowledge object with origin, evidence and status. An answer is compiled from this stock and names the entries it relies on.",
        "Elke uitspraak is een kennisobject met herkomst, bewijzen en status. Een antwoord wordt uit deze voorraad samengesteld en noemt de vermeldingen waarop het steunt.",
      ),
      warum: T(
        "An Antworten hängen echte Entscheidungen — an einer Maschine, am Pflegebett, in einer Akte. Eine erfundene Antwort ist teurer als eine offene Lücke; deshalb antwortet die KI nicht einfach auf alles, sondern nur aus vorhandenem Wissen.",
        "Real decisions depend on answers — at a machine, at a bedside, in a case file. An invented answer costs more than an open gap; that is why the AI does not simply answer everything but only from existing knowledge.",
        "Aan antwoorden hangen echte beslissingen — bij een machine, aan het bed, in een dossier. Een verzonnen antwoord kost meer dan een open hiaat; daarom antwoordt de AI niet zomaar op alles, maar alleen vanuit bestaande kennis.",
      ),
      danach: T(
        "Fehlt Wissen, entsteht eine Wissenslücke, die jemand schließen kann. Vorhandenes Wissen wird geprüft, genutzt und aktuell gehalten.",
        "If knowledge is missing, a knowledge gap arises that someone can close. Existing knowledge is checked, used and kept up to date.",
        "Ontbreekt kennis, dan ontstaat een kennishiaat dat iemand kan sluiten. Bestaande kennis wordt gecontroleerd, gebruikt en actueel gehouden.",
      ),
      missverstaendnisse: T(
        "„KLARWERK ist ein Chatbot.“ — Nein: es antwortet nur aus eurem Wissen. „Was die KI vorschlägt, ist gesichert.“ — Nein: gesichert wird Wissen erst durch die Prüfung von Menschen.",
        "“KLARWERK is a chatbot.” — No: it answers only from your knowledge. “What the AI suggests is secured.” — No: knowledge is only secured once people have checked it.",
        "“KLARWERK is een chatbot.” — Nee: het antwoordt alleen vanuit jullie kennis. “Wat de AI voorstelt, is zeker.” — Nee: kennis is pas zeker na controle door mensen.",
      ),
    },
  },
  {
    id: "kreislauf",
    gruppe: 0,
    route: "/start",
    titel: T(
      "Der Wissenskreislauf und deine ersten Schritte",
      "The knowledge cycle and your first steps",
      "De kenniscyclus en je eerste stappen",
    ),
    teile: {
      was: T(
        "Der Wissenskreislauf hat vier Schritte: Erfassen, Validieren, Nutzen und Aktuell halten. Jeder Schritt hat seinen eigenen Bereich in der Anwendung.",
        "The knowledge cycle has four steps: capture, validate, use and keep up to date. Each step has its own area in the application.",
        "De kenniscyclus heeft vier stappen: vastleggen, valideren, gebruiken en actueel houden. Elke stap heeft een eigen onderdeel in de toepassing.",
      ),
      wie: T(
        "Erfasst wird unter „Wissen erfassen“, geprüft unter „Validierung“, genutzt in „Bibliothek“ und „Fragen“; aktuell gehalten wird über „Konflikte“ und den „Lebenszyklus“. Auf der Hilfeseite führt die Einstiegsführung durch den ersten Arbeitsweg.",
        "Capturing happens under “Capture Knowledge”, checking under “Validation”, using in “Library” and “Ask”; keeping up to date happens via “Conflicts” and the lifecycle. On the help page the guided start walks you through the first working path.",
        "Vastleggen gebeurt onder “Kennis vastleggen”, controleren onder “Validatie”, gebruiken in “Bibliotheek” en “Vragen”; actueel houden gebeurt via “Conflicten” en de levenscyclus. Op de helppagina leidt de startbegeleiding je door de eerste werkweg.",
      ),
      warum: T(
        "Erfassen allein reicht nicht: Wissen muss geprüft werden, damit man sich darauf stützen kann, und es veraltet, wenn sich etwas ändert. Der Kreis macht sichtbar, wo jeder Beitrag gerade steht.",
        "Capturing alone is not enough: knowledge has to be checked before anyone can rely on it, and it becomes outdated when something changes. The cycle shows where each contribution currently stands.",
        "Alleen vastleggen is niet genoeg: kennis moet worden gecontroleerd voordat je erop kunt bouwen, en ze veroudert als er iets verandert. De cyclus maakt zichtbaar waar elke bijdrage nu staat.",
      ),
      danach: T(
        "Für die erste halbe Stunde: die Einstiegsführung auf der Hilfeseite durchgehen, einen ersten Beitrag erfassen und eine Frage stellen. Mit Demodaten lässt sich alles gefahrlos ausprobieren, wenn jemand mit Verwaltungsrechten sie lädt.",
        "For your first half hour: go through the guided start on the help page, capture a first contribution and ask a question. With demo data everything can be tried out safely, if someone with administration rights loads it.",
        "Voor je eerste halfuur: de startbegeleiding op de helppagina doorlopen, een eerste bijdrage vastleggen en een vraag stellen. Met demogegevens kun je alles veilig uitproberen, als iemand met beheerrechten ze laadt.",
      ),
      missverstaendnisse: T(
        "„Man muss alles auf einmal machen.“ — Nein: fang bei dem an, was gerade ansteht. „Der Kreis läuft von selbst.“ — Nein: es startet nichts von selbst, jeder Schritt ist eine Handlung von Menschen.",
        "“You have to do everything at once.” — No: start with whatever is due. “The cycle runs by itself.” — No: nothing starts by itself, every step is an action by people.",
        "“Je moet alles tegelijk doen.” — Nee: begin met wat nu aan de beurt is. “De cyclus loopt vanzelf.” — Nee: er start niets vanzelf, elke stap is een handeling van mensen.",
      ),
    },
  },
  {
    id: "rollen-konten",
    gruppe: 0,
    route: "/profil",
    rollenausnahme: true,
    titel: T(
      "Rollen und Konten: wer was darf",
      "Roles and accounts: who may do what",
      "Rollen en accounts: wie wat mag",
    ),
    teile: {
      was: T(
        "Rollen legen fest, wer was darf: lesen und fragen (Rolle Betrachter), zusätzlich erfassen (Rolle Experte), zusätzlich prüfen, zuweisen und Widersprüche klären (Rolle Controller), zusätzlich Konten verwalten (Rolle Administrator).",
        "Roles define who may do what: read and ask (role Viewer), additionally capture (role Expert), additionally check, assign and settle contradictions (role Controller), additionally manage accounts (role Administrator).",
        "Rollen bepalen wie wat mag: lezen en vragen (rol Kijker), daarnaast vastleggen (rol Expert), daarnaast controleren, toewijzen en tegenstrijdigheden ophelderen (rol Controller), daarnaast accounts beheren (rol Administrator).",
      ),
      wie: T(
        "Welche Rolle du hast, steht im Profil neben deinem Namen. Die Oberfläche zeigt dir nur die Handlungen, die deine Rolle erlaubt. Konten legt an, wer Verwaltungsrechte hat — unter „Admin“ ein Konto erstellen und eine Rolle vergeben.",
        "Your role is shown in your profile next to your name. The interface shows you only the actions your role allows. Accounts are created by someone with administration rights — under “Admin”, create an account and assign a role.",
        "Welke rol je hebt, staat in je profiel naast je naam. De interface toont je alleen de handelingen die je rol toestaat. Accounts maakt aan wie beheerrechten heeft — onder “Admin” een account aanmaken en een rol toekennen.",
      ),
      warum: T(
        "Wer prüft, urteilt über die Beiträge anderer; das ist eine andere Verantwortung als erfassen. Getrennte Rollen machen sichtbar, wer wofür einsteht.",
        "Whoever checks judges other people’s contributions; that is a different responsibility from capturing. Separate roles make visible who stands for what.",
        "Wie controleert, oordeelt over de bijdragen van anderen; dat is een andere verantwoordelijkheid dan vastleggen. Gescheiden rollen maken zichtbaar wie waarvoor instaat.",
      ),
      danach: T(
        "Ändert sich deine Rolle, ändern sich die Bereiche und Knöpfe, die du siehst. Fehlt dir etwas, frag die Person, die bei euch Konten verwaltet.",
        "If your role changes, the areas and buttons you see change too. If something is missing, ask the person who manages accounts in your organisation.",
        "Verandert je rol, dan veranderen de onderdelen en knoppen die je ziet. Ontbreekt er iets, vraag het dan aan de persoon die bij jullie accounts beheert.",
      ),
      missverstaendnisse: T(
        "„Mir fehlt ein Knopf, das ist ein Fehler.“ — Meist liegt es an der Rolle oder an ausgeschalteten erweiterten Modulen. „Eine Rolle bewertet die Person.“ — Nein: sie regelt Rechte, nicht Leistung.",
        "“A button is missing for me, that is a bug.” — Usually it is down to the role or to extended modules being switched off. “A role rates the person.” — No: it governs rights, not performance.",
        "“Er ontbreekt een knop, dat is een fout.” — Meestal ligt het aan de rol of aan uitgeschakelde uitgebreide modules. “Een rol beoordeelt de persoon.” — Nee: ze regelt rechten, geen prestaties.",
      ),
    },
  },
  {
    id: "schreiben",
    gruppe: 1,
    route: "/erfassen",
    titel: T(
      "Frei erzählen, Struktur vorschlagen lassen, KI-Hilfe beim Schreiben",
      "Telling freely, getting a structure suggested, AI help with writing",
      "Vrij vertellen, structuur laten voorstellen, AI-hulp bij het schrijven",
    ),
    teile: {
      was: T(
        "Du schreibst dein Wissen so auf, wie du es einer neuen Kollegin erzählen würdest — unsortiert ist in Ordnung. Auf Wunsch schlägt die KI daraus eine Struktur vor und hilft beim Formulieren.",
        "You write your knowledge down the way you would tell a new colleague — unsorted is fine. If you want, the AI suggests a structure and helps with the wording.",
        "Je schrijft je kennis op zoals je het een nieuwe collega zou vertellen — ongeordend is prima. Desgewenst stelt de AI er een structuur voor en helpt ze bij het formuleren.",
      ),
      wie: T(
        "„Struktur vorschlagen“ liest den Rohtext und schlägt Titel, Kernaussage, Bedingungen und Maßnahmen vor — als Entwurf, violett gekennzeichnet. Ohne KI-Zugang arbeitet ein regelbasierter Ersatz und sagt das offen.",
        "Suggesting a structure reads the raw text and proposes title, core statement, conditions and measures — as a draft, marked in violet. Without AI access a rule-based substitute works and says so openly.",
        "Een structuur laten voorstellen leest de ruwe tekst en stelt titel, kernuitspraak, voorwaarden en maatregelen voor — als concept, paars gemarkeerd. Zonder AI-toegang werkt een regelgebaseerd alternatief en zegt dat eerlijk.",
      ),
      warum: T(
        "Ordnung soll nicht die Hürde sein, Wissen festzuhalten. Die Struktur ist deshalb ein Vorschlag — die Verantwortung für den Inhalt bleibt bei dir.",
        "Order should not be the hurdle to recording knowledge. The structure is therefore a suggestion — responsibility for the content stays with you.",
        "Orde mag geen drempel zijn om kennis vast te leggen. De structuur is daarom een voorstel — de verantwoordelijkheid voor de inhoud blijft bij jou.",
      ),
      danach: T(
        "Du prüfst den Vorschlag, änderst ihn und übernimmst nur, was stimmt. Gespeichert wird erst, wenn du es bewusst tust.",
        "You check the suggestion, change it and take over only what is right. Nothing is saved until you deliberately do so.",
        "Je controleert het voorstel, past het aan en neemt alleen over wat klopt. Er wordt pas opgeslagen als je dat bewust doet.",
      ),
      missverstaendnisse: T(
        "„Die KI verbessert auch meine Fakten.“ — Nein: sie soll klarer formulieren, ohne Fakten zu ändern; vergleiche Zahlen und Namen. „Was die KI schreibt, ist schon gespeichert.“ — Nein.",
        "“The AI also improves my facts.” — No: it should word things more clearly without changing facts; compare figures and names. “What the AI writes is already saved.” — No.",
        "“De AI verbetert ook mijn feiten.” — Nee: ze moet helderder formuleren zonder feiten te veranderen; vergelijk getallen en namen. “Wat de AI schrijft, is al opgeslagen.” — Nee.",
      ),
    },
  },
  {
    id: "diktieren",
    gruppe: 1,
    route: "/erfassen",
    titel: T(
      "Diktieren: sprechen statt tippen",
      "Dictating: speaking instead of typing",
      "Dicteren: spreken in plaats van typen",
    ),
    teile: {
      was: T(
        "Diktieren heißt sprechen statt tippen — etwa wenn die Hände an der Maschine, im Stall oder am Patientenbett gebraucht werden.",
        "Dictating means speaking instead of typing — for example when your hands are needed at the machine, in the barn or at a patient’s bed.",
        "Dicteren betekent spreken in plaats van typen — bijvoorbeeld als je handen nodig zijn bij de machine, in de stal of aan het bed van een patiënt.",
      ),
      wie: T(
        "Du startest und stoppst das Diktat bewusst. Dein Browser wandelt die Sprache in Text um, der ins Feld fließt; danach korrigierst du ihn wie getippten Text.",
        "You start and stop dictation deliberately. Your browser turns speech into text that goes into the field; afterwards you correct it like typed text.",
        "Je start en stopt het dicteren bewust. Je browser zet de spraak om in tekst die in het veld komt; daarna verbeter je die zoals getypte tekst.",
      ),
      warum: T(
        "Wer viel weiß, hat oft keine Zeit zum Tippen. Sprechen senkt die Hürde, Wissen überhaupt festzuhalten.",
        "People who know a lot often have no time to type. Speaking lowers the hurdle to recording knowledge at all.",
        "Wie veel weet, heeft vaak geen tijd om te typen. Spreken verlaagt de drempel om kennis überhaupt vast te leggen.",
      ),
      danach: T(
        "Der diktierte Text ist ein normaler Entwurfstext: Struktur vorschlagen lassen, prüfen, sichern, einreichen.",
        "The dictated text is a normal draft text: get a structure suggested, check it, save it, submit it.",
        "De gedicteerde tekst is een gewone concepttekst: structuur laten voorstellen, controleren, bewaren, indienen.",
      ),
      missverstaendnisse: T(
        "„Diktieren geht in jedem Browser.“ — Nein: kann der Browser keine Spracherkennung, sagt die App das offen, statt still zu scheitern. „Das Diktat wird sofort gespeichert.“ — Nein, wie jeder Text erst mit deinem Klick.",
        "“Dictation works in every browser.” — No: if the browser has no speech recognition, the app says so openly instead of failing silently. “The dictation is saved immediately.” — No, like any text only with your click.",
        "“Dicteren werkt in elke browser.” — Nee: heeft de browser geen spraakherkenning, dan zegt de app dat eerlijk in plaats van stil te falen. “Het dictaat wordt meteen opgeslagen.” — Nee, zoals elke tekst pas na jouw klik.",
      ),
    },
  },
  {
    id: "interview",
    gruppe: 1,
    route: "/erfassen",
    titel: T(
      "Das geführte Interview: warum die KI nachfragt",
      "The guided interview: why the AI asks follow-up questions",
      "Het begeleide interview: waarom de AI doorvraagt",
    ),
    teile: {
      was: T(
        "Im Wissens-Interview stellt dir die KI eine Frage nach der anderen und fragt gezielt nach — nach Grenzwerten, Ausnahmen und Gründen.",
        "In the knowledge interview the AI asks you one question after another and follows up specifically — on limits, exceptions and reasons.",
        "In het kennisinterview stelt de AI je de ene vraag na de andere en vraagt gericht door — naar grenswaarden, uitzonderingen en redenen.",
      ),
      wie: T(
        "Du startest es unter „Wissen erfassen“ im Werkzeug „Datei“. Du antwortest in eigenen Worten, getippt oder diktiert, und kannst dir die Frage vorlesen lassen. Wenn du das Interview abschließt, wird aus allen Antworten ein Entwurf gebaut.",
        "You start it under “Capture Knowledge” in the “File” tool. You answer in your own words, typed or dictated, and can have the question read aloud. When you finish the interview, a draft is built from all answers.",
        "Je start het onder “Kennis vastleggen” in het gereedschap “Bestand”. Je antwoordt in je eigen woorden, getypt of gedicteerd, en kunt de vraag laten voorlezen. Als je het interview afrondt, wordt uit alle antwoorden een concept gemaakt.",
      ),
      warum: T(
        "Erfahrungswissen wird erst durch Nachfragen brauchbar: aus „das Ventil rechtzeitig schließen“ wird mit „ab welchem Druck?“ eine Aussage, die man prüfen kann.",
        "Experience-based knowledge only becomes usable through follow-up questions: “close the valve in time” becomes a checkable statement with “from which pressure?”.",
        "Ervaringskennis wordt pas bruikbaar door door te vragen: “de klep op tijd sluiten” wordt met “vanaf welke druk?” een uitspraak die je kunt controleren.",
      ),
      danach: T(
        "Der Entwurf steht danach auf dem Blatt; du prüfst, ergänzt und reichst ein. Vor dem Abschluss ist nichts gespeichert.",
        "The draft then appears on the sheet; you check, add and submit. Nothing is saved before you finish.",
        "Het concept staat daarna op het blad; je controleert, vult aan en dient in. Voor het afronden is niets opgeslagen.",
      ),
      missverstaendnisse: T(
        "„Ich muss alle Fragen beantworten.“ — Nein: du kannst jederzeit beenden und mit dem Gesagten weiterarbeiten. „Ohne KI ist das Interview genauso.“ — Nein: ohne verbundene KI kommen bewusst einfache Standardfragen.",
        "“I have to answer every question.” — No: you can stop at any time and continue with what you have said. “Without AI the interview is the same.” — No: without a connected AI you deliberately get simple standard questions.",
        "“Ik moet alle vragen beantwoorden.” — Nee: je kunt altijd stoppen en verder werken met wat je hebt gezegd. “Zonder AI is het interview hetzelfde.” — Nee: zonder gekoppelde AI krijg je bewust eenvoudige standaardvragen.",
      ),
    },
  },
  {
    id: "wissensarten",
    gruppe: 1,
    route: "/erfassen",
    titel: T("Die fünf Wissensarten", "The five kinds of knowledge", "De vijf kennissoorten"),
    teile: {
      was: T(
        "Die Wissensart ordnet einen Beitrag ein. Zur Wahl stehen Intuition, Best Practice, Lernkurve, Technik und Negativwissen — etwa „das haben wir probiert, es funktioniert nicht, und zwar deshalb“.",
        "The kind of knowledge classifies a contribution. The choices are Intuition, Best practice, Learning curve, Technical and Negative knowledge — such as “we tried this, it does not work, and here is why”.",
        "De kennissoort deelt een bijdrage in. Je kiest uit Intuïtie, Best practice, Leercurve, Techniek en Negatieve kennis — bijvoorbeeld “dit hebben we geprobeerd, het werkt niet, en dit is waarom”.",
      ),
      wie: T(
        "Du wählst die Wissensart beim Erfassen in den erweiterten Angaben. Wenn du schwankst, nimm die naheliegendste — die Angabe ist freiwillig.",
        "You choose the kind of knowledge in the advanced details when capturing. If you are unsure, pick the most obvious one — the field is optional.",
        "Je kiest de kennissoort bij het vastleggen in de uitgebreide gegevens. Twijfel je, neem dan de meest voor de hand liggende — het veld is vrijwillig.",
      ),
      warum: T(
        "Die Art hilft Suchenden und Prüfenden, einen Beitrag richtig einzuordnen. Besonders Negativwissen geht sonst verloren, obwohl es der nächsten Schicht einen Fehlversuch erspart.",
        "The kind helps people searching and checking to classify a contribution correctly. Negative knowledge in particular is otherwise lost, although it saves the next shift a failed attempt.",
        "De soort helpt zoekers en controleurs een bijdrage juist in te delen. Vooral negatieve kennis gaat anders verloren, terwijl die de volgende ploeg een mislukte poging bespaart.",
      ),
      danach: T(
        "Die Wissensart steht am Eintrag und hilft beim Suchen und Filtern. Am Prüfweg ändert sie nichts.",
        "The kind of knowledge is shown on the entry and helps with searching and filtering. It changes nothing about the checking route.",
        "De kennissoort staat bij de vermelding en helpt bij zoeken en filteren. Aan de controleweg verandert ze niets.",
      ),
      missverstaendnisse: T(
        "„Eine falsche Wissensart sperrt meinen Beitrag.“ — Nein, sie ist eine Einordnung und jederzeit änderbar. „Was nicht funktioniert, muss man nicht aufschreiben.“ — Doch: genau das ist Negativwissen.",
        "“A wrong kind of knowledge blocks my contribution.” — No, it is a classification and can be changed at any time. “What does not work need not be written down.” — It must: that is exactly negative knowledge.",
        "“Een verkeerde kennissoort blokkeert mijn bijdrage.” — Nee, het is een indeling die altijd te wijzigen is. “Wat niet werkt, hoef je niet op te schrijven.” — Wel: dat is precies negatieve kennis.",
      ),
    },
  },
  {
    id: "quellen",
    gruppe: 1,
    route: "/erfassen",
    titel: T(
      "Quellen und Belege anhängen",
      "Attaching sources and evidence",
      "Bronnen en bewijzen toevoegen",
    ),
    teile: {
      was: T(
        "Quellen sind externe Belege für einen Beitrag — eine Norm, ein Handbuch, eine Herstellerseite. Dazu kommen Dokumente und Bilder als Anhänge, etwa ein Messprotokoll.",
        "Sources are external evidence for a contribution — a standard, a manual, a manufacturer page. In addition, documents and images can be attachments, such as a measurement report.",
        "Bronnen zijn externe bewijzen voor een bijdrage — een norm, een handleiding, een fabrikantenpagina. Daarnaast kunnen documenten en afbeeldingen bijlagen zijn, zoals een meetrapport.",
      ),
      wie: T(
        "Eine Quelle beschreibst du mit Bezeichnung, Link (leer bei Papier) und einem wörtlichen Auszug — oder findest sie über die Quellensuche und übernimmst sie mit „Anhängen“. Beim Erfassen sammeln sich Quellen in einer Warteliste und werden beim Einreichen angehängt.",
        "You describe a source with a label, a link (empty for paper) and a literal excerpt — or find it via the source search and take it over by attaching it. When capturing, sources collect in a waiting list and are attached on submission.",
        "Een bron beschrijf je met een benaming, een link (leeg bij papier) en een letterlijk fragment — of je vindt haar via het zoeken naar bronnen en neemt haar over door te koppelen. Bij het vastleggen verzamelen bronnen zich in een wachtlijst en worden ze bij het indienen gekoppeld.",
      ),
      warum: T(
        "Ein konkreter Auszug erspart Prüfenden, ein ganzes Dokument zu lesen. Belege machen sichtbar, worauf eine Aussage steht.",
        "A concrete excerpt spares the people checking from reading a whole document. Evidence shows what a statement rests on.",
        "Een concreet fragment bespaart controleurs het lezen van een heel document. Bewijzen maken zichtbaar waarop een uitspraak steunt.",
      ),
      danach: T(
        "Die Quelle steht am Wissensobjekt als Beleg und bleibt über Versionen erhalten. Ihr Inhalt wird nicht ins Wissen übernommen und nicht von selbst geprüft.",
        "The source stays on the knowledge object as evidence and is kept across versions. Its content is not taken into the knowledge and not checked automatically.",
        "De bron staat als bewijs bij het kennisobject en blijft over versies heen bewaard. De inhoud wordt niet in de kennis overgenomen en niet vanzelf gecontroleerd.",
      ),
      missverstaendnisse: T(
        "„Eine externe Quelle ersetzt eine Prüfung.“ — Nein: sie stützt die Aussage, zählt aber nicht als Freigabe durch Kolleginnen und Kollegen. „Das X löscht das Wissen.“ — Nein, es entfernt nur die Verknüpfung zur Quelle.",
        "“An external source replaces a check.” — No: it supports the statement but does not count as an approval by colleagues. “The X deletes the knowledge.” — No, it only removes the link to the source.",
        "“Een externe bron vervangt een controle.” — Nee: ze ondersteunt de uitspraak, maar telt niet als vrijgave door collega’s. “Het kruisje verwijdert de kennis.” — Nee, het verwijdert alleen de koppeling met de bron.",
      ),
    },
  },
  {
    id: "entwurf-einreichen",
    gruppe: 1,
    route: "/erfassen",
    titel: T(
      "Entwürfe sichern, wiederfinden, verwerfen — und einreichen",
      "Saving, finding and discarding drafts — and submitting",
      "Concepten bewaren, terugvinden, verwerpen — en indienen",
    ),
    teile: {
      was: T(
        "Ein Entwurf ist dein privater Zwischenstand. Mit dem Einreichen wird daraus ein Wissensobjekt, das andere sehen und prüfen.",
        "A draft is your private interim state. Submitting turns it into a knowledge object that others see and check.",
        "Een concept is je persoonlijke tussenstand. Met indienen wordt het een kennisobject dat anderen zien en controleren.",
      ),
      wie: T(
        "„Entwurf speichern“ sichert privat auf dem Server — auf jedem deiner Geräte fortsetzbar; du findest ihn unter „Mehr“ → Entwürfe und im Menü unter Meine Entwürfe. „Verwerfen“ betrifft nur die aktuelle Eingabe. „Prüfen & einreichen“ legt das Wissensobjekt an.",
        "Saving a draft stores it privately on the server — you can continue on any of your devices; you find it under “More” → drafts and in the menu under My drafts. Discarding affects only the current input. Checking and submitting creates the knowledge object.",
        "Een concept bewaren slaat het persoonlijk op de server op — je kunt op elk van je apparaten verder; je vindt het onder “Meer” → concepten en in het menu onder Mijn concepten. Verwerpen betreft alleen de huidige invoer. Controleren en indienen maakt het kennisobject aan.",
      ),
      warum: T(
        "Wissen entsteht selten in einem Zug. Der Entwurf gibt Zeit, ohne dass Halbfertiges schon als Wissen erscheint.",
        "Knowledge rarely comes about in one go. The draft gives time without anything half-finished already appearing as knowledge.",
        "Kennis ontstaat zelden in één keer. Het concept geeft tijd zonder dat iets half afs al als kennis verschijnt.",
      ),
      danach: T(
        "Nach dem Einreichen steht der Beitrag unter „Validierung“, für andere sichtbar und als in Prüfung gekennzeichnet. Du musst nichts weiter tun.",
        "After submitting, the contribution appears under “Validation”, visible to others and marked as being checked. You do not have to do anything else.",
        "Na het indienen staat de bijdrage onder “Validatie”, zichtbaar voor anderen en gemarkeerd als in controle. Je hoeft verder niets te doen.",
      ),
      missverstaendnisse: T(
        "„Ein gespeicherter Entwurf ist eingereicht.“ — Nein: nur du siehst ihn, er taucht in keiner Prüfung und keiner Antwort auf. „Verwerfen löscht auch meine alten Entwürfe.“ — Nein, gesicherte Entwürfe bleiben unberührt.",
        "“A saved draft has been submitted.” — No: only you see it, it appears in no check and no answer. “Discarding also deletes my old drafts.” — No, saved drafts stay untouched.",
        "“Een bewaard concept is ingediend.” — Nee: alleen jij ziet het, het verschijnt in geen enkele controle en geen enkel antwoord. “Verwerpen verwijdert ook mijn oude concepten.” — Nee, bewaarde concepten blijven onaangeroerd.",
      ),
    },
  },
  {
    id: "pruefen-organisieren",
    gruppe: 2,
    route: "/validierung",
    titel: T(
      "Wie viele Freigaben, und wer prüft",
      "How many approvals, and who checks",
      "Hoeveel vrijgaven, en wie controleert",
    ),
    teile: {
      was: T(
        "Ein Beitrag braucht eine festgelegte Zahl an Freigaben, bevor er validiert ist. Wer ihn prüft, kann beim Einreichen vorgeschlagen oder später zugewiesen werden.",
        "A contribution needs a set number of approvals before it is validated. Who checks it can be suggested when submitting or assigned later.",
        "Een bijdrage heeft een vastgelegd aantal vrijgaven nodig voordat ze gevalideerd is. Wie haar controleert, kan bij het indienen worden voorgesteld of later worden toegewezen.",
      ),
      wie: T(
        "Die Zahl legt eure Verwaltung fest, eine bis fünf; wie viele noch fehlen, steht an jeder Karte unter „Validierung“. Mit „Prüfer zuweisen“ bittest du eine bestimmte Person; sie sieht den Beitrag dann in ihrer Liste der ihr zugewiesenen Prüfungen und bekommt eine Benachrichtigung.",
        "Your administration sets the number, one to five; how many are still missing is shown on each card under “Validation”. Assigning a reviewer asks a specific person; that person then sees the contribution in their list of assigned checks and gets a notification.",
        "Het beheer legt het aantal vast, één tot vijf; hoeveel er nog ontbreken, staat op elke kaart onder “Validatie”. Met het toewijzen van een controleur vraag je een bepaalde persoon; die ziet de bijdrage dan in de lijst van toegewezen controles en krijgt een melding.",
      ),
      warum: T(
        "Mehrere unabhängige Urteile machen Wissen belastbar. Eine Zuweisung sorgt dafür, dass die passende Fachperson einen Beitrag nicht übersieht.",
        "Several independent judgements make knowledge reliable. An assignment ensures that the right specialist does not overlook a contribution.",
        "Meerdere onafhankelijke oordelen maken kennis betrouwbaar. Een toewijzing zorgt ervoor dat de juiste vakpersoon een bijdrage niet over het hoofd ziet.",
      ),
      danach: T(
        "Sind genug Freigaben da und steht keine Ablehnung dagegen, ist der Beitrag validiert. Eine geänderte Zahl gilt nur für neue Einreichungen.",
        "Once there are enough approvals and no rejection stands against it, the contribution is validated. A changed number applies only to new submissions.",
        "Zijn er genoeg vrijgaven en staat er geen afwijzing tegenover, dan is de bijdrage gevalideerd. Een gewijzigd aantal geldt alleen voor nieuwe inzendingen.",
      ),
      missverstaendnisse: T(
        "„Eine Zuweisung ist schon eine Bewertung.“ — Nein: sie ist eine Bitte und ändert weder Stand noch Vertrauen. „Nach einer Weile wird automatisch freigegeben.“ — Nein, es gibt keine Freigabe nach Zeitablauf.",
        "“An assignment is already a rating.” — No: it is a request and changes neither status nor confidence. “After a while it is approved automatically.” — No, there is no approval after a time limit.",
        "“Een toewijzing is al een beoordeling.” — Nee: het is een verzoek en verandert status noch vertrouwen. “Na een tijdje wordt automatisch vrijgegeven.” — Nee, er is geen vrijgave na verloop van tijd.",
      ),
    },
  },
  {
    id: "nacharbeit",
    gruppe: 2,
    route: "/validierung",
    titel: T("Rückfrage und Nacharbeit", "Queries and rework", "Vragen en nawerk"),
    teile: {
      was: T(
        "Kommt ein Beitrag mit einer Rückfrage oder einer Ablehnung zurück, beginnt die Nacharbeit: die Person, die ihn erfasst hat, überarbeitet ihn.",
        "If a contribution comes back with a query or a rejection, rework begins: the person who captured it revises it.",
        "Komt een bijdrage terug met een vraag of een afwijzing, dan begint het nawerk: de persoon die haar heeft vastgelegd, bewerkt haar.",
      ),
      wie: T(
        "Rückfrage und Ablehnung brauchen immer eine Begründung; sie steht als Kommentar am Wissensobjekt. Du liest sie, überarbeitest den Beitrag, und jede inhaltliche Änderung wird als neue Version festgehalten.",
        "A query and a rejection always need a reason; it is stored as a comment on the knowledge object. You read it, revise the contribution, and every change to the content is kept as a new version.",
        "Een vraag en een afwijzing hebben altijd een motivering nodig; die staat als opmerking bij het kennisobject. Je leest haar, bewerkt de bijdrage, en elke inhoudelijke wijziging wordt als nieuwe versie vastgelegd.",
      ),
      warum: T(
        "Ohne Begründung kann niemand lernen oder korrigieren. Die Rückfrage ist eine Hilfe an die Autorin, kein Urteil über sie.",
        "Without a reason nobody can learn or correct anything. The query is help for the author, not a verdict on her.",
        "Zonder motivering kan niemand leren of verbeteren. De vraag is hulp aan de auteur, geen oordeel over haar.",
      ),
      danach: T(
        "Nach der Überarbeitung geht der Beitrag wieder in die Prüfung; überarbeitete Beiträge sind dort als neue Version erkennbar.",
        "After revision the contribution goes back into checking; revised contributions are recognisable there as a new version.",
        "Na de bewerking gaat de bijdrage weer in controle; bewerkte bijdragen zijn daar herkenbaar als nieuwe versie.",
      ),
      missverstaendnisse: T(
        "„Eine Rückfrage ist eine Ablehnung.“ — Nein: das Wissen gilt als brauchbar, es fehlt nur etwas. „Ablehnen löscht den Beitrag.“ — Nein: er bleibt sichtbar in Prüfung.",
        "“A query is a rejection.” — No: the knowledge counts as usable, something is just missing. “Rejecting deletes the contribution.” — No: it stays visible while being checked.",
        "“Een vraag is een afwijzing.” — Nee: de kennis geldt als bruikbaar, er ontbreekt alleen iets. “Afwijzen verwijdert de bijdrage.” — Nee: ze blijft zichtbaar in controle.",
      ),
    },
  },
  {
    id: "vertrauen-status",
    gruppe: 3,
    route: "/bibliothek",
    titel: T(
      "Vertrauenswert, Stand und Reife",
      "Confidence value, status and maturity",
      "Vertrouwenswaarde, status en rijpheid",
    ),
    teile: {
      was: T(
        "Jeder Eintrag trägt einen Stand und einen Vertrauenswert. Die Reife fasst das in drei Stufen zusammen: Zu prüfen, In Prüfung, Nutzbar.",
        "Every entry carries a status and a confidence value. Maturity sums this up in three levels: to be checked, being checked, usable.",
        "Elke vermelding heeft een status en een vertrouwenswaarde. De rijpheid vat dat samen in drie niveaus: te controleren, in beoordeling, bruikbaar.",
      ),
      wie: T(
        "Der Vertrauenswert entsteht aus den Bewertungen der Kolleginnen und Kollegen und aus der Bewährung im Einsatz: Freigaben heben ihn, Vorbehalte senken ihn, „Hat geholfen“ stärkt ihn ein Stück. In der Bibliothek kannst du nach Reife filtern und sortieren.",
        "The confidence value comes from colleagues’ ratings and from proven use: approvals raise it, reservations lower it, marking it as helpful strengthens it a little. In the library you can filter and sort by maturity.",
        "De vertrouwenswaarde ontstaat uit de beoordelingen van collega’s en uit gebleken gebruik: vrijgaven verhogen haar, voorbehouden verlagen haar, aangeven dat het hielp versterkt haar een beetje. In de bibliotheek kun je filteren en sorteren op rijpheid.",
      ),
      warum: T(
        "Eine einzelne Zahl sagt nie alles. Stand, Vertrauenswert, Belege und Hinweise zusammen ergeben ein ehrliches Bild, wie belastbar eine Aussage gerade ist.",
        "A single number never tells the whole story. Status, confidence value, evidence and notes together give an honest picture of how reliable a statement is right now.",
        "Eén getal zegt nooit alles. Status, vertrouwenswaarde, bewijzen en opmerkingen samen geven een eerlijk beeld van hoe betrouwbaar een uitspraak nu is.",
      ),
      danach: T(
        "Steht ein offener Widerspruch an einem validierten Eintrag, wird seine Nutzbarkeit vorsichtig gekennzeichnet, bis Menschen ihn geklärt haben.",
        "If an open contradiction is attached to a validated entry, its usability is marked cautiously until people have resolved it.",
        "Staat er een open tegenspraak bij een gevalideerde vermelding, dan wordt de bruikbaarheid voorzichtig gemarkeerd tot mensen haar hebben opgehelderd.",
      ),
      missverstaendnisse: T(
        "„Ein hoher Wert heißt: garantiert richtig.“ — Nein: er ist eine Einordnung, keine Wahrheitsgarantie. „Hat geholfen ist eine Freigabe.“ — Nein: es ist ein Bewährungssignal, keine Prüfstimme.",
        "“A high value means guaranteed correct.” — No: it is a classification, not a guarantee of truth. “Marking as helpful is an approval.” — No: it is a signal of proven use, not a checking vote.",
        "“Een hoge waarde betekent gegarandeerd juist.” — Nee: het is een indeling, geen garantie op waarheid. “Aangeven dat het hielp is een vrijgave.” — Nee: het is een signaal van gebleken gebruik, geen controlestem.",
      ),
    },
  },
  {
    id: "vertraulichkeit-export",
    gruppe: 3,
    route: "/bibliothek",
    rollenausnahme: true,
    titel: T(
      "Vertraulichkeit und Export",
      "Confidentiality and export",
      "Vertrouwelijkheid en export",
    ),
    teile: {
      was: T(
        "Einträge können als vertraulich oder streng vertraulich markiert sein. Der Export aus der Bibliothek nimmt Wissen als Datei mit — als JSON, Markdown, MediaWiki-Text oder HTML.",
        "Entries can be marked confidential or strictly confidential. Exporting from the library takes knowledge along as a file — as JSON, Markdown, MediaWiki text or HTML.",
        "Vermeldingen kunnen als vertrouwelijk of strikt vertrouwelijk gemarkeerd zijn. Export uit de bibliotheek neemt kennis mee als bestand — als JSON, Markdown, MediaWiki-tekst of HTML.",
      ),
      wie: T(
        "Exportiert wird über das Menü „…“ über der Liste in der Bibliothek, und nur validiertes Wissen. Vertrauliche Einträge nimmt nur mit, wer die Rolle Administrator oder Controller hat; bei allen anderen bleiben sie draußen.",
        "You export via the “…” menu above the list in the library, and only validated knowledge. Confidential entries are only taken along by someone with the role Administrator or Controller; for everyone else they stay out.",
        "Exporteren gaat via het menu “…” boven de lijst in de bibliotheek, en alleen gevalideerde kennis. Vertrouwelijke vermeldingen neemt alleen mee wie de rol Administrator of Controller heeft; bij alle anderen blijven ze erbuiten.",
      ),
      warum: T(
        "Ein Export verlässt die Anwendung; dort greift kein Schutz mehr. Deshalb ist die Grenze für vertrauliches Wissen an genau dieser Stelle gezogen.",
        "An export leaves the application; no protection applies there any more. That is why the line for confidential knowledge is drawn exactly at this point.",
        "Een export verlaat de toepassing; daar geldt geen bescherming meer. Daarom ligt de grens voor vertrouwelijke kennis precies op dit punt.",
      ),
      danach: T(
        "Jeder ausgelieferte Export wird festgehalten: wer, welches Format, welche Einträge.",
        "Every export that is delivered is recorded: who, which format, which entries.",
        "Elke geleverde export wordt vastgelegd: wie, welk formaat, welke vermeldingen.",
      ),
      missverstaendnisse: T(
        "„Wer lesen darf, darf auch exportieren.“ — Nein: lesen dürfen alle, vertrauliche Einträge exportieren nur die genannten Rollen. „Es gibt einen PDF-Export.“ — Nein, PDF ist nicht dabei.",
        "“Anyone who may read may also export.” — No: everyone may read, but only the roles named export confidential entries. “There is a PDF export.” — No, PDF is not included.",
        "“Wie mag lezen, mag ook exporteren.” — Nee: iedereen mag lezen, maar alleen de genoemde rollen exporteren vertrouwelijke vermeldingen. “Er is een pdf-export.” — Nee, pdf zit er niet bij.",
      ),
    },
  },
  {
    id: "wissensobjekt",
    gruppe: 4,
    route: "/bibliothek",
    titel: T(
      "Das Wissensobjekt lesen: Herkunft und Versionen",
      "Reading a knowledge object: origin and versions",
      "Een kennisobject lezen: herkomst en versies",
    ),
    teile: {
      was: T(
        "Das Wissensobjekt ist die kleinste Einheit: eine klare Aussage mit Bedingungen, Maßnahmen, Belegen, Herkunft und Stand — etwa „Welche Frist gilt bei der Schankgenehmigung?“.",
        "The knowledge object is the smallest unit: a clear statement with conditions, measures, evidence, origin and status — such as “Which deadline applies to the alcohol licence?”.",
        "Het kennisobject is de kleinste eenheid: een heldere uitspraak met voorwaarden, maatregelen, bewijzen, herkomst en status — bijvoorbeeld “Welke termijn geldt voor de drankvergunning?”.",
      ),
      wie: T(
        "Aussage, Stand und Quelle stehen oben. Hinter „Mehr“ liegen Quellen und Anhänge, die Herkunft — wer es erfasst hat und wie es entstanden ist —, Versionen, Verlauf, Kommentare und gemeldete Widersprüche.",
        "Statement, status and source are at the top. Behind “More” are sources and attachments, the origin — who captured it and how it came about —, versions, history, comments and reported contradictions.",
        "Uitspraak, status en bron staan bovenaan. Achter “Meer” staan bronnen en bijlagen, de herkomst — wie het heeft vastgelegd en hoe het is ontstaan —, versies, historie, opmerkingen en gemelde tegenstrijdigheden.",
      ),
      warum: T(
        "Vertrauen braucht einen nachvollziehbaren Weg: wer es gesagt hat, worauf es steht und was sich seitdem geändert hat.",
        "Confidence needs a traceable path: who said it, what it rests on and what has changed since.",
        "Vertrouwen heeft een navolgbare weg nodig: wie het zei, waarop het steunt en wat er sindsdien is veranderd.",
      ),
      danach: T(
        "Jede inhaltliche Änderung erzeugt eine neue Version; ältere Stände bleiben erhalten. Wird ein Eintrag übertragen, bleibt die ursprüngliche Person als Herkunft sichtbar.",
        "Every change to the content creates a new version; older states are kept. If an entry is transferred, the original person stays visible as its origin.",
        "Elke inhoudelijke wijziging maakt een nieuwe versie; oudere standen blijven bewaard. Wordt een vermelding overgedragen, dan blijft de oorspronkelijke persoon zichtbaar als herkomst.",
      ),
      missverstaendnisse: T(
        "„Eine Änderung überschreibt den alten Text.“ — Nein: nichts wird still überschrieben. „Wer ihn weiterpflegt, gilt als Urheber.“ — Nein: die Herkunft bleibt dauerhaft sichtbar.",
        "“A change overwrites the old text.” — No: nothing is silently overwritten. “Whoever maintains it counts as its author.” — No: the origin stays visible permanently.",
        "“Een wijziging overschrijft de oude tekst.” — Nee: er wordt niets stil overschreven. “Wie het onderhoudt, geldt als maker.” — Nee: de herkomst blijft blijvend zichtbaar.",
      ),
    },
  },
  {
    id: "wissensluecke",
    gruppe: 5,
    route: "/risiko",
    titel: T(
      "Die Wissenslücke — und wie man sie schließt",
      "The knowledge gap — and how to close it",
      "Het kennishiaat — en hoe je het sluit",
    ),
    teile: {
      was: T(
        "Eine Wissenslücke entsteht, wenn zu einer Frage kein passendes Wissen vorliegt. Sie ist eine ehrliche Auskunft, kein Fehler.",
        "A knowledge gap arises when there is no suitable knowledge for a question. It is an honest statement, not an error.",
        "Een kennishiaat ontstaat als er voor een vraag geen passende kennis is. Het is een eerlijke mededeling, geen fout.",
      ),
      wie: T(
        "Offene Lücken stehen unter „Risiko & Lücken“. Dort schätzt du die Dringlichkeit ein, weist eine Lücke einer Fachperson zu oder schließt sie selbst mit „Wissen erfassen“.",
        "Open gaps are listed under “Risk & Gaps”. There you assess the urgency, assign a gap to a specialist or close it yourself with “Capture Knowledge”.",
        "Open hiaten staan onder “Risico & hiaten”. Daar schat je de urgentie in, wijs je een hiaat toe aan een vakpersoon of sluit je het zelf met “Kennis vastleggen”.",
      ),
      warum: T(
        "Ein System, das an dieser Stelle trotzdem flüssig antwortet, rät. Eine sichtbare Lücke zeigt dagegen genau, wo Wissen fehlt, bevor es gebraucht wird.",
        "A system that answers fluently at this point anyway is guessing. A visible gap, by contrast, shows exactly where knowledge is missing before it is needed.",
        "Een systeem dat op dit punt toch vlot antwoordt, gokt. Een zichtbaar hiaat toont daarentegen precies waar kennis ontbreekt, voordat die nodig is.",
      ),
      danach: T(
        "Das neu erfasste Wissen läuft durch die normale Prüfung; danach gibt es zur selben Frage eine belegte Antwort statt der Lücke.",
        "The newly captured knowledge goes through the normal checking; afterwards the same question gets an answer backed by evidence instead of the gap.",
        "De nieuw vastgelegde kennis gaat door de normale controle; daarna krijgt dezelfde vraag een onderbouwd antwoord in plaats van het hiaat.",
      ),
      missverstaendnisse: T(
        "„Keine Antwort heißt, die App ist kaputt.“ — Nein. „Das Wissen gibt es doch.“ — Vielleicht ist es noch nicht erfasst, noch nicht geprüft oder benutzt andere Wörter; dann hilft umformulieren oder ergänzen.",
        "“No answer means the app is broken.” — No. “But the knowledge exists.” — Perhaps it has not been captured or checked yet, or it uses different words; then rephrasing or adding helps.",
        "“Geen antwoord betekent dat de app kapot is.” — Nee. “Maar de kennis bestaat toch.” — Misschien is ze nog niet vastgelegd of gecontroleerd, of gebruikt ze andere woorden; dan helpt herformuleren of aanvullen.",
      ),
    },
  },
  // Nacharbeit 7 (Ben, B5-6): am Quelltext abgeglichen — `pages/Ask.tsx` `buildExport`,
  // `copyAnswer`, `downloadAnswer`, `printAnswer`; Knopf „Kopieren“ unter der Antwortkarte, „Als
  // Markdown“ und „Drucken / PDF“ im „…“-Menü der Karte („Mehr zu dieser Antwort“).
  {
    id: "antwort-weitergeben",
    gruppe: 5,
    route: "/fragen",
    titel: T(
      "Eine Antwort weitergeben: kopieren, als Markdown speichern, drucken",
      "Passing on an answer: copy, save as Markdown, print",
      "Een antwoord doorgeven: kopiëren, als Markdown opslaan, afdrukken",
    ),
    teile: {
      was: T(
        "Eine beantwortete Frage lässt sich samt ihren Quellen mitnehmen — etwa, um einer Kollegin die Antwort in eine E-Mail zu kopieren oder sie für eine Besprechung auszudrucken.",
        "An answered question can be taken along together with its sources — for instance to copy the answer into an email for a colleague or to print it for a meeting.",
        "Een beantwoorde vraag kun je samen met de bronnen meenemen — bijvoorbeeld om het antwoord in een e-mail voor een collega te kopiëren of het voor een overleg af te drukken.",
      ),
      wie: T(
        "Unter der Antwort steht „Kopieren“: es legt die Antwort mit Frage, Einstufung, Quellen und KI-Kennzeichnung in die Zwischenablage. Das „…“ oben rechts in der Antwortkarte („Mehr zu dieser Antwort“) bietet „Als Markdown“ — eine Textdatei zum Speichern — und „Drucken / PDF“, das nur die Antwort druckt.",
        "Below the answer is “Copy”: it puts the answer with question, rating, sources and AI label on the clipboard. The “…” at the top right of the answer card (“More about this answer”) offers “As Markdown” — a text file to save — and “Print / PDF”, which prints only the answer.",
        "Onder het antwoord staat “Kopiëren”: dat zet het antwoord met vraag, inschaling, bronnen en AI-vermelding op het klembord. De “…” rechtsboven in de antwoordkaart (“Meer over dit antwoord”) biedt “Als Markdown” — een tekstbestand om op te slaan — en “Afdrukken / PDF”, dat alleen het antwoord afdrukt.",
      ),
      warum: T(
        "Eine Antwort ist nur so belastbar wie ihre Quellen. Darum reisen Einstufung und Quellen mit, und am Ende steht, dass die Antwort von künstlicher Intelligenz erzeugt wurde und inhaltlich zu prüfen ist — auch dort, wo Klarwerk nicht mehr zu sehen ist.",
        "An answer is only as reliable as its sources. That is why rating and sources travel with it, and at the end it says that the answer was produced by artificial intelligence and must be checked for content — even where Klarwerk is no longer in view.",
        "Een antwoord is maar zo betrouwbaar als zijn bronnen. Daarom reizen inschaling en bronnen mee, en aan het eind staat dat het antwoord door kunstmatige intelligentie is gemaakt en inhoudelijk moet worden gecontroleerd — ook waar Klarwerk niet meer te zien is.",
      ),
      danach: T(
        "Was du kopiert oder gespeichert hast, liegt bei dir: du entscheidest, wo du es einfügst und wem du es gibst. Klarwerk verschickt nichts von selbst.",
        "What you copied or saved is in your hands: you decide where to paste it and whom to give it to. Klarwerk sends nothing on its own.",
        "Wat je hebt gekopieerd of opgeslagen, ligt bij jou: jij beslist waar je het plakt en aan wie je het geeft. Klarwerk verstuurt niets uit zichzelf.",
      ),
      missverstaendnisse: T(
        "„Weitergeben schickt die Antwort an jemanden.“ — Nein: es gibt keinen Versand, du fügst sie selbst ein. „Die Kopie klingt sicherer als der Bildschirm.“ — Nein: sie trägt dieselbe Einstufung wie die Seite, samt Vorbehalt. „Weitergeben geht immer.“ — Nur bei einer beantworteten Frage; ohne Antwort gibt es nichts zu kopieren.",
        "“Passing it on sends the answer to someone.” — No: there is no sending, you paste it yourself. “The copy sounds more certain than the screen.” — No: it carries the same rating as the page, including any reservation. “Passing it on always works.” — Only for an answered question; without an answer there is nothing to copy.",
        "“Doorgeven stuurt het antwoord naar iemand.” — Nee: er wordt niets verstuurd, je plakt het zelf. “De kopie klinkt zekerder dan het scherm.” — Nee: ze draagt dezelfde inschaling als de pagina, met eventueel voorbehoud. “Doorgeven kan altijd.” — Alleen bij een beantwoorde vraag; zonder antwoord valt er niets te kopiëren.",
      ),
    },
  },
  {
    id: "konflikt-wege",
    gruppe: 6,
    route: "/konflikte",
    titel: T(
      "Einen Widerspruch bearbeiten: Zweitmeinung, Eskalieren, Auflösen",
      "Working on a contradiction: second opinion, escalate, resolve",
      "Een tegenspraak behandelen: tweede mening, escaleren, oplossen",
    ),
    teile: {
      was: T(
        "Für einen offenen Widerspruch gibt es drei Wege: eine Zweitmeinung einholen, eskalieren oder auflösen.",
        "There are three routes for an open contradiction: get a second opinion, escalate or resolve.",
        "Voor een open tegenspraak zijn er drie wegen: een tweede mening vragen, escaleren of oplossen.",
      ),
      wie: T(
        "Die Zweitmeinung hält die Einschätzung einer weiteren Fachperson schriftlich fest. Eskalieren hebt den Fall eine Stufe höher, wenn die Beteiligten ihn nicht selbst klären können. Auflösen hält fest, welche Aussage gilt, unter welchen Bedingungen und warum.",
        "The second opinion records another specialist’s assessment in writing. Escalating raises the case one level when those involved cannot clear it up themselves. Resolving records which statement applies, under which conditions and why.",
        "De tweede mening legt de inschatting van een andere vakpersoon schriftelijk vast. Escaleren tilt de zaak een niveau hoger als de betrokkenen haar niet zelf kunnen ophelderen. Oplossen legt vast welke uitspraak geldt, onder welke voorwaarden en waarom.",
      ),
      warum: T(
        "Wer recht hat, entscheiden Menschen — und eine Entscheidung soll nachvollziehbar sein, nicht nur ein Ergebnis.",
        "People decide who is right — and a decision should be traceable, not just an outcome.",
        "Mensen beslissen wie gelijk heeft — en een beslissing moet navolgbaar zijn, niet alleen een uitkomst.",
      ),
      danach: T(
        "Die Auflösung dokumentiert nur; sie ändert keinen der beteiligten Einträge. Soll einer überarbeitet werden, bleibt das eine bewusste Handlung.",
        "Resolving only documents; it changes none of the entries involved. If one should be revised, that remains a deliberate action.",
        "Oplossen documenteert alleen; het verandert geen van de betrokken vermeldingen. Moet er een worden bewerkt, dan blijft dat een bewuste handeling.",
      ),
      missverstaendnisse: T(
        "„Die Zweitmeinung entscheidet den Fall.“ — Nein: sie ist Material für die Auflösung. „Eskalieren schließt den Widerspruch.“ — Nein: er bleibt offen, bis eine Entscheidung festgehalten ist.",
        "“The second opinion decides the case.” — No: it is material for resolving. “Escalating closes the contradiction.” — No: it stays open until a decision is recorded.",
        "“De tweede mening beslist de zaak.” — Nee: ze is materiaal voor het oplossen. “Escaleren sluit de tegenspraak.” — Nee: ze blijft open tot een beslissing is vastgelegd.",
      ),
    },
  },
  {
    id: "protokoll",
    gruppe: 6,
    route: "/analytics",
    titel: T(
      "Das Prüfprotokoll: was festgehalten wird",
      "The audit log: what is recorded",
      "Het controlelogboek: wat wordt vastgelegd",
    ),
    teile: {
      was: T(
        "Das Prüfprotokoll hält sicherheitsrelevante Vorgänge fest — etwa Freigaben, Änderungen von Einstellungen oder einen Export.",
        "The audit log records security-relevant events — such as approvals, changes to settings or an export.",
        "Het controlelogboek legt beveiligingsrelevante gebeurtenissen vast — zoals vrijgaven, wijzigingen van instellingen of een export.",
      ),
      wie: T(
        "Jeder Eintrag wird nur angefügt und über eine Hash-Kette mit dem vorherigen verbunden. Wird ein Eintrag nachträglich geändert oder entfernt, passt sein Hash nicht mehr, und die Abweichung ist rechnerisch feststellbar.",
        "Every entry is only appended and linked to the previous one via a hash chain. If an entry is later changed or removed, its hash no longer matches, and the deviation can be detected by calculation.",
        "Elke vermelding wordt alleen toegevoegd en via een hashketen met de vorige verbonden. Wordt een vermelding achteraf gewijzigd of verwijderd, dan klopt haar hash niet meer en is de afwijking rekenkundig vast te stellen.",
      ),
      warum: T(
        "Nachvollziehbarkeit ist die Grundlage für Vertrauen: man soll sehen können, wer wann was getan hat.",
        "Traceability is the basis for confidence: it should be possible to see who did what and when.",
        "Navolgbaarheid is de basis voor vertrouwen: je moet kunnen zien wie wanneer wat heeft gedaan.",
      ),
      danach: T(
        "Unter „Analytics & Audit“ lässt sich das Protokoll nach Art des Vorgangs und nach handelnder Person filtern.",
        "Under “Analytics & Audit” the log can be filtered by type of event and by acting person.",
        "Onder “Analytics & Audit” kun je het logboek filteren op soort gebeurtenis en op handelende persoon.",
      ),
      missverstaendnisse: T(
        "„Das Protokoll verhindert jede Änderung.“ — Nein: es hält eine Änderung nicht auf, es macht sie auffällig. Wer vollen Schreibzugriff auf die Datenbank hat, kann eine Kette neu bilden — die Kette hat keinen extern verankerten Kopf.",
        "“The log prevents any change.” — No: it does not stop a change, it makes it noticeable. Anyone with full write access to the database can rebuild a chain — the chain has no externally anchored head.",
        "“Het logboek voorkomt elke wijziging.” — Nee: het houdt een wijziging niet tegen, het maakt haar opvallend. Wie volledige schrijftoegang tot de database heeft, kan een keten opnieuw opbouwen — de keten heeft geen extern verankerd begin.",
      ),
    },
  },
  {
    id: "loeschen",
    gruppe: 6,
    route: "/bibliothek",
    titel: T(
      "Löschen und Papierkorb",
      "Deleting and the recycle bin",
      "Verwijderen en de prullenbak",
    ),
    teile: {
      was: T(
        "Ein Wissensobjekt kann gelöscht werden — von der Person, die es erfasst hat, und von Personen mit Prüf- oder Verwaltungsrechten.",
        "A knowledge object can be deleted — by the person who captured it and by people with checking or administration rights.",
        "Een kennisobject kan worden verwijderd — door de persoon die het heeft vastgelegd en door personen met controle- of beheerrechten.",
      ),
      wie: T(
        "Vor dem Löschen fragt die App bewusst nach. Gelöschte Beiträge landen im Papierkorb und bleiben dort 30 Tage wiederherstellbar; danach werden sie endgültig gelöscht. Demodaten werden immer sofort endgültig gelöscht.",
        "The app deliberately asks before deleting. Deleted contributions go to the recycle bin and can be restored there for 30 days; after that they are deleted permanently. Demo data is always deleted permanently straight away.",
        "Voor het verwijderen vraagt de app bewust om bevestiging. Verwijderde bijdragen komen in de prullenbak en zijn daar 30 dagen te herstellen; daarna worden ze definitief verwijderd. Demogegevens worden altijd meteen definitief verwijderd.",
      ),
      warum: T(
        "Ein Versehen soll sich korrigieren lassen, ohne dass Gelöschtes für immer im Bestand liegt.",
        "A mistake should be correctable without deleted material staying in the stock forever.",
        "Een vergissing moet te herstellen zijn zonder dat verwijderd materiaal voor altijd in de voorraad blijft.",
      ),
      danach: T(
        "Die Löschung steht im Protokoll. Wiederherstellen ist innerhalb der Frist im Papierkorb möglich.",
        "The deletion is recorded in the log. Restoring is possible in the recycle bin within the time limit.",
        "De verwijdering staat in het logboek. Herstellen kan binnen de termijn in de prullenbak.",
      ),
      missverstaendnisse: T(
        "„Veraltetes Wissen löscht man am besten.“ — Meist ist überarbeiten oder ein gemeldeter Widerspruch der ehrlichere Weg. „Gelöscht ist sofort weg.“ — Nein: 30 Tage lang lässt es sich wiederherstellen.",
        "“Outdated knowledge is best deleted.” — Usually revising it or reporting a contradiction is the more honest route. “Deleted means gone immediately.” — No: it can be restored for 30 days.",
        "“Verouderde kennis verwijder je het best.” — Meestal is bewerken of een gemelde tegenspraak de eerlijkere weg. “Verwijderd is meteen weg.” — Nee: 30 dagen lang is het te herstellen.",
      ),
    },
  },
  {
    id: "ki-datenschutz",
    gruppe: 7,
    route: "/hilfe",
    titel: T(
      "Interne und externe KI, Arbeiten ohne KI, Datenschutz",
      "In-house and external AI, working without AI, data protection",
      "Interne en externe AI, werken zonder AI, gegevensbescherming",
    ),
    teile: {
      was: T(
        "KI kann bei euch im Haus laufen oder als externer Cloud-Dienst. Ist keine KI verbunden, arbeitet die App regelbasiert weiter.",
        "AI can run in-house or as an external cloud service. If no AI is connected, the app keeps working rule-based.",
        "AI kan intern draaien of als externe clouddienst. Is er geen AI gekoppeld, dan werkt de app regelgebaseerd verder.",
      ),
      wie: T(
        "Das Info-Zeichen neben einem KI-Knopf nennt die Aufgabe, die eingestellte KI und die Datenschutz-Einordnung: „DSGVO-konform“ heißt, die Verarbeitung bleibt bei euch; „Externe Verarbeitung“ heißt, die Inhalte der Aufgabe gehen an den Anbieter. Zugangsschlüssel liegen nur auf dem Server.",
        "The info sign next to an AI button names the task, the configured AI and the data protection classification: “GDPR-compliant” means processing stays with you; “External processing” means the task’s content goes to the provider. Access keys are kept only on the server.",
        "Het info-teken naast een AI-knop noemt de taak, de ingestelde AI en de indeling voor gegevensbescherming: “AVG-conform” betekent dat de verwerking bij jullie blijft; “Externe verwerking” betekent dat de inhoud van de taak naar de aanbieder gaat. Toegangssleutels staan alleen op de server.",
      ),
      warum: T(
        "Du sollst nie raten müssen, ob Inhalte das Haus verlassen. Die Einordnung steht genau an der Stelle, an der du klickst.",
        "You should never have to guess whether content leaves the organisation. The classification is shown exactly where you click.",
        "Je moet nooit hoeven raden of inhoud het huis verlaat. De indeling staat precies op de plek waar je klikt.",
      ),
      danach: T(
        "Ohne KI kommen einfachere Vorschläge und Standardfragen, klar gekennzeichnet. Datenschutz bleibt auch Betreibersache: der Vertrag mit einem Cloud-Anbieter und die Abläufe für Betroffenenrechte liegen bei eurer Organisation.",
        "Without AI you get simpler suggestions and standard questions, clearly labelled. Data protection is also the operator’s responsibility: the contract with a cloud provider and the procedures for data subject rights lie with your organisation.",
        "Zonder AI krijg je eenvoudigere voorstellen en standaardvragen, duidelijk gemarkeerd. Gegevensbescherming is ook een zaak van de beheerder: het contract met een cloudaanbieder en de procedures voor rechten van betrokkenen liggen bij jullie organisatie.",
      ),
      missverstaendnisse: T(
        "„Die App täuscht ohne KI dieselbe Leistung vor.“ — Nein: sie sagt offen, dass sie regelbasiert arbeitet. „DSGVO-Konformität erledigt die Software allein.“ — Nein: sie sichert technisch viel zu, der Rest ist Betreibersache.",
        "“Without AI the app pretends to perform the same.” — No: it says openly that it works rule-based. “GDPR compliance is handled by the software alone.” — No: it secures a lot technically, the rest is the operator’s responsibility.",
        "“Zonder AI doet de app alsof ze hetzelfde kan.” — Nee: ze zegt eerlijk dat ze regelgebaseerd werkt. “AVG-conformiteit regelt de software alleen.” — Nee: technisch borgt ze veel, de rest is een zaak van de beheerder.",
      ),
    },
  },
  {
    id: "verwaltung-einstellungen",
    gruppe: 8,
    route: "/admin",
    titel: T(
      "KI-Verwaltung, Einstellungen und Bereitschaft",
      "AI administration, settings and readiness",
      "AI-beheer, instellingen en gereedheid",
    ),
    teile: {
      was: T(
        "Unter „Admin“ stellt ein, wer Verwaltungsrechte hat: welche KI für welche Aufgabe arbeitet, wie viele Freigaben ein Beitrag braucht, die Grenzen für Uploads und die Stufe der externen Wissensabfrage. Eine Bereitschafts-Übersicht zeigt, was steht und was fehlt.",
        "Under “Admin”, someone with administration rights configures which AI works for which task, how many approvals a contribution needs, the upload limits and the level of external knowledge search. A readiness overview shows what is in place and what is missing.",
        "Onder “Admin” stelt wie beheerrechten heeft in welke AI voor welke taak werkt, hoeveel vrijgaven een bijdrage nodig heeft, de grenzen voor uploads en het niveau van extern zoeken naar kennis. Een gereedheidsoverzicht toont wat er staat en wat ontbreekt.",
      ),
      wie: T(
        "Die KI wählst du global oder je Einsatz: „Auto“ nutzt das Modell, wenn ein Schlüssel hinterlegt ist, „Deterministisch“ arbeitet bewusst ohne Modell. Die Freigabezahl liegt zwischen eins und fünf; die externe Abfrage hat vier Stufen von gesperrt bis offen.",
        "You choose the AI globally or per use: “Auto” uses the model if a key is stored, “Deterministic” deliberately works without a model. The number of approvals lies between one and five; external search has four levels from blocked to open.",
        "Je kiest de AI globaal of per inzet: “Auto” gebruikt het model als er een sleutel is opgeslagen, “Deterministisch” werkt bewust zonder model. Het aantal vrijgaven ligt tussen één en vijf; extern zoeken heeft vier niveaus van geblokkeerd tot open.",
      ),
      warum: T(
        "Jede dieser Einstellungen verändert, wie die Organisation arbeitet. Deshalb sind sie an einer Stelle gebündelt und Verwaltungsrechten vorbehalten.",
        "Each of these settings changes how the organisation works. That is why they are bundled in one place and reserved for administration rights.",
        "Elk van deze instellingen verandert hoe de organisatie werkt. Daarom zijn ze op één plek gebundeld en voorbehouden aan beheerrechten.",
      ),
      danach: T(
        "Jede Änderung landet im Protokoll. Neue Grenzen und Freigabezahlen gelten für Neues; Bestehendes bleibt, wie es war.",
        "Every change is recorded in the log. New limits and approval numbers apply to new items; existing ones stay as they were.",
        "Elke wijziging komt in het logboek. Nieuwe grenzen en vrijgaveaantallen gelden voor nieuwe items; bestaande blijven zoals ze waren.",
      ),
      missverstaendnisse: T(
        "„Der KI-Schlüssel steht im Browser.“ — Nein, nur auf dem Server. „Eine strengere Freigabezahl gilt rückwirkend.“ — Nein: bereits eingereichte Beiträge behalten ihre Zahl.",
        "“The AI key is in the browser.” — No, only on the server. “A stricter approval number applies retroactively.” — No: contributions already submitted keep their number.",
        "“De AI-sleutel staat in de browser.” — Nee, alleen op de server. “Een strenger vrijgaveaantal geldt met terugwerkende kracht.” — Nee: al ingediende bijdragen houden hun aantal.",
      ),
    },
  },
];

/** Ein Funktionsartikel in der UI-Sprache — Titel und fünf Teile. */
export function funktionsArtikel(
  artikel: FunktionsArtikel,
  lng: string,
): { titel: string; teile: Readonly<Record<BibliothekTeil, string>> } {
  return { titel: artikel.titel[bibliothekSprache(lng)], teile: inSprache(artikel.teile, lng) };
}

// ================================================================================================
// GLIEDERUNG — jeder Punkt der Quellengliederung (Lieferung 1, Abschnitt B) mit seinem Artikel.
// ================================================================================================
//
// `artikel` ist die Kennung eines Bereichsartikels (`HILFE_BIBLIOTHEK`) oder eines
// Funktionsartikels (`FUNKTIONS_ARTIKEL`). `stichwort` muss je Sprache im zugeordneten Artikel
// stehen — so ist geprüft, dass der Artikel diese Funktion WIRKLICH behandelt und nicht nur
// zugeordnet ist. Ohne Artikel steht der Grund da — und seit Nacharbeit 7 (Ben: „Die
// Vollständigkeitsprüfung darf diese Lücke nicht allein aufgrund eines Begründungstexts
// akzeptieren") eine ART der Auslassung, die die Prüfung am Bestand nachmisst.
export type GliederungsPunkt =
  | { readonly id: string; readonly artikel: string; readonly stichwort: Text }
  | {
      readonly id: string;
      readonly artikel: null;
      readonly auslassung: Auslassung;
      readonly grund: string;
    };

/**
 * Warum ein Punkt keinen Artikel hat, nachprüfbar (`tests/hilfe-bibliothek/bibliothek-bauplan`, G2):
 *   · `ohne-recht`    — die Funktion gibt es für diese Rolle nicht (Rollenvertrag
 *                       `services/rbac/src/policy.ts`: die Rolle hat das Recht nicht);
 *   · `jeder-artikel` — der Inhalt ist ein fester Teil JEDES Artikels;
 *   · `keine-flaeche` — die Fläche gibt es nicht (keine Route trägt eines dieser Wörter).
 */
export type Auslassung =
  | { readonly art: "ohne-recht"; readonly rolle: string; readonly recht: string }
  | { readonly art: "jeder-artikel"; readonly teil: BibliothekTeil }
  | { readonly art: "keine-flaeche"; readonly routenwoerter: readonly string[] };

/** Ein Gliederungspunkt mit Artikel; das Stichwort muss je Sprache im Artikel stehen. */
function punkt(id: string, artikel: string, de: string, en: string, nl: string): GliederungsPunkt {
  return { id, artikel, stichwort: { de, en, nl } };
}

/** Ein Gliederungspunkt ohne Artikel — mit nachprüfbarer Auslassung und Grund. */
function ohneArtikel(id: string, auslassung: Auslassung, grund: string): GliederungsPunkt {
  return { id, artikel: null, auslassung, grund };
}

export const GLIEDERUNG: readonly GliederungsPunkt[] = [
  punkt(
    "B0-1",
    "grundprinzip",
    "Erfahrungswissen",
    "experience-based knowledge",
    "ervaringskennis",
  ),
  punkt(
    "B0-2",
    "grundprinzip",
    "Vertrauen ist Evidenz",
    "confidence is evidence",
    "vertrouwen is bewijs",
  ),
  punkt("B0-3", "kreislauf", "Wissenskreislauf", "knowledge cycle", "kenniscyclus"),
  punkt(
    "B0-4",
    "grundprinzip",
    "nicht einfach auf alles",
    "not simply answer everything",
    "niet zomaar op alles",
  ),
  punkt("B0-5", "wissensobjekt", "kleinste Einheit", "smallest unit", "kleinste eenheid"),
  punkt("B0-6", "rollen-konten", "Rollen legen fest", "Roles define", "Rollen bepalen"),
  punkt("B0-7", "ki-datenschutz", "Cloud-Dienst", "cloud service", "clouddienst"),
  punkt("B0-8", "kreislauf", "erste halbe Stunde", "first half hour", "eerste halfuur"),
  punkt("B1-1", "capture", "diktierst", "dictate", "dicteert"),
  punkt("B1-2", "schreiben", "unsortiert", "unsorted", "ongeordend"),
  punkt("B1-3", "diktieren", "Diktieren heißt", "Dictating means", "Dicteren betekent"),
  punkt("B1-4", "interview", "Wissens-Interview", "knowledge interview", "kennisinterview"),
  punkt("B1-5", "fileimport", "Datei importieren", "Import file", "Bestand importeren"),
  punkt(
    "B1-6",
    "fileimport",
    "In Punkte analysieren",
    "Analyze into points",
    "In punten analyseren",
  ),
  punkt(
    "B1-7",
    "schreiben",
    "Struktur vorschlagen",
    "Suggesting a structure",
    "structuur laten voorstellen",
  ),
  punkt("B1-8", "wissensarten", "Negativwissen", "Negative knowledge", "Negatieve kennis"),
  punkt("B1-9", "quellen", "wörtlichen Auszug", "literal excerpt", "letterlijk fragment"),
  punkt("B1-10", "schreiben", "Formulieren", "wording", "formuleren"),
  punkt("B1-11", "entwurf-einreichen", "Mit dem Einreichen", "Submitting turns", "Met indienen"),
  punkt("B1-12", "entwurf-einreichen", "Entwurf speichern", "Saving a draft", "concept bewaren"),
  punkt("B2-1", "validation", "validiert", "validated", "gevalideerd"),
  punkt(
    "B2-2",
    "validation",
    "Validierung ist der Ort",
    "Validation is where",
    "Validatie is de plek",
  ),
  punkt(
    "B2-3",
    "validation",
    "„Freigeben“, „Rückfrage“ oder „Ablehnen“",
    "approve, query or reject",
    "vrijgeven, vraag stellen of afwijzen",
  ),
  punkt("B2-4", "pruefen-organisieren", "eine bis fünf", "one to five", "één tot vijf"),
  punkt("B2-5", "validation", "nicht überstimmt", "not outvoted", "niet overstemd"),
  punkt(
    "B2-6",
    "validation",
    "Den eigenen Beitrag kann ich selbst freigeben",
    "I can approve my own contribution",
    "Mijn eigen bijdrage kan ik zelf vrijgeven",
  ),
  punkt(
    "B2-7",
    "pruefen-organisieren",
    "Prüfer zuweisen",
    "Assigning a reviewer",
    "toewijzen van een controleur",
  ),
  punkt("B2-8", "nacharbeit", "Nacharbeit", "rework", "nawerk"),
  ohneArtikel(
    "B2-9",
    { art: "ohne-recht", rolle: "experte", recht: "ko.validate" },
    "Prüfen als Experte (wirksame Rolle): Bau-Status schon in der Quelle offen (P-3); laut Rollenvertrag (`services/rbac/src/policy.ts`) hat die Rolle Experte kein Prüfrecht — die Funktion besteht so nicht.",
  ),
  punkt(
    "B3-1",
    "vertrauen-status",
    "Vertrauenswert entsteht",
    "confidence value comes from",
    "vertrouwenswaarde ontstaat",
  ),
  punkt("B3-2", "vertrauen-status", "Stand", "status", "status"),
  punkt("B3-3", "vertrauen-status", "Reife", "maturity", "rijpheid"),
  punkt(
    "B3-4",
    "vertraulichkeit-export",
    "streng vertraulich",
    "strictly confidential",
    "strikt vertrouwelijk",
  ),
  punkt(
    "B3-5",
    "vertrauen-status",
    "offener Widerspruch",
    "open contradiction",
    "open tegenspraak",
  ),
  punkt(
    "B4-1",
    "library",
    "gesamte Wissensbestand",
    "whole body of knowledge",
    "volledige kennisvoorraad",
  ),
  punkt("B4-2", "library", "Filter", "filters", "filters"),
  punkt(
    "B4-3",
    "wissensobjekt",
    "Bedingungen, Maßnahmen",
    "conditions, measures",
    "voorwaarden, maatregelen",
  ),
  punkt("B4-4", "wissensobjekt", "Herkunft", "origin", "herkomst"),
  punkt("B4-5", "wissensobjekt", "neue Version", "new version", "nieuwe versie"),
  punkt("B4-6", "vertraulichkeit-export", "Export", "export", "export"),
  punkt("B5-1", "ask", "Frage", "question", "vraag"),
  punkt("B5-2", "ask", "worauf sie steht", "what it rests on", "waarop het steunt"),
  punkt("B5-3", "wissensluecke", "ehrliche Auskunft", "honest statement", "eerlijke mededeling"),
  punkt("B5-4", "wissensluecke", "schließt sie selbst", "close it yourself", "sluit je het zelf"),
  punkt("B5-5", "extern", "außerhalb von Klarwerk", "outside Klarwerk", "buiten Klarwerk"),
  // Nacharbeit 7 (Ben): die Funktion besteht (`pages/Ask.tsx`, Kopieren · Als Markdown · Drucken).
  punkt("B5-6", "antwort-weitergeben", "Kopieren", "Copy", "Kopiëren"),
  punkt("B6-1", "konflikte", "Widerspruch", "contradiction", "tegenspraak"),
  punkt("B6-2", "konflikt-wege", "Zweitmeinung", "second opinion", "tweede mening"),
  punkt(
    "B6-3",
    "duplikate",
    "dasselbe sagen",
    "say largely the same thing",
    "grotendeels hetzelfde zeggen",
  ),
  punkt("B6-4", "risk", "einem einzigen Menschen", "single person", "één persoon"),
  punkt("B6-5", "lifecycle", "erneuten Prüfung", "renewed checking", "hernieuwde controle"),
  punkt("B6-6", "protokoll", "Hash-Kette", "hash chain", "hashketen"),
  punkt("B6-7", "loeschen", "Papierkorb", "recycle bin", "prullenbak"),
  punkt(
    "B7-1",
    "ki-datenschutz",
    "Externe Verarbeitung",
    "External processing",
    "Externe verwerking",
  ),
  punkt("B7-2", "ki-datenschutz", "Info-Zeichen", "info sign", "info-teken"),
  punkt("B7-3", "ki-datenschutz", "regelbasiert", "rule-based", "regelgebaseerd"),
  punkt(
    "B7-4",
    "ki-datenschutz",
    "Betreibersache",
    "operator’s responsibility",
    "zaak van de beheerder",
  ),
  punkt(
    "B7-5",
    "vertraulichkeit-export",
    "vertrauliche Einträge",
    "confidential entries",
    "vertrouwelijke vermeldingen",
  ),
  punkt(
    "B8-1",
    "verwaltung-einstellungen",
    "welche KI für welche Aufgabe",
    "which AI works for which task",
    "welke AI voor welke taak",
  ),
  punkt(
    "B8-2",
    "rollen-konten",
    "ein Konto erstellen",
    "create an account",
    "een account aanmaken",
  ),
  punkt(
    "B8-3",
    "verwaltung-einstellungen",
    "Grenzen für Uploads",
    "upload limits",
    "grenzen voor uploads",
  ),
  punkt("B8-4", "firststart", "Erststart", "First start", "eerste start"),
  punkt(
    "B8-5",
    "verwaltung-einstellungen",
    "Bereitschafts-Übersicht",
    "readiness overview",
    "gereedheidsoverzicht",
  ),
  punkt(
    "B8-6",
    "firststart",
    "Demodaten entfernen",
    "Remove demo data",
    "Demogegevens verwijderen",
  ),
  punkt("B9-1", "mobile", "mobile Ansicht", "mobile view", "mobiele weergave"),
  punkt("B9-2", "mobile", "Ohne Verbindung", "Without a connection", "Zonder verbinding"),
  ohneArtikel(
    "B10-1",
    { art: "keine-flaeche", routenwoerter: ["glossar", "glossary", "woordenlijst"] },
    "Glossar der Klarwerk-Begriffe (A–Z, ein Name je Sache): eine solche Fläche gibt es nicht. Das Firmenwörterbuch unter `/begriffe` ist etwas anderes — der Katalog der firmeneigenen Fachbegriffe, kein Glossar der Anwendung. Klarwerk-Begriffe erklären die Artikel selbst und Klara (Begriff eintippen oder markieren).",
  ),
  punkt("B10-2", "grundprinzip", "erfundene Antwort", "invented answer", "verzonnen antwoord"),
  ohneArtikel(
    "B10-3",
    { art: "jeder-artikel", teil: "missverstaendnisse" },
    "Sammlung der häufigsten Missverständnisse: kein eigener Artikel, sondern der feste fünfte Teil „Typische Missverständnisse“ JEDES Artikels.",
  ),
  ohneArtikel(
    "B10-4",
    { art: "keine-flaeche", routenwoerter: ["schnellweg", "quick", "snelweg"] },
    "Aufgaben-Schnellwege (Ziel → kürzester Klickweg): eine solche Sammlung gibt es nicht. Die Schnellwahl (⌘K/Strg+K) springt zu Seiten und Wissenseinträgen, nennt aber keine Klickwege; den ersten Arbeitsweg führt die Einstiegsführung auf der Hilfeseite, und jeder Artikel nennt seinen Bereich.",
  ),
];

/** Der Text eines Artikels (Bereichs- oder Funktionsartikel) in einer Sprache — für Prüfungen. */
export function artikelText(id: string, lng: string): string | null {
  const bereich = hilfeArtikel(id, lng);
  if (bereich) {
    return BIBLIOTHEK_TEILE.map((teil) => bereich[teil]).join(" ");
  }
  const funktion = FUNKTIONS_ARTIKEL.find((artikel) => artikel.id === id);
  if (!funktion) {
    return null;
  }
  const { titel, teile } = funktionsArtikel(funktion, lng);
  return [titel, ...BIBLIOTHEK_TEILE.map((teil) => teile[teil])].join(" ");
}
