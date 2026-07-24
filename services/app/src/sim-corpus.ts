// SCRUM-501 (nacht24 Paket 7.2): Demo-/Simulationskorpus DE/EN/NL für die Begutachter-Vorführung.
// ~30 realistische Industrie-Wissensobjekte JE SPRACHE (Pumpen/Ventile/Wartung/Normen), inklusive
// GEWOLLTER Duplikate und Konflikte quer durch die Sprachen (unten je Eintrag kommentiert).
// Muster: demoSeed-Markierung (Entfernen über den BESTEHENDEN Demo-Purge DELETE /api/admin/demo-seed),
// Sprach-Präfix im Titel ([DE]/[EN]/[NL] — dieselbe Kennung, die die Bibliotheks-/Import-Facetten
// erkennen). NICHT automatisch geladen: nur über den Admin-Endpunkt (users.manage) bzw. das
// Skript tools/seed-sim-corpus — Doku in docs/demo/SIM-KORPUS.md.
import type { KnowledgeType, KoService } from "../../knowledge-object";

export const SIM_CORPUS_TAG = "sim-korpus";

export interface SimKoDef {
  key: string; // stabil je Eintrag (Idempotenz-/Referenzanker, Teil der Doku)
  lang: "de" | "en" | "nl";
  title: string; // OHNE Sprach-Präfix — der Loader setzt "[DE] " usw. davor
  statement: string;
  type: KnowledgeType;
  category: "Pumpen" | "Ventile" | "Wartung" | "Normen";
  tags?: string[];
  conditions?: string[];
  measures?: string[];
  // Ein Teil des Korpus ist validiert (mit Trust), damit die Vorführung Substanz hat —
  // ehrlich deterministisch aus den Daten, keine Zufalls-Zahlen.
  validated?: { trust: number };
}

// Hilfsbau: je Fachinhalt eine DE/EN/NL-Drillinge-Gruppe. Die Drillinge sind BEWUSSTE
// Cross-Sprach-Duplikate (gleiche Aussage, andere Sprache) — Futter für die Duplikat-Erkennung.
function triplet(
  base: {
    key: string;
    category: SimKoDef["category"];
    type: KnowledgeType;
    tags?: string[];
    validated?: { trust: number };
  },
  de: { title: string; statement: string; conditions?: string[]; measures?: string[] },
  en: { title: string; statement: string; conditions?: string[]; measures?: string[] },
  nl: { title: string; statement: string; conditions?: string[]; measures?: string[] },
): SimKoDef[] {
  return [
    { ...base, key: `${base.key}-de`, lang: "de", ...de },
    { ...base, key: `${base.key}-en`, lang: "en", ...en },
    { ...base, key: `${base.key}-nl`, lang: "nl", ...nl },
  ];
}

