// ================================================================================================
// KONFLIKTARBEIT · Aufnahme gesamt-konfliktklassifikation — R-0252, R-0215, R-0263.
// ================================================================================================
//
// R-0252: der Satz VOR den beiden Karten sagt, welche Art von Arbeit vorliegt (Regel, Sache,
// Version) und woher die Einordnung stammt — bei der Anlage gewählt oder von der Konfliktprüfung
// erkannt. Ohne Einordnung sagt er genau das; er rät keine Art aus der Konfliktart.
// R-0215: der Hinweis unter dem Band, solange ein Wahrheitskonflikt noch nicht eskaliert ist.
// R-0263: die Wahl „überstimmt" / „präzisiert" samt Geltungsbereich bei der Entscheidung und der
// Vorrang, wie er danach am einzelnen Punkt steht.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "konfliktarbeit.",
  legacySchluessel: [],
  de: {
    "konfliktarbeit.satz.regel":
      "Regelkonflikt: zwei interne Festlegungen stehen gegeneinander. Keine Quelle kann ihn entscheiden — das tut eine befugte Person.",
    "konfliktarbeit.satz.sache":
      "Sachkonflikt: durch Belege entscheidbar — welche Aussage zutrifft, zeigen Quellen und Nachweise.",
    "konfliktarbeit.satz.version":
      "Versionskonflikt: dieselbe Sache in zwei Ständen — zu klären ist, welcher Stand gilt.",
    "konfliktarbeit.satz.offen":
      "Noch nicht eingeordnet: ob ein Regel-, Sach- oder Versionskonflikt vorliegt, legt eine befugte Person fest, bevor entschieden wird.",
    "konfliktarbeit.einordnen.regel": "Als Regelkonflikt einordnen",
    "konfliktarbeit.einordnen.sache": "Als Sachkonflikt einordnen",
    "konfliktarbeit.einordnen.version": "Als Versionskonflikt einordnen",
    "konfliktarbeit.einordnung.zuerst":
      "Erst einordnen: je nach Art der Arbeit stehen andere Entscheidungen offen.",
    "konfliktarbeit.next.einordnen": "Als Regel-, Sach- oder Versionskonflikt einordnen.",
    "konfliktarbeit.vorschlag.widerspruch":
      "Klaras Vorschlag: ein Widerspruch — eine Aussage überstimmt die andere. Entscheiden müssen Sie.",
    "konfliktarbeit.vorschlag.praezisierung":
      "Klaras Vorschlag: eine Präzisierung — „{{title}}“ legt es für den Geltungsbereich „{{bereich}}“ genauer fest, die andere Aussage bleibt außerhalb davon gültig. Entscheiden müssen Sie.",
    "konfliktarbeit.gewaehlt": "Bei der Anlage so eingeordnet.",
    "konfliktarbeit.erkannt": "Von der Konfliktprüfung so eingeordnet.",
    "konfliktarbeit.knopf.standLinks": "Linker Stand gilt",
    "konfliktarbeit.knopf.standRechts": "Rechter Stand gilt",
    "konfliktarbeit.eskalation.zuerst":
      "Ein Wahrheitskonflikt wird zuerst an einen Menschen eskaliert. Danach stehen Zweitmeinung und Entscheidung offen.",
    "konfliktarbeit.feld": "Art der Arbeit",
    "konfliktarbeit.feld.offen": "Art der Arbeit wählen …",
    "konfliktarbeit.name.regel": "Regelkonflikt — nur eine befugte Person entscheidet",
    "konfliktarbeit.name.sache": "Sachkonflikt — durch Belege entscheidbar",
    "konfliktarbeit.name.version": "Versionskonflikt — dieselbe Sache, zwei Stände",
    "konfliktarbeit.vorrang.frage": "Wie gilt die gewählte Aussage?",
    "konfliktarbeit.vorrang.ueberstimmt": "Sie überstimmt die andere Aussage",
    "konfliktarbeit.vorrang.schraenktEin":
      "Sie präzisiert die andere nur: sie gilt in einem Geltungsbereich, die andere bleibt außerhalb davon gültig",
    "konfliktarbeit.vorrang.geltungsbereich": "Geltungsbereich",
    "konfliktarbeit.vorrang.geltungsbereichHinweis": "z. B. „Bolzen X an Anlage 3“",
    "konfliktarbeit.vorrang.wirkung":
      "Es ändert sich nur die Beziehung zwischen diesen beiden Aussagen. Beide Aussagen, ihre Quellen und alle übrigen Punkte desselben Dokuments bleiben unverändert.",
    "konfliktarbeit.amPunkt.titel": "Vorrang aus Konfliktentscheidungen",
    "konfliktarbeit.amPunkt.ueberstimmtVon":
      "Überstimmt durch „{{title}}“. Diese Aussage, ihre Quellen und ihre Herkunft bleiben erhalten.",
    "konfliktarbeit.amPunkt.hatVorrang": "Hat Vorrang vor „{{title}}“.",
    "konfliktarbeit.amPunkt.eingeschraenktVon":
      "Eingeschränkt durch „{{title}}“ im Geltungsbereich „{{bereich}}“ — außerhalb davon gilt diese Aussage weiter.",
    "konfliktarbeit.amPunkt.praezisiert":
      "Präzisiert „{{title}}“ für den Geltungsbereich „{{bereich}}“.",
    "konfliktarbeit.amPunkt.bereichZurueck": "zurückgehalten",
    "konfliktarbeit.amPunkt.andere": "eine andere Aussage",
  },
  en: {
    "konfliktarbeit.satz.regel":
      "Rule conflict: two internal decisions stand against each other. No source can settle it — an authorised person does.",
    "konfliktarbeit.satz.sache":
      "Factual conflict: can be settled by evidence — sources and proof show which statement is correct.",
    "konfliktarbeit.satz.version":
      "Version conflict: the same thing in two states — the question is which state applies.",
    "konfliktarbeit.satz.offen":
      "Not classified yet: whether this is a rule, factual or version conflict is set by an authorised person before deciding.",
    "konfliktarbeit.einordnen.regel": "Classify as rule conflict",
    "konfliktarbeit.einordnen.sache": "Classify as factual conflict",
    "konfliktarbeit.einordnen.version": "Classify as version conflict",
    "konfliktarbeit.einordnung.zuerst":
      "Classify first: depending on the kind of work, different decisions are available.",
    "konfliktarbeit.next.einordnen": "Classify as a rule, factual or version conflict.",
    "konfliktarbeit.vorschlag.widerspruch":
      "Klara suggests: a contradiction — one statement overrules the other. The decision is yours.",
    "konfliktarbeit.vorschlag.praezisierung":
      "Klara suggests: a refinement — “{{title}}” specifies it for the scope “{{bereich}}”, the other statement stays valid outside of it. The decision is yours.",
    "konfliktarbeit.gewaehlt": "Classified this way when it was reported.",
    "konfliktarbeit.erkannt": "Classified this way by the conflict check.",
    "konfliktarbeit.knopf.standLinks": "Left state applies",
    "konfliktarbeit.knopf.standRechts": "Right state applies",
    "konfliktarbeit.eskalation.zuerst":
      "A truth conflict is first escalated to a person. After that, second opinion and decision are open.",
    "konfliktarbeit.feld": "Kind of work",
    "konfliktarbeit.feld.offen": "Choose the kind of work …",
    "konfliktarbeit.name.regel": "Rule conflict — only an authorised person decides",
    "konfliktarbeit.name.sache": "Factual conflict — can be settled by evidence",
    "konfliktarbeit.name.version": "Version conflict — the same thing, two states",
    "konfliktarbeit.vorrang.frage": "How does the chosen statement apply?",
    "konfliktarbeit.vorrang.ueberstimmt": "It overrules the other statement",
    "konfliktarbeit.vorrang.schraenktEin":
      "It only refines the other: it applies within a scope, the other stays valid outside of it",
    "konfliktarbeit.vorrang.geltungsbereich": "Scope",
    "konfliktarbeit.vorrang.geltungsbereichHinweis": "e.g. “bolt X on line 3”",
    "konfliktarbeit.vorrang.wirkung":
      "Only the relation between these two statements changes. Both statements, their sources and all other points of the same document remain unchanged.",
    "konfliktarbeit.amPunkt.titel": "Precedence from conflict decisions",
    "konfliktarbeit.amPunkt.ueberstimmtVon":
      "Overruled by “{{title}}”. This statement, its sources and its origin are kept.",
    "konfliktarbeit.amPunkt.hatVorrang": "Takes precedence over “{{title}}”.",
    "konfliktarbeit.amPunkt.eingeschraenktVon":
      "Restricted by “{{title}}” within the scope “{{bereich}}” — outside of it this statement still applies.",
    "konfliktarbeit.amPunkt.praezisiert": "Refines “{{title}}” for the scope “{{bereich}}”.",
    "konfliktarbeit.amPunkt.bereichZurueck": "withheld",
    "konfliktarbeit.amPunkt.andere": "another statement",
  },
  nl: {
    "konfliktarbeit.satz.regel":
      "Regelconflict: twee interne vastleggingen staan tegenover elkaar. Geen bron kan het beslissen — dat doet een bevoegde persoon.",
    "konfliktarbeit.satz.sache":
      "Inhoudelijk conflict: met bewijs te beslissen — bronnen en bewijsstukken tonen welke uitspraak klopt.",
    "konfliktarbeit.satz.version":
      "Versieconflict: dezelfde zaak in twee stadia — te verduidelijken is welk stadium geldt.",
    "konfliktarbeit.satz.offen":
      "Nog niet ingedeeld: of het een regel-, inhoudelijk of versieconflict is, legt een bevoegde persoon vast voordat er beslist wordt.",
    "konfliktarbeit.einordnen.regel": "Indelen als regelconflict",
    "konfliktarbeit.einordnen.sache": "Indelen als inhoudelijk conflict",
    "konfliktarbeit.einordnen.version": "Indelen als versieconflict",
    "konfliktarbeit.einordnung.zuerst":
      "Eerst indelen: afhankelijk van de soort werk staan andere beslissingen open.",
    "konfliktarbeit.next.einordnen": "Indelen als regel-, inhoudelijk of versieconflict.",
    "konfliktarbeit.vorschlag.widerspruch":
      "Voorstel van Klara: een tegenstrijdigheid — de ene uitspraak overstemt de andere. U beslist.",
    "konfliktarbeit.vorschlag.praezisierung":
      "Voorstel van Klara: een verfijning — ‘{{title}}’ legt het nauwkeuriger vast voor het toepassingsgebied ‘{{bereich}}’, de andere uitspraak blijft daarbuiten geldig. U beslist.",
    "konfliktarbeit.gewaehlt": "Bij het melden zo ingedeeld.",
    "konfliktarbeit.erkannt": "Door de conflictcontrole zo ingedeeld.",
    "konfliktarbeit.knopf.standLinks": "Linker stadium geldt",
    "konfliktarbeit.knopf.standRechts": "Rechter stadium geldt",
    "konfliktarbeit.eskalation.zuerst":
      "Een waarheidsconflict wordt eerst naar een mens geëscaleerd. Daarna staan tweede mening en beslissing open.",
    "konfliktarbeit.feld": "Soort werk",
    "konfliktarbeit.feld.offen": "Soort werk kiezen …",
    "konfliktarbeit.name.regel": "Regelconflict — alleen een bevoegde persoon beslist",
    "konfliktarbeit.name.sache": "Inhoudelijk conflict — met bewijs te beslissen",
    "konfliktarbeit.name.version": "Versieconflict — dezelfde zaak, twee stadia",
    "konfliktarbeit.vorrang.frage": "Hoe geldt de gekozen uitspraak?",
    "konfliktarbeit.vorrang.ueberstimmt": "Ze overstemt de andere uitspraak",
    "konfliktarbeit.vorrang.schraenktEin":
      "Ze verfijnt de andere alleen: ze geldt binnen een toepassingsgebied, de andere blijft daarbuiten geldig",
    "konfliktarbeit.vorrang.geltungsbereich": "Toepassingsgebied",
    "konfliktarbeit.vorrang.geltungsbereichHinweis": "bijv. ‘bout X op lijn 3’",
    "konfliktarbeit.vorrang.wirkung":
      "Alleen de relatie tussen deze twee uitspraken verandert. Beide uitspraken, hun bronnen en alle overige punten van hetzelfde document blijven ongewijzigd.",
    "konfliktarbeit.amPunkt.titel": "Voorrang uit conflictbeslissingen",
    "konfliktarbeit.amPunkt.ueberstimmtVon":
      "Overstemd door ‘{{title}}’. Deze uitspraak, haar bronnen en haar herkomst blijven behouden.",
    "konfliktarbeit.amPunkt.hatVorrang": "Heeft voorrang boven ‘{{title}}’.",
    "konfliktarbeit.amPunkt.eingeschraenktVon":
      "Beperkt door ‘{{title}}’ binnen het toepassingsgebied ‘{{bereich}}’ — daarbuiten geldt deze uitspraak nog steeds.",
    "konfliktarbeit.amPunkt.praezisiert":
      "Verfijnt ‘{{title}}’ voor het toepassingsgebied ‘{{bereich}}’.",
    "konfliktarbeit.amPunkt.bereichZurueck": "achtergehouden",
    "konfliktarbeit.amPunkt.andere": "een andere uitspraak",
  },
} satisfies Textmodul;
