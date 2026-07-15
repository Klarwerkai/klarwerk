// SCRUM-487: Dreisprachige Demo-/Seed-Inhalte (DE/EN/NL). Die Showcase-KOs und die beiden
// Kollisions-Konflikte erscheinen in der UI-Sprache des ladenden Admins (locale-Parameter beim
// Seed, Default "de"). INVARIANTE (Ehrlichkeit): der wörtliche Streitwert MUSS je Sprache als
// Teilstring in der zugehörigen Aussage UND im Belegzitat vorkommen (streitwertWoertlich=true) —
// blau∈DE, blue∈EN, blauw∈NL; Rot∈DE, red∈EN, rood∈NL. Kategorien/Tags bleiben bewusst
// sprachneutral (strukturelle Schlüssel/Gruppierung, keine „Aussage"); lokalisiert werden Titel,
// Aussagen, Bedingungen/Maßnahmen, die Konflikt-Texte und die Demo-Wissenslücke.
export type DemoLocale = "de" | "en" | "nl";

export interface KoText {
  title: string;
  statement: string;
  conditions?: string[];
  measures?: string[];
}

export interface ConflictText {
  description: string;
  rationale: string;
  quoteA: string;
  quoteB: string;
  streitpunkt: string;
  aKern: string;
  aWert: string;
  bKern: string;
  bWert: string;
}

export interface DemoTexts {
  koValid: KoText;
  koOpen: KoText;
  koWarm: KoText;
  koNoWarm: KoText;
  koCarBlau: KoText;
  koCarRot: KoText;
  koFilter: KoText;
  koPflege: KoText;
  koKanzlei: KoText;
  koVerein: KoText;
  koWasser: KoText;
  koSchweiss: KoText;
  koPresse: KoText;
  koNacht: KoText;
  koVergleich: KoText;
  koDreh: KoText;
  koNotstrom: KoText;
  koSchalt: KoText;
  gapQuestion: string;
  warmConflict: ConflictText;
  carConflict: ConflictText;
}