// ---- Pumpen (8 Inhalte × 3 Sprachen = 24) --------------------------------------------------
const PUMPEN: SimKoDef[] = [
  ...triplet(
    { key: "p-entlueften", category: "Pumpen", type: "best_practice", validated: { trust: 78 } },
    {
      title: "Kreiselpumpe KP-110 vor dem Anfahren entlüften",
      statement:
        "Die Kreiselpumpe KP-110 wird vor jedem Anfahren am Entlüftungsstopfen entlüftet, bis blasenfreies Medium austritt. Trockenlauf zerstört die Gleitringdichtung innerhalb weniger Minuten.",
      measures: [
        "Entlüftungsstopfen eine Umdrehung öffnen",
        "Blasenfreien Austritt abwarten",
        "Stopfen mit 25 Nm anziehen",
      ],
    },
    {
      title: "Vent centrifugal pump KP-110 before start-up",
      statement:
        "Vent centrifugal pump KP-110 at the vent plug before every start-up until the medium runs free of bubbles. Dry running destroys the mechanical seal within minutes.",
      measures: ["Open vent plug one turn", "Wait for bubble-free flow", "Tighten plug to 25 Nm"],
    },
    {
      title: "Centrifugaalpomp KP-110 vóór het opstarten ontluchten",
      statement:
        "Ontlucht centrifugaalpomp KP-110 vóór elke start bij de ontluchtingsplug tot het medium zonder bellen uitstroomt. Drooglopen vernielt de glijringafdichting binnen enkele minuten.",
      measures: [
        "Ontluchtingsplug één slag openen",
        "Wachten op bellenvrije stroom",
        "Plug met 25 Nm aandraaien",
      ],
    },
  ),
  ...triplet(
    { key: "p-dichtung", category: "Pumpen", type: "technik", validated: { trust: 65 } },
    {
      title: "Gleitringdichtung der Dosierpumpe DP-3 alle 8.000 h tauschen",
      statement:
        "Die Gleitringdichtung der Dosierpumpe DP-3 wird vorbeugend alle 8.000 Betriebsstunden getauscht; Leckagen am Sperrdruck deuten auf vorzeitigen Verschleiß.",
      conditions: ["Betriebsstundenzähler dokumentiert", "Sperrdrucküberwachung aktiv"],
    },
    {
      title: "Replace mechanical seal of dosing pump DP-3 every 8,000 h",
      statement:
        "Replace the mechanical seal of dosing pump DP-3 preventively every 8,000 operating hours; leakage at the barrier pressure indicates premature wear.",
      conditions: ["Operating hours documented", "Barrier pressure monitoring active"],
    },
    {
      title: "Glijringafdichting van doseerpomp DP-3 elke 8.000 h vervangen",
      statement:
        "Vervang de glijringafdichting van doseerpomp DP-3 preventief elke 8.000 bedrijfsuren; lekkage bij de sperdruk wijst op voortijdige slijtage.",
      conditions: ["Bedrijfsuren gedocumenteerd", "Sperdrukbewaking actief"],
    },
  ),
  ...triplet(
    { key: "p-kavitation", category: "Pumpen", type: "lernkurve", validated: { trust: 55 } },
    {
      title: "Kavitation an der Speisepumpe SP-7 am Geräusch erkennen",
      statement:
        "Ein helles, kiesartiges Rasseln an der Speisepumpe SP-7 ist das früheste Kavitationszeichen — dann Zulaufdruck prüfen, bevor das Laufrad Schaden nimmt.",
    },
    {
      title: "Detect cavitation on feed pump SP-7 by its sound",
      statement:
        "A bright, gravel-like rattling on feed pump SP-7 is the earliest sign of cavitation — check suction pressure before the impeller takes damage.",
    },
    {
      title: "Cavitatie bij voedingspomp SP-7 aan het geluid herkennen",
      statement:
        "Een helder, grindachtig ratelen bij voedingspomp SP-7 is het vroegste teken van cavitatie — controleer de toeloopdruk voordat de waaier schade oploopt.",
    },
  ),
  ...triplet(
    { key: "p-lager", category: "Pumpen", type: "best_practice", validated: { trust: 72 } },
    {
      title: "Lagertemperatur der Umwälzpumpe UP-2 wöchentlich messen",
      statement:
        "Die Lagertemperatur der Umwälzpumpe UP-2 wird wöchentlich am Messpunkt M1 erfasst; ab 75 °C wird die Fettfüllung erneuert und der Trend gemeldet.",
      measures: [
        "Messpunkt M1 mit IR-Thermometer erfassen",
        "Ab 75 °C Fettfüllung erneuern",
        "Trend im Wartungsblatt führen",
      ],
    },
    {
      title: "Measure bearing temperature of circulation pump UP-2 weekly",
      statement:
        "Record the bearing temperature of circulation pump UP-2 weekly at measuring point M1; from 75 °C renew the grease filling and report the trend.",
      measures: [
        "Read point M1 with IR thermometer",
        "Renew grease from 75 °C",
        "Keep the trend in the maintenance sheet",
      ],
    },
    {
      title: "Lagertemperatuur van circulatiepomp UP-2 wekelijks meten",
      statement:
        "Registreer de lagertemperatuur van circulatiepomp UP-2 wekelijks op meetpunt M1; vanaf 75 °C wordt de vetvulling vernieuwd en de trend gemeld.",
      measures: [
        "Meetpunt M1 met IR-thermometer meten",
        "Vanaf 75 °C vetvulling vernieuwen",
        "Trend in het onderhoudsblad bijhouden",
      ],
    },
  ),
  // GEWOLLTER KONFLIKT quer durch die Sprachen: DE nennt 30 Minuten Nachlaufzeit, EN nennt 10
  // Minuten für DIESELBE Pumpe (Widerspruchs-Futter für die Konflikt-Erkennung/Validierung).
  {
    key: "p-nachlauf-de",
    lang: "de",
    category: "Pumpen",
    type: "best_practice",
    title: "Magnetkupplungspumpe MK-5 nach Abschaltung 30 Minuten nachlaufen lassen",
    statement:
      "Nach dem Abschalten der Magnetkupplungspumpe MK-5 bleibt die Kühlung 30 Minuten aktiv, damit die Magnetkupplung keine Restwärme in das Produkt trägt.",
    validated: { trust: 60 },
  },
  {
    key: "p-nachlauf-en",
    lang: "en",
    category: "Pumpen",
    type: "technik",
    title: "Let magnetic drive pump MK-5 coast down for 10 minutes after shutdown",
    statement:
      "After shutting down magnetic drive pump MK-5, keep the cooling active for 10 minutes — longer post-runs waste energy without measurable benefit.",
  },
  // Sprachinterne NAHE DUBLETTE (DE↔DE): gleiche Aussage, andere Formulierung — Duplikat-Futter.
  {
    key: "p-entlueften-dublette-de",
    lang: "de",
    category: "Pumpen",
    type: "lernkurve",
    title: "KP-110 niemals unentlüftet starten",
    statement:
      "Die KP-110 darf nie ohne Entlüftung anlaufen: erst am Stopfen entlüften, bis keine Blasen mehr kommen — sonst frisst die Gleitringdichtung in Minuten.",
  },
  ...triplet(
    { key: "p-anlauf", category: "Pumpen", type: "technik", validated: { trust: 74 } },
    {
      title: "Exzenterschneckenpumpe EX-4 nur gegen offenen Schieber anfahren",
      statement:
        "Die Exzenterschneckenpumpe EX-4 fährt nur gegen einen offenen druckseitigen Schieber an — ein geschlossener Schieber lässt den Druck in Sekunden über den Statorbruch steigen.",
    },
    {
      title: "Start progressive cavity pump EX-4 only against an open valve",
      statement:
        "Progressive cavity pump EX-4 starts only against an open discharge valve — a closed valve raises the pressure to stator failure within seconds.",
    },
    {
      title: "Wormpomp EX-4 alleen tegen een open afsluiter starten",
      statement:
        "Wormpomp EX-4 start alleen tegen een open persafsluiter — een gesloten afsluiter laat de druk binnen seconden tot statorbreuk stijgen.",
    },
  ),
  ...triplet(
    { key: "p-reserve", category: "Pumpen", type: "best_practice", validated: { trust: 68 } },
    {
      title: "Reservepumpe der Kühlwasserstation monatlich probelaufen lassen",
      statement:
        "Die Reservepumpe der Kühlwasserstation läuft einmal im Monat 15 Minuten Probelauf, damit Lager und Dichtung nicht festsitzen; der Lauf wird im Schichtbuch quittiert.",
    },
    {
      title: "Test-run the standby pump of the cooling water station monthly",
      statement:
        "Run the standby pump of the cooling water station for 15 minutes once a month so bearings and seal do not seize; sign the run off in the shift log.",
    },
    {
      title: "Reservepomp van het koelwaterstation maandelijks proefdraaien",
      statement:
        "Laat de reservepomp van het koelwaterstation eenmaal per maand 15 minuten proefdraaien zodat lagers en afdichting niet vastzitten; teken de run af in het ploegenboek.",
    },
  ),
  ...triplet(
    { key: "p-frost", category: "Pumpen", type: "negativwissen", validated: { trust: 63 } },
    {
      title: "Außenpumpen im Winter nie entleert stehen lassen",
      statement:
        "Außen aufgestellte Pumpen werden im Winter NICHT einfach entleert abgestellt: Restwasser im Gehäusesumpf friert und sprengt den Fuß — stattdessen Frostschutzprogramm fahren.",
    },
    {
      title: "Never leave outdoor pumps standing drained in winter",
      statement:
        "Outdoor pumps are NOT simply drained and parked in winter: residual water in the casing sump freezes and cracks the foot — run the frost protection program instead.",
    },
    {
      title: "Buitenpompen in de winter nooit leeg laten staan",
      statement:
        "Buiten opgestelde pompen worden in de winter NIET zomaar afgetapt weggezet: restwater in de pompvoet bevriest en scheurt het huis — draai het vorstbeschermingsprogramma.",
    },
  ),
];

