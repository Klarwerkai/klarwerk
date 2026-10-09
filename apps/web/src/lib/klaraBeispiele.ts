// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0941 — KLARA ERKLÄRT EIN ELEMENT „MIT EINEM KONKRETEN BEISPIEL".
// ================================================================================================
//
// Der Originalwortlaut: „Man tippt auf ein Element, und Klara erklärt es — auf Wunsch per
// Sprachausgabe vorgelesen und mit einem konkreten Beispiel." Erklärung (Zeige-Modus) und Vorlesen
// gab es (`components/KlaraAssistant.tsx`); das Beispiel fehlte.
//
// WELCHE ELEMENTE: genau die 49 Elementerklärungen mit stabiler Kennung — die Kurzhilfen des
// Erfassen-Wegs (`cap:*`, `lib/captureHelp.ts`) und des Prüfbereichs (`rev:*`, `lib/reviewHelp.ts`).
// Das sind die Ziele der `data-help`-Anker und die Stellen, die R-0888 als die dichtesten nennt.
// Seiten- und Abschnittserklärungen tragen kein Beispiel; dort zeigt Klara wie bisher nur den Text.
//
// WOHER DIE BEISPIELE KOMMEN: aus dem jeweiligen Hilfetext selbst. Jedes Beispiel spielt GENAU
// das durch, was der Text verspricht, und verspricht nichts darüber hinaus — keine neue Funktion,
// keine Zahl, die die App nicht zeigt. Die Branchen wechseln bewusst (Lieferung 1, Abschnitt A:
// „nie nur Industrie").
//
// SPRACHEN: DE/EN/NL wie die Oberfläche. Die Daten liegen als Sprachobjekte hier (Vorbild
// `lib/helpTopics.iso.ts`), weil sie an der Kennung des Elements hängen und nicht an einem
// i18n-Schlüssel; die Beschriftung „Beispiel" kommt aus `texte/klarabeispiel.ts`.
import { CAPTURE_HELP_IDS } from "./captureHelp";
import { REVIEW_HELP_IDS } from "./reviewHelp";

export type BeispielSprache = "de" | "en" | "nl";

type Beispiel = Readonly<Record<BeispielSprache, string>>;

/** UI-Sprache → Sprache der Beispiele. Alles außer en/nl fällt auf Deutsch, wie `fallbackLng`. */
export function beispielSprache(lng: string): BeispielSprache {
  if (lng.startsWith("en")) return "en";
  if (lng.startsWith("nl")) return "nl";
  return "de";
}

