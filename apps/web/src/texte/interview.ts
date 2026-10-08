// ================================================================================================
// AUFNAHME 20260922 · WISSEN-INTERVIEW — die Texte des geführten Interviews und des Lücken-Interviews.
// ================================================================================================
//
// Der Fragebaum selbst steht im Reasoner (services/reasoner/src/interview-tree.ts). Hier stehen nur
// die Beschriftungen der Oberfläche: Knotennamen, Spiegel, Restlückenwert, Abschlussbestätigung
// (R-0113) und das Angebot, eine Lücke gleich im Gespräch zu füllen (R-0091). Die Texte behaupten
// nie, dass es zu einem Thema im ganzen Bestand nichts gibt — die Vorschau sieht nur ihren Umfang.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "interview.",
  legacySchluessel: [],
  de: {
    "interview.knoten.kern": "Kernaussage",
    "interview.knoten.bedingung": "Bedingung",
    "interview.knoten.massnahme": "Maßnahme",
    "interview.knoten.schwelle": "Schwellenwert",
    "interview.knoten.ausnahme": "Ausnahmen",
    "interview.knoten.warum": "Warum",
    "interview.knoten.alternativen": "Verworfene Alternativen",
    "interview.knoten.geltung": "Geltungsbereich",
    "interview.knoten.risiko": "Risiken",
    "interview.knoten.herkunft": "Herkunft des Wissens (Erfahrung, Zeitpunkt, Rolle)",
    "interview.knoten.stichworte": "Stichworte",
    "interview.spiegel": "Verstanden – {{knoten}}: „{{text}}“",
    "interview.luecken": "Offene Lücken: {{wert}} %",
    "interview.lueckenListe": "Noch offen: {{liste}}",
    "interview.ueberspringen": "Weiß ich nicht – überspringen",
    "interview.abschlussAngebot":
      "Genug erzählt? Den Abschluss bestätigst du – erst dann entsteht der Entwurf. Du kannst auch weiter antworten.",
    "interview.abschlussBaumDurch":
      "Alle Fragen sind durch. Bestätige den Abschluss, dann entsteht der Entwurf.",
    "interview.abschlussUnvollstaendig":
      "Kernaussage, Bedingung oder Maßnahme fehlen noch – der Entwurf wird entsprechend lückenhaft.",
    "interview.abschliessen": "Interview abschließen und Entwurf übernehmen",
    "interview.thema":
      "Lücken-Interview zu „{{thema}}“ – drei Fragen, dann ein Entwurf zur Prüfung.",
    "interview.angebot.text":
      "Klara kann das Wissen gleich im Gespräch abholen: drei Fragen, ein Entwurf, fertig zur Prüfung.",
    "interview.angebot.knopf": "Im Gespräch erfassen",
    "interview.recherche.titel":
      "Klaras Recherche zum Thema (aus Quellen, KI-ausgewertet, ungeprüft):",
    "interview.recherche.quelle": "Quelle:",
    "interview.recherche.knopf": "Zum Thema in Quellen recherchieren",
    "interview.recherche.leer":
      "Dazu ließ sich nichts recherchieren – keine passenden Quellen, Suche gesperrt, vertraulicher Inhalt oder kein KI-Modell.",
    "interview.recherche.grenze":
      "Nur Anlass für gezieltere Fragen – in den Entwurf kommt allein, was du antwortest.",
  },
  en: {
    "interview.knoten.kern": "Core message",
    "interview.knoten.bedingung": "Condition",
    "interview.knoten.massnahme": "Action",
    "interview.knoten.schwelle": "Threshold",
    "interview.knoten.ausnahme": "Exceptions",
    "interview.knoten.warum": "Why",
    "interview.knoten.alternativen": "Rejected alternatives",
    "interview.knoten.geltung": "Scope",
    "interview.knoten.risiko": "Risks",
    "interview.knoten.herkunft": "Source of the knowledge (experience, time, role)",
    "interview.knoten.stichworte": "Keywords",
    "interview.spiegel": "Understood – {{knoten}}: “{{text}}”",
    "interview.luecken": "Open gaps: {{wert}} %",
    "interview.lueckenListe": "Still open: {{liste}}",
    "interview.ueberspringen": "I don't know – skip",
    "interview.abschlussAngebot":
      "Told enough? You confirm the end – only then is the draft created. You can also keep answering.",
    "interview.abschlussBaumDurch":
      "All questions are done. Confirm the end and the draft is created.",
    "interview.abschlussUnvollstaendig":
      "Core message, condition or action are still missing – the draft will have gaps accordingly.",
    "interview.abschliessen": "Finish interview and use draft",
    "interview.thema": "Gap interview on “{{thema}}” – three questions, then a draft for review.",
    "interview.angebot.text":
      "Klara can collect this knowledge right now in a conversation: three questions, one draft, ready for review.",
    "interview.angebot.knopf": "Capture in a conversation",
    "interview.recherche.titel":
      "Klara's research on the subject (from sources, AI-evaluated, unverified):",
    "interview.recherche.quelle": "Source:",
    "interview.recherche.knopf": "Research the subject in sources",
    "interview.recherche.leer":
      "Nothing could be researched – no matching sources, search blocked, confidential content or no AI model.",
    "interview.recherche.grenze":
      "Only a prompt for more specific questions – the draft contains only what you answer.",
  },
  nl: {
    "interview.knoten.kern": "Kernboodschap",
    "interview.knoten.bedingung": "Voorwaarde",
    "interview.knoten.massnahme": "Maatregel",
    "interview.knoten.schwelle": "Drempelwaarde",
    "interview.knoten.ausnahme": "Uitzonderingen",
    "interview.knoten.warum": "Waarom",
    "interview.knoten.alternativen": "Verworpen alternatieven",
    "interview.knoten.geltung": "Toepassingsgebied",
    "interview.knoten.risiko": "Risico's",
    "interview.knoten.herkunft": "Herkomst van de kennis (ervaring, tijdstip, rol)",
    "interview.knoten.stichworte": "Trefwoorden",
    "interview.spiegel": "Begrepen – {{knoten}}: „{{text}}”",
    "interview.luecken": "Open hiaten: {{wert}} %",
    "interview.lueckenListe": "Nog open: {{liste}}",
    "interview.ueberspringen": "Weet ik niet – overslaan",
    "interview.abschlussAngebot":
      "Genoeg verteld? Jij bevestigt de afsluiting – pas dan ontstaat het concept. Je kunt ook verder antwoorden.",
    "interview.abschlussBaumDurch":
      "Alle vragen zijn gesteld. Bevestig de afsluiting, dan ontstaat het concept.",
    "interview.abschlussUnvollstaendig":
      "Kernboodschap, voorwaarde of maatregel ontbreken nog – het concept heeft daardoor hiaten.",
    "interview.abschliessen": "Interview afsluiten en concept overnemen",
    "interview.thema":
      "Hiaat-interview over „{{thema}}” – drie vragen, dan een concept ter controle.",
    "interview.angebot.text":
      "Klara kan deze kennis meteen in een gesprek ophalen: drie vragen, één concept, klaar voor controle.",
    "interview.angebot.knopf": "In een gesprek vastleggen",
    "interview.recherche.titel":
      "Klara's onderzoek naar het onderwerp (uit bronnen, door AI beoordeeld, niet geverifieerd):",
    "interview.recherche.quelle": "Bron:",
    "interview.recherche.knopf": "Het onderwerp in bronnen onderzoeken",
    "interview.recherche.leer":
      "Er kon niets worden onderzocht – geen passende bronnen, zoeken geblokkeerd, vertrouwelijke inhoud of geen AI-model.",
    "interview.recherche.grenze":
      "Alleen aanleiding voor gerichtere vragen – in het concept komt alleen wat jij antwoordt.",
  },
} satisfies Textmodul;