// ---- Ventile (8 Inhalte, gemischt) ----------------------------------------------------------
const VENTILE: SimKoDef[] = [
  ...triplet(
    { key: "v-sicherheitsventil", category: "Ventile", type: "technik", validated: { trust: 82 } },
    {
      title: "Sicherheitsventil SV-200 nur mit Prüfprotokoll wieder einbauen",
      statement:
        "Das Sicherheitsventil SV-200 wird nach jeder Prüfung nur mit gültigem Prüfprotokoll und intakter Plombe wieder eingebaut; der Ansprechdruck beträgt 11,5 bar.",
      conditions: ["Prüfprotokoll liegt vor", "Plombe unversehrt"],
    },
    {
      title: "Reinstall safety valve SV-200 only with a test report",
      statement:
        "Safety valve SV-200 is reinstalled after each test only with a valid test report and intact seal; the set pressure is 11.5 bar.",
      conditions: ["Test report available", "Seal intact"],
    },
    {
      title: "Veiligheidsventiel SV-200 alleen met keuringsrapport terugplaatsen",
      statement:
        "Veiligheidsventiel SV-200 wordt na elke keuring alleen met geldig keuringsrapport en intacte verzegeling teruggeplaatst; de insteldruk bedraagt 11,5 bar.",
      conditions: ["Keuringsrapport aanwezig", "Verzegeling intact"],
    },
  ),
  ...triplet(
    { key: "v-schieber", category: "Ventile", type: "best_practice", validated: { trust: 70 } },
    {
      title: "Absperrschieber AS-40 nie als Regelarmatur fahren",
      statement:
        "Der Absperrschieber AS-40 fährt nur AUF oder ZU. Dauerhafte Zwischenstellungen schneiden den Keil ein und machen den Schieber undicht.",
    },
    {
      title: "Never operate gate valve AS-40 as a control valve",
      statement:
        "Gate valve AS-40 runs fully OPEN or fully CLOSED only. Permanent intermediate positions wire-draw the wedge and make the valve leak.",
    },
    {
      title: "Afsluiter AS-40 nooit als regelafsluiter gebruiken",
      statement:
        "Afsluiter AS-40 staat alleen volledig OPEN of DICHT. Blijvende tussenstanden snijden de wig in en maken de afsluiter lek.",
    },
  ),
  ...triplet(
    { key: "v-stellventil", category: "Ventile", type: "technik", validated: { trust: 58 } },
    {
      title: "Stellventil RV-12: Stopfbuchse nach 500 Hüben nachziehen",
      statement:
        "Beim Stellventil RV-12 wird die Stopfbuchse nach je 500 Hüben handfest nachgezogen; tropfende Spindeln vorher mit dem Leckage-Kennzeichen melden.",
      measures: [
        "Hubzähler ablesen",
        "Stopfbuchse kreuzweise handfest nachziehen",
        "Leckage im System melden",
      ],
    },
    {
      title: "Control valve RV-12: retighten the gland after 500 strokes",
      statement:
        "On control valve RV-12 the gland is retightened hand-tight after every 500 strokes; report dripping stems with the leakage tag first.",
      measures: [
        "Read the stroke counter",
        "Retighten gland crosswise hand-tight",
        "Report leakage in the system",
      ],
    },
    {
      title: "Regelventiel RV-12: pakkingbus na 500 slagen aandraaien",
      statement:
        "Bij regelventiel RV-12 wordt de pakkingbus na elke 500 slagen handvast aangedraaid; druppelende spindels eerst met het lekkagelabel melden.",
      measures: [
        "Slagenteller aflezen",
        "Pakkingbus kruiselings handvast aandraaien",
        "Lekkage in het systeem melden",
      ],
    },
  ),
  // GEWOLLTER KONFLIKT (DE↔NL): Prüfintervall des Rückschlagventils 12 Monate vs. 6 Monate.
  {
    key: "v-rueckschlag-de",
    lang: "de",
    category: "Ventile",
    type: "technik",
    title: "Rückschlagventil RK-8 alle 12 Monate prüfen",
    statement:
      "Das Rückschlagventil RK-8 wird alle 12 Monate auf Dichtheit und Klappenspiel geprüft — das Intervall stammt aus der Herstellerfreigabe von 2024.",
    validated: { trust: 62 },
  },
  {
    key: "v-rueckschlag-nl",
    lang: "nl",
    category: "Ventile",
    type: "lernkurve",
    title: "Terugslagklep RK-8 elke 6 maanden controleren",
    statement:
      "Controleer terugslagklep RK-8 elke 6 maanden op dichtheid en klepspeling — in de praktijk slijt de klep sneller dan de fabrikant aangeeft.",
  },
  // Nahe EN-Dublette zum Schieber-Inhalt (Duplikat-Futter innerhalb EN).
  {
    key: "v-schieber-dublette-en",
    lang: "en",
    category: "Ventile",
    type: "lernkurve",
    title: "Gate valve AS-40: open fully or close fully",
    statement:
      "Do not throttle with gate valve AS-40 — leave it fully open or fully closed, otherwise the wedge erodes and the valve starts leaking.",
  },
  ...triplet(
    { key: "v-kugelhahn", category: "Ventile", type: "best_practice", validated: { trust: 71 } },
    {
      title: "Kugelhahn KH-25 vierteljährlich eine volle Schaltbewegung fahren",
      statement:
        "Selten benutzte Kugelhähne KH-25 werden vierteljährlich einmal voll geschlossen und geöffnet, damit sich die Kugel nicht im Sitz festsetzt.",
    },
    {
      title: "Cycle ball valve KH-25 fully once per quarter",
      statement:
        "Rarely used ball valves KH-25 are fully closed and reopened once per quarter so the ball does not seize in its seat.",
    },
    {
      title: "Kogelkraan KH-25 elk kwartaal één volledige slag maken",
      statement:
        "Zelden gebruikte kogelkranen KH-25 worden elk kwartaal eenmaal volledig gesloten en geopend zodat de kogel niet in de zitting vastloopt.",
    },
  ),
  ...triplet(
    { key: "v-membran", category: "Ventile", type: "technik", validated: { trust: 61 } },
    {
      title: "Membranventile der Dosierstrecke nach Chemikalienwechsel prüfen",
      statement:
        "Nach jedem Chemikalienwechsel an der Dosierstrecke wird die Membranverträglichkeit gegen die Beständigkeitsliste geprüft; EPDM verträgt keine konzentrierten Säuren.",
    },
    {
      title: "Check diaphragm valves of the dosing line after a chemical change",
      statement:
        "After every chemical change on the dosing line, check diaphragm compatibility against the resistance list; EPDM does not tolerate concentrated acids.",
    },
    {
      title: "Membraanventielen van de doseerlijn na chemicaliënwissel controleren",
      statement:
        "Na elke chemicaliënwissel aan de doseerlijn wordt de membraanbestendigheid tegen de bestendigheidslijst gecontroleerd; EPDM verdraagt geen geconcentreerde zuren.",
    },
  ),
  ...triplet(
    { key: "v-antrieb", category: "Ventile", type: "lernkurve", validated: { trust: 52 } },
    {
      title: "Pneumatikantrieb PA-6: Endlagen nach Montage neu teachen",
      statement:
        "Nach jedem Ausbau des Pneumatikantriebs PA-6 werden die Endlagenschalter neu geteacht — übernommene Alt-Werte melden „ZU“, obwohl das Ventil einen Spalt offen steht.",
    },
    {
      title: "Pneumatic actuator PA-6: re-teach the end positions after mounting",
      statement:
        "After every removal of pneumatic actuator PA-6, re-teach the limit switches — carried-over old values report CLOSED although the valve stays open a crack.",
    },
    {
      title: "Pneumatische aandrijving PA-6: eindstanden na montage opnieuw inleren",
      statement:
        "Na elke demontage van pneumatische aandrijving PA-6 worden de eindschakelaars opnieuw ingeleerd — overgenomen oude waarden melden DICHT terwijl het ventiel op een kier staat.",
    },
  ),
];