const de: DemoTexts = {
  koValid: {
    title: "Ventil X bei Überdruck manuell schließen.",
    statement:
      "Bei Überdruck über 6 bar Ventil X von Hand schließen, bis die Anlage entlastet ist.",
    conditions: ["Druck > 6 bar"],
    measures: ["Ventil X schließen"],
  },
  koOpen: {
    title: "Pumpe P2 alle 200 Betriebsstunden schmieren.",
    statement: "Pumpe P2 alle 200 h mit Fett Typ Z schmieren.",
  },
  koWarm: {
    title: "Bei Kaltstart zuerst die Vorwärmung aktivieren.",
    statement: "Vor dem Kaltstart die Vorwärmung 10 min laufen lassen.",
  },
  koNoWarm: {
    title: "Vorwärmung bei Kaltstart ist nicht nötig.",
    statement: "Kaltstart ohne Vorwärmung ist möglich und spart Zeit.",
  },
  koCarBlau: {
    title: "Firmenwagen: Pflichtfarbe Blau",
    statement: "Alle Firmenwagen müssen blau sein.",
  },
  koCarRot: {
    title: "Firmenwagen-Bestellrichtlinie: Farbe Rot",
    statement: "Firmenwagen werden ausschließlich in der Farbe Rot bestellt.",
  },
  koFilter: {
    title: "Filter F3 monatlich auf Verschmutzung prüfen.",
    statement: "Filter F3 einmal pro Monat auf Verschmutzung prüfen und bei Bedarf tauschen.",
  },
  koPflege: {
    title: "Sturzprotokoll noch am selben Tag anlegen.",
    statement:
      "Stürzt ein Bewohner, das Sturzprotokoll sofort anlegen und die Pflegedienstleitung informieren — Erinnerungen am Folgetag sind unzuverlässig.",
    conditions: ["Sturzereignis eines Bewohners"],
    measures: ["Protokoll sofort anlegen", "PDL informieren"],
  },
  koKanzlei: {
    title: "Fristsachen doppelt eintragen: Akte UND zentraler Kalender.",
    statement:
      "Jede Frist wird sowohl in der Akte als auch im zentralen Fristenkalender notiert; nur der Kalender löst die Vorfrist eine Woche vorher aus.",
  },
  koVerein: {
    title: "Vereinsfest: Schankgenehmigung sechs Wochen vorher beantragen.",
    statement:
      "Die Gemeinde braucht den Antrag auf Schankgenehmigung spätestens sechs Wochen vor dem Fest — später wird es eng, weil der Ordnungsamts-Ausschuss nur monatlich tagt.",
  },
  koWasser: {
    title: "Wasserschaden: Erstmeldung ohne Gutachten sofort anlegen.",
    statement:
      "Bei gemeldetem Wasserschaden die Schadenakte sofort mit der Erstmeldung eröffnen und nicht auf das Gutachten warten — die Regressfrist läuft ab Meldung, nicht ab Gutachten.",
  },
  koSchweiss: {
    title: "Schweißnaht Baugruppe 7: Werkstück vorwärmen senkt Nacharbeit.",
    statement:
      "Seit die Werkstücke vor dem Schweißen auf 80 °C vorgewärmt werden, geht die Nacharbeitsquote der Naht deutlich zurück — über drei Monate dokumentierte Lernkurve der Spätschicht.",
    conditions: ["Werkstück kälter als 80 °C"],
    measures: ["Vorwärmen auf 80 °C", "Temperatur dokumentieren"],
  },
  koPresse: {
    title: "Presse 3: dumpfes Brummen im Hauptlager ernst nehmen.",
    statement:
      "Beginnt das Hauptlager der Presse dumpf zu brummen, fällt es erfahrungsgemäß binnen weniger Tage aus — Gefühl erfahrener Instandhalter, noch ohne Messreihe.",
  },
  koNacht: {
    title: "Auffällig unruhige Nacht kündigt oft einen Infekt an.",
    statement:
      "Wird ein sonst ruhiger Bewohner nachts auffällig unruhig, folgt erfahrungsgemäß binnen 48 Stunden ein Infekt — Erfahrungsgefühl der Nachtwachen, ärztlich nicht bestätigt.",
  },
  koVergleich: {
    title: "Zu schnelle Zustimmung der Gegenseite: Nachforderungen einplanen.",
    statement:
      "Nimmt die Gegenseite ein Vergleichsangebot ungewöhnlich schnell an, folgen erfahrungsgemäß Nachforderungen — Bauchgefühl aus vielen Verfahren, keine belastbare Statistik.",
  },
  koDreh: {
    title: "Drehmomentschlüssel der Montage halbjährlich kalibrieren.",
    statement:
      "Alle Drehmomentschlüssel der Montage werden halbjährlich kalibriert; das Prüfprotokoll hängt am Gerät und wird bei der Ausgabe kontrolliert.",
  },
  koNotstrom: {
    title: "Notstromaggregat monatlich 30 Minuten unter Last testen.",
    statement:
      "Das Notstromaggregat läuft einmal im Monat 30 Minuten unter Last; erst der Lasttest zeigt schwache Batterien und verharzte Regler.",
  },
  koSchalt: {
    title: "Schaltschränke nicht mit Druckluft ausblasen.",
    statement:
      "Druckluft drückt Staub tiefer in Kontakte und Lüfter der Schaltschränke — führte zweimal zu Ausfällen. Nur absaugen, nie ausblasen.",
  },
  gapQuestion: "Warum schwankt der Dosierwert an Linie L4 nach jedem Schichtwechsel?",
  warmConflict: {
    description:
      "Automatisch erkannt: A verlangt Vorwärmung vor dem Kaltstart, B hält sie für unnötig.",
    rationale: "A verlangt Vorwärmung vor dem Kaltstart, B erklärt sie für unnötig.",
    quoteA: "Vor dem Kaltstart die Vorwärmung 10 min laufen lassen.",
    quoteB: "Kaltstart ohne Vorwärmung ist möglich und spart Zeit.",
    streitpunkt: "Vorwärmung bei Kaltstart",
    aKern: "Vor dem Kaltstart erst 10 Minuten vorwärmen.",
    aWert: "Vorwärmung 10 min",
    bKern: "Kaltstart ist ohne Vorwärmung möglich.",
    bWert: "ohne Vorwärmung",
  },
  carConflict: {
    description:
      "Automatisch erkannt: A schreibt Blau als Pflichtfarbe vor, B bestellt ausschließlich Rot.",
    rationale:
      "A schreibt Blau als Pflichtfarbe vor, während B Firmenwagen ausschließlich in Rot bestellt — direkt unvereinbar.",
    quoteA: "Alle Firmenwagen müssen blau sein.",
    quoteB: "Firmenwagen werden ausschließlich in der Farbe Rot bestellt.",
    streitpunkt: "Firmenwagenfarbe",
    aKern: "Alle Firmenwagen müssen blau sein.",
    aWert: "blau",
    bKern: "Firmenwagen ausschließlich in Rot bestellen.",
    bWert: "Rot",
  },
};

