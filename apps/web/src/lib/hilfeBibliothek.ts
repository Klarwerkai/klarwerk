// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0890 — DIE ANWENDER-WISSENSBIBLIOTHEK NACH FESTEM BAUPLAN.
// ================================================================================================
//
// Der Originalwortlaut: „Eine gegliederte Bibliothek erklärt jede Funktion nach festem Bauplan: was
// es ist, wie es funktioniert, warum es so gebaut ist, was danach passiert und welche typischen
// Missverständnisse es gibt."
//
// GLIEDERUNG: je Funktion EIN Artikel, und die Funktionen sind genau die Hilfekapitel der
// Hilfeseite (`lib/helpTopics.ts`, `HELP_TOPICS`) — jedes steht für einen Bereich der Anwendung mit
// eigener Route. Der Artikel hängt unter der Kapitelkarte (`pages/Help.tsx`, aufklappbar); die
// Reihenfolge ist die der Kapitel. Der Wächter `tests/hilfe-bibliothek/bibliothek-bauplan.test.ts`
// hält fest, dass JEDES Kapitel einen Artikel mit allen fünf Teilen in allen drei Sprachen hat.
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
// `lib/helpTopics.iso.ts`) und laufen NICHT durch die Hilfesuche: deren Treffer sind in
// `tests/review26-hilfe-import` gepinnt, und ein Artikel ist eine Vertiefung, kein Suchziel.
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
  const sprache = bibliothekSprache(lng);
  return {
    was: artikel.was[sprache],
    wie: artikel.wie[sprache],
    warum: artikel.warum[sprache],
    danach: artikel.danach[sprache],
    missverstaendnisse: artikel.missverstaendnisse[sprache],
  };
}