// ---- Wartung (8 Inhalte, gemischt) ----------------------------------------------------------
const WARTUNG: SimKoDef[] = [
  ...triplet(
    { key: "w-loto", category: "Wartung", type: "best_practice", validated: { trust: 88 } },
    {
      title: "LOTO-Verriegelung vor jedem Eingriff an Anlage 3",
      statement:
        "Vor jedem Eingriff an Anlage 3 gilt Lockout-Tagout: Energien trennen, verriegeln, kennzeichnen und die Energiefreiheit an der Prüfstelle nachweisen.",
      measures: [
        "Hauptschalter verriegeln",
        "Anhänger mit Namen anbringen",
        "Energiefreiheit messen und dokumentieren",
      ],
    },
    {
      title: "LOTO lockout before any intervention on plant 3",
      statement:
        "Before any intervention on plant 3, lockout-tagout applies: isolate energies, lock, tag and prove zero energy at the test point.",
      measures: ["Lock the main switch", "Attach a name tag", "Measure and document zero energy"],
    },
    {
      title: "LOTO-vergrendeling vóór elke ingreep aan installatie 3",
      statement:
        "Vóór elke ingreep aan installatie 3 geldt lockout-tagout: energieën scheiden, vergrendelen, labelen en de energievrijheid op het meetpunt aantonen.",
      measures: [
        "Hoofdschakelaar vergrendelen",
        "Label met naam aanbrengen",
        "Energievrijheid meten en documenteren",
      ],
    },
  ),
  ...triplet(
    { key: "w-filter", category: "Wartung", type: "best_practice", validated: { trust: 66 } },
    {
      title: "Hydraulikfilter der Presse HP-1 bei 2,5 bar Differenzdruck wechseln",
      statement:
        "Der Hydraulikfilter der Presse HP-1 wird beim Erreichen von 2,5 bar Differenzdruck gewechselt, nicht nach festem Kalender — die Anzeige ist maßgeblich.",
    },
    {
      title: "Change hydraulic filter of press HP-1 at 2.5 bar differential pressure",
      statement:
        "Change the hydraulic filter of press HP-1 when 2.5 bar differential pressure is reached, not on a fixed calendar — the gauge governs.",
    },
    {
      title: "Hydrauliekfilter van pers HP-1 bij 2,5 bar drukverschil vervangen",
      statement:
        "Vervang het hydrauliekfilter van pers HP-1 bij het bereiken van 2,5 bar drukverschil, niet volgens een vaste kalender — de meter is bepalend.",
    },
  ),
  ...triplet(
    { key: "w-riemen", category: "Wartung", type: "lernkurve", validated: { trust: 54 } },
    {
      title: "Keilriemen des Lüfters L-9 nach 48 h Nachspannen",
      statement:
        "Neue Keilriemen am Lüfter L-9 längen sich in den ersten Stunden: nach 48 Betriebsstunden nachspannen, sonst wandert der Riemen und die Flanken glasieren.",
    },
    {
      title: "Retension the V-belts of fan L-9 after 48 h",
      statement:
        "New V-belts on fan L-9 stretch during the first hours: retension after 48 operating hours, otherwise the belt wanders and the flanks glaze.",
    },
    {
      title: "V-snaren van ventilator L-9 na 48 uur naspannen",
      statement:
        "Nieuwe V-snaren op ventilator L-9 rekken in de eerste uren: na 48 bedrijfsuren naspannen, anders loopt de snaar scheef en verglazen de flanken.",
    },
  ),
  // GEWOLLTER KONFLIKT (EN↔DE): Schmierintervall Kettenförderer 200 h vs. „vor jeder Schicht".
  {
    key: "w-kette-de",
    lang: "de",
    category: "Wartung",
    type: "best_practice",
    title: "Kette des Förderers KF-2 vor jeder Schicht schmieren",
    statement:
      "Die Kette des Förderers KF-2 wird vor jeder Schicht mit zwei Hüben Kettenöl geschmiert — Trockenlauf war 2025 zweimal Stillstandsursache.",
    validated: { trust: 59 },
  },
  {
    key: "w-kette-en",
    lang: "en",
    category: "Wartung",
    type: "lernkurve",
    title: "Lubricate conveyor chain KF-2 only every 200 operating hours",
    statement:
      "Lubricate the chain of conveyor KF-2 only every 200 operating hours — more frequent oiling binds dust and grinds the joints.",
  },
  // NL-Einzelstück ohne Pendant (kein Duplikat — normale Bestandsbreite).
  {
    key: "w-koeling-nl",
    lang: "nl",
    category: "Wartung",
    type: "lernkurve",
    title: "Koelwatercircuit van lasrobot LR-4 maandelijks spoelen",
    statement:
      "Spoel het koelwatercircuit van lasrobot LR-4 maandelijks door; algengroei in de zomer verstopt anders de toortskoeling.",
  },
  ...triplet(
    { key: "w-vibration", category: "Wartung", type: "technik", validated: { trust: 76 } },
    {
      title: "Schwingungsmessung am Getriebe G-11 quartalsweise fahren",
      statement:
        "Am Getriebe G-11 wird quartalsweise die Schwinggeschwindigkeit gemessen; ab 4,5 mm/s (RMS) wird eine Lagerdiagnose beauftragt, ab 7,1 mm/s wird abgestellt.",
      conditions: ["Messpunkte markiert", "Referenzspektrum vorhanden"],
    },
    {
      title: "Run quarterly vibration measurement on gearbox G-11",
      statement:
        "Measure vibration velocity on gearbox G-11 quarterly; from 4.5 mm/s (RMS) order a bearing diagnosis, from 7.1 mm/s shut down.",
      conditions: ["Measuring points marked", "Reference spectrum available"],
    },
    {
      title: "Trillingsmeting aan tandwielkast G-11 elk kwartaal uitvoeren",
      statement:
        "Meet de trillingssnelheid aan tandwielkast G-11 elk kwartaal; vanaf 4,5 mm/s (RMS) wordt een lagerdiagnose aangevraagd, vanaf 7,1 mm/s wordt stilgezet.",
      conditions: ["Meetpunten gemarkeerd", "Referentiespectrum aanwezig"],
    },
  ),
  ...triplet(
    { key: "w-ersatzteil", category: "Wartung", type: "best_practice", validated: { trust: 69 } },
    {
      title: "Kritische Ersatzteile vor dem Einbau auf Lagerbeleg prüfen",
      statement:
        "Kritische Ersatzteile (Dichtungen, Lager, Elektronikkarten) werden vor dem Einbau gegen den Lagerbeleg und das Anlagenkennzeichen geprüft — Verwechslungen waren 2025 dreimal Stillstandsursache.",
    },
    {
      title: "Check critical spare parts against the stock record before installation",
      statement:
        "Check critical spare parts (seals, bearings, electronic cards) against the stock record and the plant tag before installation — mix-ups caused three standstills in 2025.",
    },
    {
      title: "Kritische reserveonderdelen vóór inbouw tegen de magazijnbon controleren",
      statement:
        "Controleer kritische reserveonderdelen (afdichtingen, lagers, elektronicakaarten) vóór inbouw tegen de magazijnbon en de installatiecode — verwisselingen veroorzaakten in 2025 drie stilstanden.",
    },
  ),
  ...triplet(
    { key: "w-druckluft", category: "Wartung", type: "lernkurve", validated: { trust: 57 } },
    {
      title: "Druckluft-Leckagen mit Ultraschall in der Nachtschicht orten",
      statement:
        "Druckluft-Leckagen werden mit dem Ultraschallgerät in der Nachtschicht geortet, wenn die Halle leise ist — eine 3-mm-Leckage kostet rund 2.000 Euro Strom im Jahr.",
    },
    {
      title: "Locate compressed air leaks with ultrasound during the night shift",
      statement:
        "Locate compressed air leaks with the ultrasonic detector during the night shift when the hall is quiet — a 3 mm leak costs about 2,000 euros of electricity per year.",
    },
    {
      title: "Persluchtlekkages met ultrasoon in de nachtdienst opsporen",
      statement:
        "Spoor persluchtlekkages met de ultrasoondetector op in de nachtdienst wanneer de hal stil is — een lek van 3 mm kost ongeveer 2.000 euro stroom per jaar.",
    },
  ),
];