// EN/NL werden vom Übersetzungs-Slice befüllt (Platzhalter = de, damit der Baum kompiliert, bis die
// echten Übersetzungen stehen; die per-Sprache-Streitwert-Tests erzwingen die echten Werte).
const en: DemoTexts = {
  koValid: {
    title: "Manually close valve X on overpressure.",
    statement: "On overpressure above 6 bar, close valve X by hand until the system is relieved.",
    conditions: ["Pressure > 6 bar"],
    measures: ["Close valve X"],
  },
  koOpen: {
    title: "Lubricate pump P2 every 200 operating hours.",
    statement: "Lubricate pump P2 every 200 h with grease type Z.",
  },
  koWarm: {
    title: "On a cold start, activate the preheating first.",
    statement: "Let the preheating run for 10 min before a cold start.",
  },
  koNoWarm: {
    title: "Preheating is not needed on a cold start.",
    statement: "A cold start without preheating is possible and saves time.",
  },
  koCarBlau: {
    title: "Company cars: mandatory colour blue",
    statement: "All company cars must be blue.",
  },
  koCarRot: {
    title: "Company car ordering policy: colour red",
    statement: "Company cars are ordered exclusively in red.",
  },
  koFilter: {
    title: "Check filter F3 for fouling every month.",
    statement: "Check filter F3 for fouling once a month and replace it if needed.",
  },
  koPflege: {
    title: "Create the fall report on the same day.",
    statement:
      "If a resident falls, create the fall report immediately and inform the care management — reminders on the following day are unreliable.",
    conditions: ["A resident's fall event"],
    measures: ["Create the report immediately", "Inform care management"],
  },
  koKanzlei: {
    title: "Record deadlines twice: in the case file AND the central calendar.",
    statement:
      "Every deadline is recorded both in the case file and in the central deadline calendar; only the calendar triggers the advance warning one week ahead.",
  },
  koVerein: {
    title: "Club festival: apply for the liquor licence six weeks in advance.",
    statement:
      "The municipality needs the liquor licence application at least six weeks before the festival — any later and it gets tight, because the public order committee only meets monthly.",
  },
  koWasser: {
    title: "Water damage: open the initial report immediately, without an expert opinion.",
    statement:
      "When water damage is reported, open the claim file immediately with the initial report and do not wait for the expert opinion — the recourse deadline runs from the report, not from the opinion.",
  },
  koSchweiss: {
    title: "Weld seam on assembly 7: preheating the workpiece reduces rework.",
    statement:
      "Since the workpieces are preheated to 80 °C before welding, the seam's rework rate has dropped noticeably — a learning curve documented by the late shift over three months.",
    conditions: ["Workpiece colder than 80 °C"],
    measures: ["Preheat to 80 °C", "Document the temperature"],
  },
  koPresse: {
    title: "Press 3: take a dull hum in the main bearing seriously.",
    statement:
      "Once the press's main bearing starts to hum dully, experience shows it fails within a few days — a hunch of seasoned maintenance staff, not yet backed by measurements.",
  },
  koNacht: {
    title: "A strikingly restless night often heralds an infection.",
    statement:
      "If an otherwise calm resident becomes strikingly restless at night, experience shows an infection follows within 48 hours — a gut feeling of the night staff, not medically confirmed.",
  },
  koVergleich: {
    title: "The other side agreeing too quickly: plan for follow-up claims.",
    statement:
      "If the other side accepts a settlement offer unusually quickly, experience shows follow-up claims follow — a gut feeling from many proceedings, not solid statistics.",
  },
  koDreh: {
    title: "Calibrate the assembly's torque wrenches every six months.",
    statement:
      "All of the assembly's torque wrenches are calibrated every six months; the test log hangs on the tool and is checked when it is handed out.",
  },
  koNotstrom: {
    title: "Test the emergency generator under load for 30 minutes each month.",
    statement:
      "The emergency generator runs under load for 30 minutes once a month; only the load test reveals weak batteries and gummed-up regulators.",
  },
  koSchalt: {
    title: "Do not blow out control cabinets with compressed air.",
    statement:
      "Compressed air pushes dust deeper into the contacts and fans of the control cabinets — it caused failures twice. Only vacuum, never blow out.",
  },
  gapQuestion: "Why does the dosing value on line L4 fluctuate after every shift change?",
  warmConflict: {
    description:
      "Automatically detected: A requires preheating before a cold start, B considers it unnecessary.",
    rationale: "A requires preheating before a cold start, B declares it unnecessary.",
    quoteA: "Let the preheating run for 10 min before a cold start.",
    quoteB: "A cold start without preheating is possible and saves time.",
    streitpunkt: "Preheating on a cold start",
    aKern: "Preheat for 10 minutes before a cold start.",
    aWert: "preheating",
    bKern: "A cold start is possible without preheating.",
    bWert: "without preheating",
  },
  carConflict: {
    description:
      "Automatically detected: A mandates blue as the required colour, B orders exclusively red.",
    rationale:
      "A mandates blue as the required colour, while B orders company cars exclusively in red — directly incompatible.",
    quoteA: "All company cars must be blue.",
    quoteB: "Company cars are ordered exclusively in red.",
    streitpunkt: "Company car colour",
    aKern: "All company cars must be blue.",
    aWert: "blue",
    bKern: "Order company cars exclusively in red.",
    bWert: "red",
  },
};
const nl: DemoTexts = {
  koValid: {
    title: "Sluit klep X handmatig bij overdruk.",
    statement: "Sluit bij overdruk boven 6 bar klep X met de hand tot de installatie is ontlast.",
    conditions: ["Druk > 6 bar"],
    measures: ["Klep X sluiten"],
  },
  koOpen: {
    title: "Smeer pomp P2 elke 200 bedrijfsuren.",
    statement: "Smeer pomp P2 elke 200 h met vet type Z.",
  },
  koWarm: {
    title: "Activeer bij een koude start eerst de voorverwarming.",
    statement: "Laat de voorverwarming 10 min lopen voor een koude start.",
  },
  koNoWarm: {
    title: "Voorverwarmen is niet nodig bij een koude start.",
    statement: "Een koude start zonder voorverwarming kan en scheelt tijd.",
  },
  koCarBlau: {
    title: "Bedrijfsauto's: verplichte kleur blauw",
    statement: "Alle bedrijfsauto's moeten blauw zijn.",
  },
  koCarRot: {
    title: "Bestelrichtlijn bedrijfsauto's: kleur rood",
    statement: "Bedrijfsauto's worden uitsluitend in het rood besteld.",
  },
  koFilter: {
    title: "Controleer filter F3 maandelijks op vervuiling.",
    statement: "Controleer filter F3 eens per maand op vervuiling en vervang het zo nodig.",
  },
  koPflege: {
    title: "Maak het valprotocol nog dezelfde dag aan.",
    statement:
      "Valt een bewoner, maak dan direct het valprotocol aan en informeer het zorgmanagement — herinneringen de volgende dag zijn onbetrouwbaar.",
    conditions: ["Valincident van een bewoner"],
    measures: ["Direct protocol aanmaken", "Zorgmanagement informeren"],
  },
  koKanzlei: {
    title: "Noteer termijnen dubbel: in het dossier ÉN de centrale agenda.",
    statement:
      "Elke termijn wordt zowel in het dossier als in de centrale termijnagenda genoteerd; alleen de agenda geeft de voorwaarschuwing een week van tevoren.",
  },
  koVerein: {
    title: "Verenigingsfeest: vraag de tapvergunning zes weken vooraf aan.",
    statement:
      "De gemeente heeft de aanvraag voor de tapvergunning uiterlijk zes weken voor het feest nodig — later wordt het krap, omdat de commissie openbare orde maar maandelijks vergadert.",
  },
  koWasser: {
    title: "Waterschade: maak de eerste melding direct aan, zonder expertise.",
    statement:
      "Open bij een gemelde waterschade direct het schadedossier met de eerste melding en wacht niet op de expertise — de regrestermijn loopt vanaf de melding, niet vanaf de expertise.",
  },
  koSchweiss: {
    title: "Lasnaad module 7: het werkstuk voorverwarmen verlaagt het nawerk.",
    statement:
      "Sinds de werkstukken voor het lassen op 80 °C worden voorverwarmd, daalt het nawerkpercentage van de naad duidelijk — een leercurve die de late dienst over drie maanden heeft vastgelegd.",
    conditions: ["Werkstuk kouder dan 80 °C"],
    measures: ["Voorverwarmen tot 80 °C", "Temperatuur vastleggen"],
  },
  koPresse: {
    title: "Pers 3: neem een dof gebrom in het hoofdlager serieus.",
    statement:
      "Zodra het hoofdlager van de pers dof begint te brommen, valt het volgens de ervaring binnen enkele dagen uit — een gevoel van ervaren onderhoudsmonteurs, nog zonder meetreeks.",
  },
  koNacht: {
    title: "Een opvallend onrustige nacht kondigt vaak een infectie aan.",
    statement:
      "Wordt een verder rustige bewoner 's nachts opvallend onrustig, dan volgt volgens de ervaring binnen 48 uur een infectie — een onderbuikgevoel van de nachtwacht, medisch niet bevestigd.",
  },
  koVergleich: {
    title: "De tegenpartij die te snel instemt: houd rekening met naclaims.",
    statement:
      "Accepteert de tegenpartij een schikkingsvoorstel ongewoon snel, dan volgen volgens de ervaring naclaims — een onderbuikgevoel uit veel procedures, geen harde statistiek.",
  },
  koDreh: {
    title: "Kalibreer de momentsleutels van de montage halfjaarlijks.",
    statement:
      "Alle momentsleutels van de montage worden halfjaarlijks gekalibreerd; het keuringsprotocol hangt aan het gereedschap en wordt bij uitgifte gecontroleerd.",
  },
  koNotstrom: {
    title: "Test het noodstroomaggregaat maandelijks 30 minuten onder belasting.",
    statement:
      "Het noodstroomaggregaat draait eens per maand 30 minuten onder belasting; pas de belastingstest laat zwakke accu's en verharde regelaars zien.",
  },
  koSchalt: {
    title: "Blaas schakelkasten niet uit met perslucht.",
    statement:
      "Perslucht drukt stof dieper in de contacten en ventilatoren van de schakelkasten — dat leidde tweemaal tot uitval. Alleen afzuigen, nooit uitblazen.",
  },
  gapQuestion: "Waarom schommelt de doseerwaarde op lijn L4 na elke ploegwisseling?",
  warmConflict: {
    description:
      "Automatisch herkend: A vereist voorverwarming voor de koude start, B vindt dat onnodig.",
    rationale: "A vereist voorverwarming voor de koude start, B verklaart die onnodig.",
    quoteA: "Laat de voorverwarming 10 min lopen voor een koude start.",
    quoteB: "Een koude start zonder voorverwarming kan en scheelt tijd.",
    streitpunkt: "Voorverwarming bij een koude start",
    aKern: "Verwarm eerst 10 minuten voor bij een koude start.",
    aWert: "voorverwarming",
    bKern: "Een koude start kan zonder voorverwarming.",
    bWert: "zonder voorverwarming",
  },
  carConflict: {
    description:
      "Automatisch herkend: A schrijft blauw als verplichte kleur voor, B bestelt uitsluitend rood.",
    rationale:
      "A schrijft blauw als verplichte kleur voor, terwijl B bedrijfsauto's uitsluitend in het rood bestelt — direct onverenigbaar.",
    quoteA: "Alle bedrijfsauto's moeten blauw zijn.",
    quoteB: "Bedrijfsauto's worden uitsluitend in het rood besteld.",
    streitpunkt: "Kleur bedrijfsauto's",
    aKern: "Alle bedrijfsauto's moeten blauw zijn.",
    aWert: "blauw",
    bKern: "Bedrijfsauto's uitsluitend in het rood bestellen.",
    bWert: "rood",
  },
};

export const DEMO_TEXTS: Record<DemoLocale, DemoTexts> = { de, en, nl };

export function demoTexts(locale: DemoLocale): DemoTexts {
  return DEMO_TEXTS[locale];
}

// Alle drei lokalisierten Wissenslücken-Fragen — der Purge muss sie sprachübergreifend erkennen.
export const DEMO_GAP_QUESTIONS: readonly string[] = [
  de.gapQuestion,
  en.gapQuestion,
  nl.gapQuestion,
];