export const KLARA_BEISPIELE: Readonly<Record<string, Beispiel>> = {
  // ---- Erfassen (cap:*) -------------------------------------------------------------------------
  "cap:modes": {
    de: "Eine Pflegekraft hat beide Hände voll und diktiert; ein Kollege aus der Logistik lädt die vorhandene Packanweisung als Datei hoch. Beide landen im selben Entwurf.",
    en: "A nurse has her hands full and dictates; a colleague in logistics uploads the existing packing instruction as a file. Both end up in the same draft.",
    nl: "Een verpleegkundige heeft haar handen vol en dicteert; een collega uit de logistiek uploadt de bestaande pakinstructie als bestand. Beide komen in hetzelfde concept terecht.",
  },
  "cap:expertPath": {
    de: "Eine Sachbearbeiterin im Amt kennt alle Angaben schon und trägt Titel, Bedingungen und Maßnahmen direkt ins Formular ein — geprüft wird ihr Beitrag trotzdem wie jeder andere.",
    en: "A clerk at a public office already knows every detail and enters title, conditions and measures directly in the form — her contribution is still reviewed like any other.",
    nl: "Een medewerker bij de gemeente kent alle gegevens al en vult titel, voorwaarden en maatregelen direct in het formulier in — haar bijdrage wordt toch gecontroleerd zoals elke andere.",
  },
  "cap:wizardSteps": {
    de: "Ein Koch schreibt auf, wie die Kühlkette bei Anlieferung geprüft wird, sichert das als Entwurf, ergänzt am nächsten Tag die Temperatur und reicht erst dann ein.",
    en: "A chef writes down how the cold chain is checked on delivery, saves it as a draft, adds the temperature the next day and only then submits it.",
    nl: "Een kok schrijft op hoe de koudeketen bij levering wordt gecontroleerd, bewaart dat als concept, vult de volgende dag de temperatuur aan en dient het pas dan in.",
  },
  "cap:loadExample": {
    de: "Vor der ersten echten Erfassung lädt eine neue Kollegin das Beispiel auf einer leeren Seite und klickt den Weg einmal durch, ohne etwas einzureichen.",
    en: "Before her first real entry, a new colleague loads the example on an empty page and clicks through the path once without submitting anything.",
    nl: "Voor haar eerste echte invoer laadt een nieuwe collega het voorbeeld op een lege pagina en klikt het pad één keer door, zonder iets in te dienen.",
  },
  "cap:tellRaw": {
    de: "„Wenn die Presse morgens quietscht, erst das Schmierintervall prüfen, nicht gleich den Service rufen — das hat uns zweimal eine Anfahrt gespart.“ So unsortiert darf der erste Text sein.",
    en: "“If the press squeaks in the morning, check the lubrication interval first rather than calling service straight away — that saved us two call-outs.” Your first text may be this unsorted.",
    nl: "“Als de pers ’s ochtends piept, eerst het smeerinterval controleren en niet meteen de service bellen — dat heeft ons twee keer een bezoek bespaard.” Zo ongeordend mag de eerste tekst zijn.",
  },
  "cap:dictate": {
    de: "Ein Landwirt spricht im Stall: „Kälber unter drei Tagen bekommen …“ — der Text erscheint im Feld, und er verbessert danach ein falsch erkanntes Wort von Hand.",
    en: "A farmer speaks in the barn: “Calves under three days old get …” — the text appears in the field, and he then corrects a misrecognised word by hand.",
    nl: "Een boer spreekt in de stal: “Kalveren jonger dan drie dagen krijgen …” — de tekst verschijnt in het veld, en daarna verbetert hij een verkeerd herkend woord met de hand.",
  },
  "cap:tellUpload": {
    de: "Eine Erzieherin hängt das Word-Dokument mit dem Notfallplan an: sein Text fließt ins Erzählfeld, das Foto vom Aushang wird ein Anhang.",
    en: "A nursery teacher attaches the Word document with the emergency plan: its text flows into the story field, the photo of the notice becomes an attachment.",
    nl: "Een pedagogisch medewerker voegt het Word-document met het noodplan toe: de tekst komt in het vertelveld, de foto van het mededelingenbord wordt een bijlage.",
  },
  "cap:structureNow": {
    de: "Aus dem Satz über die quietschende Presse schlägt die KI den Titel „Presse quietscht: zuerst Schmierintervall prüfen“ und eine Bedingung „morgens, vor Schichtbeginn“ vor — du übernimmst den Titel und änderst die Bedingung.",
    en: "From the sentence about the squeaking press, the AI proposes the title “Press squeaks: check lubrication interval first” and a condition “in the morning, before the shift” — you keep the title and change the condition.",
    nl: "Uit de zin over de piepende pers stelt de AI de titel “Pers piept: eerst smeerinterval controleren” en een voorwaarde “’s ochtends, voor de dienst” voor — jij neemt de titel over en past de voorwaarde aan.",
  },
  "cap:interview": {
    de: "Auf „Man muss das Ventil rechtzeitig schließen“ fragt das Interview nach: „Ab welchem Druck?“ — die Antwort „ab sechs bar“ macht das Wissen erst brauchbar.",
    en: "To “You have to close the valve in time”, the interview asks: “From which pressure?” — the answer “from six bar” is what makes the knowledge usable.",
    nl: "Op “Je moet de klep op tijd sluiten” vraagt het interview door: “Vanaf welke druk?” — pas het antwoord “vanaf zes bar” maakt de kennis bruikbaar.",
  },
  "cap:filePoints": {
    de: "Aus einem Hygieneplan schlägt die KI fünf Punkte vor, jeder mit dem wörtlichen Satz aus dem Plan. Du hakst drei an — nur diese drei werden Entwürfe.",
    en: "From a hygiene plan the AI proposes five points, each with the literal sentence from the plan. You tick three — only those three become drafts.",
    nl: "Uit een hygiëneplan stelt de AI vijf punten voor, elk met de letterlijke zin uit het plan. Je vinkt er drie aan — alleen die drie worden concepten.",
  },
  "cap:captureTitle": {
    de: "Statt „Fristen“ lieber „Widerspruch gegen Bescheid: Frist ein Monat ab Zugang“ — so findet eine Kollegin in der Kanzlei den Eintrag mit dem ersten Suchwort.",
    en: "Instead of “Deadlines”, better “Objection to a notice: deadline one month from receipt” — then a colleague at the law firm finds the entry with the first search word.",
    nl: "In plaats van “Termijnen” liever “Bezwaar tegen besluit: termijn één maand na ontvangst” — dan vindt een collega op het kantoor de vermelding met het eerste zoekwoord.",
  },
  "cap:saveDraftHelp": {
    de: "Du sicherst kurz vor Feierabend am Rechner und machst am nächsten Morgen auf dem Tablet weiter — bis du einreichst, sieht den Entwurf niemand außer dir.",
    en: "You save at your desk just before the end of the day and continue on the tablet the next morning — until you submit, nobody but you sees the draft.",
    nl: "Je bewaart vlak voor het einde van de dag op de computer en gaat de volgende ochtend verder op de tablet — tot je indient, ziet niemand behalve jij het concept.",
  },
  "cap:discardHelp": {
    de: "Du hast versehentlich die falsche Datei eingelesen und verwirfst die Eingabe. Dein gestern gesicherter Entwurf zum selben Thema bleibt dabei unberührt.",
    en: "You accidentally read in the wrong file and discard the input. Your draft on the same topic saved yesterday stays untouched.",
    nl: "Je hebt per ongeluk het verkeerde bestand ingelezen en verwerpt de invoer. Je gisteren bewaarde concept over hetzelfde onderwerp blijft daarbij onaangeroerd.",
  },
  "cap:submitReview": {
    de: "Ein Lagerleiter reicht „Gefahrgut nie über Kopfhöhe lagern“ ein. Ab jetzt sehen es alle, gekennzeichnet als „in Prüfung“, bis genug Kolleginnen und Kollegen freigegeben haben.",
    en: "A warehouse manager submits “Never store hazardous goods above head height”. From now on everyone sees it, marked “In review”, until enough colleagues have approved it.",
    nl: "Een magazijnchef dient “Gevaarlijke stoffen nooit boven hoofdhoogte opslaan” in. Vanaf nu ziet iedereen het, gemarkeerd als “In beoordeling”, tot genoeg collega’s het hebben vrijgegeven.",
  },
  "cap:readiness": {
    de: "Der Check zeigt: Titel fehlt noch — der Knopf bleibt aus. Kategorie fehlt auch, ist aber nur eine Empfehlung; nach dem Titel kannst du einreichen.",
    en: "The check shows: title still missing — the button stays off. Category is missing too, but that is only a recommendation; once there is a title you can submit.",
    nl: "De controle toont: titel ontbreekt nog — de knop blijft uit. Categorie ontbreekt ook, maar dat is alleen een aanbeveling; met een titel kun je indienen.",
  },
  "cap:savedNext": {
    de: "Nach dem Einreichen steht dein Beitrag zur Kühlkette in der Validierung. Über den Link öffnest du ihn und hängst noch das Foto vom Thermometer an.",
    en: "After submitting, your contribution about the cold chain is in Validation. Via the link you open it and add the photo of the thermometer.",
    nl: "Na het indienen staat je bijdrage over de koudeketen in Validatie. Via de link open je hem en voeg je nog de foto van de thermometer toe.",
  },
  "cap:advancedDetails": {
    de: "Ein Handwerksbetrieb trägt unter „Erweiterte Details“ die Kategorie „Dachdeckung“ und das Schlagwort „Schiefer“ ein — der Beitrag wäre auch ohne beides einreichbar.",
    en: "A craft business enters the category “Roofing” and the tag “slate” under “Advanced details” — the contribution could also be submitted without either.",
    nl: "Een vakbedrijf vult onder “Uitgebreide details” de categorie “Dakbedekking” en het trefwoord “leisteen” in — de bijdrage kan ook zonder beide worden ingediend.",
  },
  "cap:knowledgeType": {
    de: "„Wir haben Reinigungsmittel X an Edelstahl probiert — es hinterlässt Flecken, deshalb nicht verwenden“ ist Negativwissen und spart der nächsten Schicht den Versuch.",
    en: "“We tried cleaning agent X on stainless steel — it leaves stains, so don’t use it” is negative knowledge and saves the next shift the attempt.",
    nl: "“We hebben schoonmaakmiddel X op roestvrij staal geprobeerd — het laat vlekken achter, dus niet gebruiken” is negatieve kennis en bespaart de volgende ploeg de poging.",
  },
  "cap:assetField": {
    de: "Du koppelst den Beitrag an „Presse 3“. Meldet später jemand eine Änderung an Presse 3, kommt genau dieser Beitrag zur erneuten Prüfung.",
    en: "You link the contribution to “Press 3”. If someone later reports a change to Press 3, exactly this contribution comes up for review again.",
    nl: "Je koppelt de bijdrage aan “Pers 3”. Meldt iemand later een wijziging aan Pers 3, dan komt precies deze bijdrage opnieuw ter controle.",
  },
  "cap:tagsField": {
    de: "In einer Versicherung vergibst du „kfz“, „glasbruch“ und „frist“ — genau die Wörter, die Kolleginnen am Telefon eintippen würden.",
    en: "At an insurer you add “motor”, “glass damage” and “deadline” — exactly the words colleagues on the phone would type.",
    nl: "Bij een verzekeraar geef je “auto”, “glasschade” en “termijn” op — precies de woorden die collega’s aan de telefoon zouden intypen.",
  },
  "cap:docsImages": {
    de: "Ein Elektriker hängt das Messprotokoll und ein Foto der beschrifteten Verteilung an. Was davon in den Text gehört, schreibt er selbst hinein.",
    en: "An electrician attaches the measurement report and a photo of the labelled distribution board. What belongs in the text, he writes in himself.",
    nl: "Een elektricien voegt het meetrapport en een foto van de gelabelde verdeelkast toe. Wat daarvan in de tekst hoort, schrijft hij er zelf in.",
  },
  "cap:sourcesPanel": {
    de: "Du nennst „DIN EN 1090, Abschnitt 7“ mit dem entscheidenden Satz als Auszug. Die Quelle steht auf der Warteliste und wird erst beim Einreichen angehängt.",
    en: "You name “DIN EN 1090, section 7” with the decisive sentence as an excerpt. The source sits on the waiting list and is only attached on submission.",
    nl: "Je noemt “DIN EN 1090, sectie 7” met de beslissende zin als fragment. De bron staat op de wachtlijst en wordt pas bij het indienen gekoppeld.",
  },
  "cap:expertForm": {
    de: "Kernaussage: „Schankgenehmigung spätestens vier Wochen vor dem Fest beantragen“, Bedingung: „bei Ausschank im Freien“, Maßnahme: „Antrag beim Ordnungsamt stellen“.",
    en: "Core statement: “Apply for the alcohol licence at least four weeks before the event”, condition: “when serving outdoors”, measure: “submit the application to the public order office”.",
    nl: "Kernuitspraak: “Drankvergunning uiterlijk vier weken voor het feest aanvragen”, voorwaarde: “bij schenken buiten”, maatregel: “aanvraag indienen bij de gemeente”.",
  },
  // ---- Prüfbereich (rev:*) ----------------------------------------------------------------------
  "rev:originFilter": {
    de: "Während der Einarbeitung blendest du nur die Demo-Beispiele ein, um daran zu üben; die echten Einträge deiner Organisation bleiben unverändert in der Prüfung.",
    en: "During onboarding you show only the demo examples to practise on; your organisation’s real entries stay unchanged in review.",
    nl: "Tijdens het inwerken toon je alleen de demovoorbeelden om mee te oefenen; de echte vermeldingen van je organisatie blijven ongewijzigd in controle.",
  },
  "rev:reviewFocus": {
    de: "Ein Eintrag steht in Version 2: Du liest zuerst deine eigene frühere Rückfrage und schaust, ob die fehlende Temperaturangabe jetzt drinsteht.",
    en: "An entry is at version 2: you first read your own earlier query and check whether the missing temperature has now been added.",
    nl: "Een vermelding staat op versie 2: je leest eerst je eigen eerdere vraag en kijkt of de ontbrekende temperatuur er nu in staat.",
  },
  "rev:filters": {
    de: "Als Fachfrau für Hygiene filterst du nach der Kategorie „Hygiene“ und siehst nur noch die sieben Einträge, die du wirklich beurteilen kannst.",
    en: "As a hygiene specialist you filter by the category “Hygiene” and see only the seven entries you can really judge.",
    nl: "Als hygiënespecialist filter je op de categorie “Hygiëne” en zie je alleen nog de zeven vermeldingen die je echt kunt beoordelen.",
  },
  "rev:mineOnly": {
    de: "Ein Kollege hat dich um die Prüfung seines Beitrags zur Gabelstaplerwartung gebeten — mit „Nur mir zugewiesene“ steht er oben, ohne dass er schon bewertet ist.",
    en: "A colleague asked you to review his contribution on forklift maintenance — with “Assigned to me only” it is at the top, without being rated yet.",
    nl: "Een collega heeft je gevraagd zijn bijdrage over heftruckonderhoud te controleren — met “Alleen aan mij toegewezen” staat die bovenaan, zonder dat er al een oordeel is.",
  },
  "rev:signals": {
    de: "„Ziel 3“ und zwei grüne Stimmen: es fehlt noch eine Freigabe. Steht dazu „ÜBERTRAGEN“, verantwortet inzwischen jemand anderes den Eintrag — lies ihn besonders genau.",
    en: "“target 3” and two green votes: one approval is still missing. If it also says “TRANSFERRED”, someone else is now responsible for the entry — read it especially carefully.",
    nl: "“Doel 3” en twee groene stemmen: er ontbreekt nog één vrijgave. Staat er ook “OVERGEDRAGEN”, dan is nu iemand anders verantwoordelijk — lees hem extra zorgvuldig.",
  },
  "rev:approve": {
    de: "Du hast die Angabe „Wundverband alle 48 Stunden wechseln, bei Durchnässung sofort“ mit dem Pflegestandard verglichen, sie stimmt — du gibst frei. Validiert ist sie erst, wenn auch die übrigen nötigen Freigaben da sind.",
    en: "You compared “Change the wound dressing every 48 hours, immediately if soaked” with the care standard, it is correct — you approve. It is validated only once the other required approvals are in as well.",
    nl: "Je hebt “Wondverband elke 48 uur verwisselen, bij doorweken direct” vergeleken met de zorgstandaard, het klopt — je geeft vrij. Gevalideerd is het pas als ook de overige nodige vrijgaven er zijn.",
  },
  "rev:query": {
    de: "Rückfrage: „Gilt die Frist auch, wenn der Bescheid per E-Mail kam? Bitte ergänzen.“ Der Eintrag bleibt in Prüfung, und die Autorin sieht deinen Kommentar am Eintrag.",
    en: "Query: “Does the deadline also apply if the notice arrived by email? Please add.” The entry stays in review, and the author sees your comment on it.",
    nl: "Vraag: “Geldt de termijn ook als het besluit per e-mail kwam? Graag aanvullen.” De vermelding blijft in controle, en de auteur ziet je opmerking erbij.",
  },
  "rev:reject": {
    de: "Ablehnen mit Begründung: „Der genannte Grenzwert stammt aus der alten Vorschrift und gilt seit diesem Jahr nicht mehr.“ Der Eintrag bleibt sichtbar in Prüfung, gelöscht wird nichts.",
    en: "Reject with a reason: “The limit given comes from the old regulation and no longer applies this year.” The entry stays visible in review, nothing is deleted.",
    nl: "Afwijzen met reden: “De genoemde grenswaarde komt uit de oude regeling en geldt dit jaar niet meer.” De vermelding blijft zichtbaar in controle, er wordt niets verwijderd.",
  },
  "rev:feedbackForm": {
    de: "Statt „unklar“ schreibst du: „Bitte die Temperatur angeben, ab der die Ware abgelehnt wird, und die Quelle dazu.“ Erst mit Text lässt sich absenden.",
    en: "Instead of “unclear” you write: “Please state the temperature at which goods are refused, and the source for it.” You can only send once there is text.",
    nl: "In plaats van “onduidelijk” schrijf je: “Graag de temperatuur noemen waarbij de goederen worden geweigerd, en de bron daarvan.” Pas met tekst kun je verzenden.",
  },
  "rev:assign": {
    de: "Du bittest die Kollegin aus der Buchhaltung um die Prüfung des Eintrags zur Reisekostenabrechnung. Sie sieht ihn unter „Mir zugewiesen“; bewertet ist er damit noch nicht.",
    en: "You ask the colleague from accounting to review the entry on travel expense claims. She sees it under “Assigned to me”; that does not rate it yet.",
    nl: "Je vraagt de collega van de boekhouding de vermelding over reiskostendeclaraties te controleren. Zij ziet hem onder “Aan mij toegewezen”; beoordeeld is hij daarmee nog niet.",
  },
  "rev:markTrue": {
    de: "Niemand außer der Autorin kennt die alte Spezialmaschine. Die Verwaltung kennzeichnet den Eintrag bewusst als wahr — mit ihrem Namen im Protokoll, und über eine spätere Überarbeitung kommt er wieder in die Prüfung.",
    en: "Nobody but the author knows the old special machine. The administration deliberately marks the entry as true — with its name in the log, and a later revision brings it back into review.",
    nl: "Niemand behalve de auteur kent de oude speciale machine. Het beheer markeert de vermelding bewust als waar — met naam in het logboek, en een latere herziening brengt hem terug in controle.",
  },
  "rev:stillValid": {
    de: "Du hast die Anleitung zum Schichtwechsel heute selbst angewendet, und sie stimmt noch: „Noch gültig“ vermerkt das mit Datum. Offene Rückfragen bleiben trotzdem offen.",
    en: "You used the shift handover instruction yourself today and it is still right: “Still valid” records that with the date. Open queries still stay open.",
    nl: "Je hebt de instructie voor de dienstwissel vandaag zelf gebruikt en die klopt nog: “Nog geldig” legt dat met datum vast. Open vragen blijven toch open.",
  },
  "rev:reportConflict": {
    de: "Ein Eintrag nennt sechs bar als Grenze, ein anderer für denselben Kessel acht bar. Du meldest den Konflikt — beide Einträge bleiben unverändert, bis der Fall entschieden ist.",
    en: "One entry gives six bar as the limit, another one eight bar for the same boiler. You report the conflict — both entries stay unchanged until the case is decided.",
    nl: "Eén vermelding noemt zes bar als grens, een andere acht bar voor dezelfde ketel. Je meldt het conflict — beide vermeldingen blijven ongewijzigd tot de zaak is beslist.",
  },
  "rev:conflictForm": {
    de: "Gegen-Objekt: „Kessel 2 — Grenzdruck“, Art: Widerspruch in der Sache, Beschreibung: „Datenblatt 2023 nennt sechs bar, der andere Eintrag acht.“",
    en: "Counter-object: “Boiler 2 — pressure limit”, type: factual contradiction, description: “The 2023 data sheet says six bar, the other entry eight.”",
    nl: "Tegenobject: “Ketel 2 — grensdruk”, soort: inhoudelijke tegenspraak, beschrijving: “Het datablad van 2023 noemt zes bar, de andere vermelding acht.”",
  },
  "rev:sourcesLevel2": {
    de: "Am Eintrag hängt das Herstellerhandbuch als Quelle. Es stützt die Aussage, zählt aber nicht als Prüfstimme — die Freigaben der Kolleginnen und Kollegen ersetzt es nicht.",
    en: "The manufacturer’s manual is attached to the entry as a source. It supports the statement but does not count as a review vote — it does not replace colleagues’ approvals.",
    nl: "Aan de vermelding hangt de handleiding van de fabrikant als bron. Die ondersteunt de uitspraak maar telt niet als controlestem — de vrijgaven van collega’s vervangt hij niet.",
  },
  "rev:sourceFields": {
    de: "Bezeichnung: „Hygieneleitfaden Gastronomie, Kapitel 4“, URL leer (Papierfassung), Auszug: der eine Satz zur Kerntemperatur.",
    en: "Label: “Catering hygiene guide, chapter 4”, URL empty (paper copy), excerpt: the one sentence on core temperature.",
    nl: "Benaming: “Hygiënecode horeca, hoofdstuk 4”, URL leeg (papieren versie), fragment: de ene zin over de kerntemperatuur.",
  },
  "rev:sourceAdd": {
    de: "Du hängst den Abschnitt aus der Unfallverhütungsvorschrift an. Er steht danach als Beleg neben dem Eintrag; der Text des Eintrags ändert sich nicht.",
    en: "You attach the section from the accident prevention regulation. It then sits next to the entry as evidence; the entry’s text does not change.",
    nl: "Je koppelt het onderdeel uit het arbeidsveiligheidsvoorschrift. Het staat daarna als bewijs naast de vermelding; de tekst ervan verandert niet.",
  },
  "rev:sourceSearch": {
    de: "Die Suche nach „Lastaufnahmemittel Prüffrist“ liefert drei Treffer. Du öffnest einen, er passt, und erst „Anhängen“ übernimmt ihn als Quelle.",
    en: "The search for “lifting accessories inspection interval” returns three hits. You open one, it fits, and only “Attach” takes it over as a source.",
    nl: "De zoekopdracht naar “hijsmiddelen keuringstermijn” geeft drie treffers. Je opent er een, die past, en pas “Koppelen” neemt hem over als bron.",
  },
  "rev:contribution": {
    de: "Du weißt, dass im Ordner der Vorgängerin eine bessere Checkliste liegt, willst den Eintrag aber nicht selbst ändern — du meldest den Hinweis als Kommentar für Autorin und Prüfende.",
    en: "You know a better checklist sits in your predecessor’s folder but don’t want to change the entry yourself — you report the hint as a comment for the author and reviewers.",
    nl: "Je weet dat er in de map van je voorganger een betere checklist zit, maar je wilt de vermelding niet zelf wijzigen — je meldt de tip als opmerking voor auteur en controleurs.",
  },
  "rev:helpful": {
    de: "Ein Monteur hat die Anleitung zum Entlüften der Heizung angewendet, und es hat geklappt: „Hat geholfen“ stärkt das Vertrauen ein Stück, ist aber keine Freigabe.",
    en: "A fitter used the instruction for bleeding the heating and it worked: “Helped” strengthens trust a little, but it is not an approval.",
    nl: "Een monteur heeft de instructie voor het ontluchten van de verwarming toegepast en het werkte: “Heeft geholpen” versterkt het vertrouwen een beetje, maar is geen vrijgave.",
  },
  "rev:validity": {
    de: "Die Frische zeigt: zuletzt vor einem Jahr bestätigt. Ändern kannst du das nicht direkt — wohl aber, indem du den Eintrag prüfst und als „Noch gültig“ bestätigst.",
    en: "Freshness shows: last confirmed a year ago. You cannot change that directly — but you can by reviewing the entry and confirming it as “Still valid”.",
    nl: "De actualiteit toont: voor het laatst een jaar geleden bevestigd. Direct wijzigen kan niet — wel door de vermelding te controleren en als “Nog geldig” te bevestigen.",
  },
  "rev:transfer": {
    de: "Die Leiterin der Ausbildungswerkstatt geht in Rente und überträgt ihre Einträge an ihren Nachfolger. Ihr Name bleibt als Herkunft sichtbar.",
    en: "The head of the training workshop retires and transfers her entries to her successor. Her name stays visible as the origin.",
    nl: "De leider van de opleidingswerkplaats gaat met pensioen en draagt haar vermeldingen over aan haar opvolger. Haar naam blijft zichtbaar als herkomst.",
  },
  "rev:deleteKo": {
    de: "Ein Eintrag wurde versehentlich doppelt angelegt und ist noch von niemandem verwendet. Die Autorin löscht ihn nach der Nachfrage; die Löschung steht im Protokoll.",
    en: "An entry was accidentally created twice and has not been used by anyone. The author deletes it after the confirmation prompt; the deletion is in the log.",
    nl: "Een vermelding is per ongeluk dubbel aangemaakt en nog door niemand gebruikt. De auteur verwijdert hem na de bevestigingsvraag; de verwijdering staat in het logboek.",
  },
  "rev:conflictEscalate": {
    de: "Die Pflegeleitung und die Hygienebeauftragte bleiben bei ihren unterschiedlichen Wechselintervallen. Du eskalierst — der Konflikt bleibt sichtbar, bis die zuständige Stelle entscheidet.",
    en: "The nursing manager and the hygiene officer stick to their different change intervals. You escalate — the conflict stays visible until the responsible body decides.",
    nl: "De zorgmanager en de hygiënecoördinator blijven bij hun verschillende wisselintervallen. Je escaleert — het conflict blijft zichtbaar tot de verantwoordelijke instantie beslist.",
  },
  "rev:conflictSecondOpinion": {
    de: "Du bittest den Statiker um seine Einschätzung zu den zwei Angaben zur Dachlast. Er schreibt, welche Norm gilt und warum — entschieden ist der Konflikt damit noch nicht.",
    en: "You ask the structural engineer for his view on the two roof load figures. He writes which standard applies and why — that does not decide the conflict yet.",
    nl: "Je vraagt de constructeur om zijn inschatting van de twee waarden voor de dakbelasting. Hij schrijft welke norm geldt en waarom — beslist is het conflict daarmee nog niet.",
  },
  "rev:conflictResolve": {
    de: "Entscheidung: „Acht bar gilt für Kessel 2 nach dem Umbau, sechs bar für Kessel 1.“ Festgehalten wird die Entscheidung; die beiden Einträge überarbeitet danach ein Mensch.",
    en: "Decision: “Eight bar applies to boiler 2 after the conversion, six bar to boiler 1.” The decision is recorded; a person then revises the two entries.",
    nl: "Beslissing: “Acht bar geldt voor ketel 2 na de verbouwing, zes bar voor ketel 1.” De beslissing wordt vastgelegd; de twee vermeldingen past daarna een mens aan.",
  },
};

/** Das Beispiel zu einer Elementerklärung in der UI-Sprache — `null`, wenn es keines gibt. */
export function klaraBeispiel(entryId: string, lng: string): string | null {
  return KLARA_BEISPIELE[entryId]?.[beispielSprache(lng)] ?? null;
}

/** Die Kennungen, die ein Beispiel tragen MÜSSEN — aus den Registern, nicht von Hand. */
export const BEISPIEL_PFLICHT: readonly string[] = [
  ...CAPTURE_HELP_IDS.map((id) => `cap:${id}`),
  ...REVIEW_HELP_IDS.map((id) => `rev:${id}`),
];
