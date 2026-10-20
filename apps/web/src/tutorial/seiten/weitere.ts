import type { SeitenEintrag } from "./typen";
export const WEITERE: readonly SeitenEintrag[] = [
  {
    id: "output",
    pfade: ["/output"],
    titelKey: "nav.output",
    ziel: "main h1",
    aktion: [
      "Wähle Ausgabeart und lesbare Quellen, prüfe den erzeugten Text und nutze erst dann die angebotene Ausgabe.",
      "Choose output type and readable sources, review the generated text, then use the offered export.",
      "Kies uitvoertype en leesbare bronnen, controleer de tekst en gebruik dan de aangeboden uitvoer.",
    ],
    ergebnis: [
      "Erzeugter Entwurf und tatsächlich heruntergeladene oder gedruckte Ausgabe sind getrennt. Quellenrechte bleiben wirksam.",
      "Generated draft and downloaded or printed output are distinct. Source permissions still apply.",
      "Gegenereerd concept en gedownloade of afgedrukte uitvoer zijn apart. Bronrechten blijven gelden.",
    ],
    sonderfall: [
      "Bei fehlenden Quellen oder Fehlern zuerst die angezeigte Lücke klären; kein Export wird vom Tutorial ausgelöst.",
      "Clarify missing sources or errors first; the tutorial triggers no export.",
      "Verduidelijk eerst ontbrekende bronnen of fouten; de tutorial start geen export.",
    ],
  },
  {
    id: "graph",
    pfade: ["/graph"],
    titelKey: "nav.graph",
    ziel: "main h1",
    aktion: [
      "Prüfe Beziehungen, Richtung und Beziehungsart im Wissensgraphen. Kuratieren ist eine eigene berechtigte Handlung.",
      "Review relationships, direction and type in the knowledge graph. Curation is a separate authorized action.",
      "Controleer relaties, richting en type in de kennisgraaf. Curatie is een aparte bevoegde handeling.",
    ],
    ergebnis: [
      "Angezeigte Verbindung und bestätigte kuratierte Beziehung sind unterscheidbar.",
      "Displayed links and confirmed curated relationships are distinguishable.",
      "Getoonde verbindingen en bevestigde gecureerde relaties zijn verschillend.",
    ],
    sonderfall: [
      "Ein fehlender Knoten kann am Sichtrecht liegen. Die Begleitung erweitert keinen Zugriff.",
      "A missing node may be restricted by permissions. The tutorial grants no access.",
      "Een ontbrekend knooppunt kan door rechten komen. De tutorial geeft geen extra toegang.",
    ],
  },
  {
    id: "kapital",
    pfade: ["/kapital"],
    titelKey: "nav.capital",
    ziel: "main h1",
    aktion: [
      "Lies Lagebild, Reifegrad und reale Bewertungsfälle. Prüfe Bereich und Beleggrundlage vor einer Werteeingabe.",
      "Read the overview, maturity and real valuation cases. Check scope and evidence before entering values.",
      "Lees overzicht, volwassenheid en echte waarderingsgevallen. Controleer bereik en bewijs vóór waarde-invoer.",
    ],
    ergebnis: [
      "Gemessene Werte, fehlende Belege und Schätzungen sind getrennt zu lesen; ein Tutorial erzeugt keinen Unternehmenswert.",
      "Read measured values, missing evidence and estimates separately; a tutorial creates no business valuation.",
      "Lees gemeten waarden, ontbrekend bewijs en schattingen apart; een tutorial creëert geen bedrijfswaarde.",
    ],
    sonderfall: [
      "Unbelegte oder unbekannte Werte nicht als gemessen übernehmen. Rollen- und Stufe-2-Grenzen gelten weiter.",
      "Do not treat unproven or unknown values as measurements. Role and stage-2 restrictions still apply.",
      "Behandel onbewezen of onbekende waarden niet als metingen. Rol- en fase-2-grenzen blijven gelden.",
    ],
  },
];