// ---- Normen (6 Inhalte, gemischt) -----------------------------------------------------------
const NORMEN: SimKoDef[] = [
  ...triplet(
    { key: "n-druckpruefung", category: "Normen", type: "technik", validated: { trust: 85 } },
    {
      title: "Druckprüfung nach AD 2000 HP 30 dokumentieren",
      statement:
        "Druckprüfungen an Behältern der Linie 2 werden nach AD 2000 Merkblatt HP 30 durchgeführt und mit Prüfdruck, Haltezeit und Prüfer im Anlagenbuch dokumentiert.",
      conditions: ["Prüfmanometer kalibriert", "Prüfer benannt"],
    },
    {
      title: "Document pressure tests according to AD 2000 HP 30",
      statement:
        "Pressure tests on line 2 vessels follow AD 2000 code sheet HP 30 and are documented in the plant log with test pressure, hold time and inspector.",
      conditions: ["Test gauge calibrated", "Inspector named"],
    },
    {
      title: "Drukproef volgens AD 2000 HP 30 documenteren",
      statement:
        "Drukproeven aan vaten van lijn 2 volgen AD 2000-blad HP 30 en worden met proefdruk, houdtijd en keurmeester in het installatieboek gedocumenteerd.",
      conditions: ["Proefmanometer gekalibreerd", "Keurmeester benoemd"],
    },
  ),
  ...triplet(
    { key: "n-atex", category: "Normen", type: "technik", validated: { trust: 80 } },
    {
      title: "ATEX-Zone 1: nur bescheinigte Geräte der Kategorie 2G",
      statement:
        "In der ATEX-Zone 1 der Lösemittel-Anlage dürfen nur Geräte der Kategorie 2G mit gültiger EU-Baumusterprüfbescheinigung eingesetzt werden.",
    },
    {
      title: "ATEX zone 1: only certified category 2G equipment",
      statement:
        "In ATEX zone 1 of the solvent plant, only category 2G equipment with a valid EU type examination certificate may be used.",
    },
    {
      title: "ATEX-zone 1: alleen gecertificeerde apparatuur van categorie 2G",
      statement:
        "In ATEX-zone 1 van de oplosmiddelinstallatie mag alleen apparatuur van categorie 2G met geldig EU-typeonderzoekscertificaat worden ingezet.",
    },
  ),
  ...triplet(
    { key: "n-leitern", category: "Normen", type: "technik", validated: { trust: 73 } },
    {
      title: "Leitern und Tritte jährlich nach DGUV Information 208-016 prüfen",
      statement:
        "Alle Leitern und Tritte werden jährlich durch die befähigte Person nach DGUV Information 208-016 geprüft und mit Prüfplakette samt Jahresfarbe versehen.",
    },
    {
      title: "Inspect ladders and steps annually per DGUV Information 208-016",
      statement:
        "All ladders and steps are inspected annually by the qualified person per DGUV Information 208-016 and receive an inspection sticker with the year colour.",
    },
    {
      title: "Ladders en trapjes jaarlijks volgens DGUV-informatie 208-016 keuren",
      statement:
        "Alle ladders en trapjes worden jaarlijks door de bevoegde persoon volgens DGUV-informatie 208-016 gekeurd en voorzien van een keuringssticker met jaarkleur.",
    },
  ),
  ...triplet(
    { key: "n-kalibrier", category: "Normen", type: "best_practice", validated: { trust: 67 } },
    {
      title: "Prüfmittel nach ISO 9001 mit Kalibrierkennzeichen führen",
      statement:
        "Messschieber, Manometer und Drehmomentschlüssel tragen ein Kalibrierkennzeichen mit Fälligkeitsdatum; überfällige Prüfmittel werden gesperrt, nicht „noch schnell benutzt“.",
    },
    {
      title: "Manage measuring equipment with calibration labels per ISO 9001",
      statement:
        "Calipers, pressure gauges and torque wrenches carry a calibration label with due date; overdue equipment is locked away, not used one more time.",
    },
    {
      title: "Meetmiddelen volgens ISO 9001 met kalibratielabel beheren",
      statement:
        "Schuifmaten, manometers en momentsleutels dragen een kalibratielabel met vervaldatum; verlopen meetmiddelen worden geblokkeerd, niet nog even gebruikt.",
    },
  ),
  ...triplet(
    { key: "n-gefahrstoff", category: "Normen", type: "technik", validated: { trust: 79 } },
    {
      title: "Gefahrstoffe nur mit aktuellem Sicherheitsdatenblatt umfüllen",
      statement:
        "Gefahrstoffe werden nur umgefüllt, wenn das Sicherheitsdatenblatt aktuell (Ausgabestand ≤ 2 Jahre) am Arbeitsplatz vorliegt und die Kleingebinde korrekt gekennzeichnet sind.",
    },
    {
      title: "Decant hazardous substances only with a current safety data sheet",
      statement:
        "Hazardous substances are decanted only if the safety data sheet is current (issue ≤ 2 years) at the workplace and the small containers are labelled correctly.",
    },
    {
      title: "Gevaarlijke stoffen alleen met actueel veiligheidsinformatieblad overgieten",
      statement:
        "Gevaarlijke stoffen worden alleen overgegoten als het veiligheidsinformatieblad actueel is (uitgave ≤ 2 jaar) op de werkplek aanwezig is en de kleinverpakkingen correct zijn geëtiketteerd.",
    },
  ),
];

export const SIM_CORPUS: readonly SimKoDef[] = [...PUMPEN, ...VENTILE, ...WARTUNG, ...NORMEN];

const LANG_PREFIX: Record<SimKoDef["lang"], string> = { de: "[DE] ", en: "[EN] ", nl: "[NL] " };

export interface SimCorpusResult {
  seeded: boolean; // false = Korpus (Tag sim-korpus) war schon vorhanden — nichts dupliziert
  created: number;
  validated: number;
  byLanguage: Record<SimKoDef["lang"], number>;
}

export interface SimCorpusServices {
  ko: Pick<KoService, "list" | "create" | "setValidationState">;
}

// Idempotenter Loader: existiert bereits ein KO mit dem sim-korpus-Tag, wird NICHTS dupliziert.
// Jedes KO trägt demoSeed:true (Entfernen über den bestehenden Demo-Purge) + das sim-korpus-Tag
// + das Sprach-Präfix im Titel. Ein Teil ist deterministisch validiert (Substanz für die Demo).
export async function loadSimCorpus(
  services: SimCorpusServices,
  actorId: string,
): Promise<SimCorpusResult> {
  const existing = await services.ko.list();
  if (existing.some((ko) => (ko.tags ?? []).includes(SIM_CORPUS_TAG))) {
    return { seeded: false, created: 0, validated: 0, byLanguage: { de: 0, en: 0, nl: 0 } };
  }
  let validated = 0;
  const byLanguage: Record<SimKoDef["lang"], number> = { de: 0, en: 0, nl: 0 };
  for (const def of SIM_CORPUS) {
    const created = await services.ko.create({
      title: `${LANG_PREFIX[def.lang]}${def.title}`,
      statement: def.statement,
      type: def.type,
      category: def.category,
      author: actorId,
      tags: [SIM_CORPUS_TAG, ...(def.tags ?? [])],
      conditions: def.conditions ?? [],
      measures: def.measures ?? [],
      demoSeed: true,
    });
    byLanguage[def.lang] += 1;
    if (def.validated) {
      await services.ko.setValidationState(created.id, {
        trust: def.validated.trust,
        status: "validiert",
      });
      validated += 1;
    }
  }
  return { seeded: true, created: SIM_CORPUS.length, validated, byLanguage };
}
